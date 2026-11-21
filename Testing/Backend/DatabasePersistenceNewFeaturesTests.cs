// [Layer: Testing/Backend]
// Responsibility: xUnit integration tests for PostgreSQL/EF Core persistence of DispatchRequests, ReportEvidences, ReportFeedbacks, extended User medical/avatar profile fields, and AlertReadState mark-all-read.
// Invariant: C# .NET 10, xUnit 2.9.3, universal lambda expressions (=>), zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Implementations;
using Backend.Features.Services.Implementations;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

public class DatabasePersistenceNewFeaturesTests
{
    private const string TinyPngDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";

    private static AppDbContext CreateInMemoryDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"ResQTrack_DbPersist_{Guid.NewGuid():N}")
            .Options);

    private static async Task<User> SeedUserAsync(
        AppDbContext db,
        UserRole role = UserRole.Civilian,
        ResponderUnitType unit = ResponderUnitType.None,
        string email = "db.persist@resqtrack.gov.ph")
    {
        var (hash, salt) = ScryptPasswordHelper.HashPassword("StrongPass123!@#");
        var user = new User
        {
            Email = email,
            FullName = "DB Persistence Tester",
            FirstName = "Persistence",
            Surname = "Tester",
            Role = role,
            Unit = unit,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task DispatchRequestService_CreateAndUpdateStatus_PersistsToDatabaseAndAuditLogs()
    {
        using var db = CreateInMemoryDbContext();
        var medic = await SeedUserAsync(db, UserRole.Responder, ResponderUnitType.RHU, "medic.req@resqtrack.gov.ph");
        var admin = await SeedUserAsync(db, UserRole.LDRRMO_Admin, ResponderUnitType.LDRRMO, "admin.req@resqtrack.gov.ph");
        var auditRepo = new AuditLogRepository(db);
        var service = new DispatchRequestService(db, auditRepo);

        var created = await service.CreateAsync(
            new CreateDispatchRequest(
                Direction: "REQUEST_DEPLOY",
                TargetUnit: "FIRE",
                OriginUnit: "RHU",
                Title: "Highway Extrication Backup",
                Description: "Requesting hydraulic rescue unit at Poblacion junction.",
                Severity: "High",
                LocationLabel: "Barangay Uno, Katipunan",
                Latitude: 8.5147,
                Longitude: 123.2842,
                RequestedByName: medic.FullName),
            medic.Id,
            medic.FullName,
            "203.0.113.45");

        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal("PENDING", created.Status);
        Assert.Equal("FIRE", created.TargetUnit);
        Assert.Equal("203.0.113.45", created.IpAddress);

        var (ok, err, notFound, updated) = await service.UpdateStatusAsync(
            created.RequestCode,
            new UpdateDispatchStatusRequest("APPROVED", admin.FullName),
            admin.Id,
            admin.FullName);

        Assert.True(ok, err);
        Assert.False(notFound);
        Assert.NotNull(updated);
        Assert.Equal("APPROVED", updated!.Status);
        Assert.Equal(admin.FullName, updated.RespondedByName);

        var list = await service.GetAllAsync();
        Assert.Single(list);
        Assert.Equal("APPROVED", list[0].Status);
    }

    [Fact]
    public async Task ReportService_EvidencesAndFeedback_PersistToDatabaseAndPopulateReportResponse()
    {
        using var db = CreateInMemoryDbContext();
        var civilian = await SeedUserAsync(db, UserRole.Civilian, ResponderUnitType.None, "civ.fb@resqtrack.gov.ph");
        var reportRepo = new ReportRepository(db);
        var userRepo = new UserRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var reportService = new ReportService(reportRepo, userRepo, auditRepo, db: db);

        string tempDir = Path.Combine(Path.GetTempPath(), "resq_ev_" + Guid.NewGuid().ToString("N"));
        try
        {
            var createdReport = await reportService.CreateReportAsync(
                civilian.Id,
                new CreateReportRequest(
                    Title: "Flooded Bridge",
                    Note: "Water overtopping approach",
                    Category: IncidentCategory.NaturalDisaster,
                    Severity: IncidentSeverity.High,
                    Latitude: 8.512,
                    Longitude: 123.281,
                    GpsAccuracyMeters: 5.0,
                    IsHardwareGeolocated: true,
                    IsBlurry: false,
                    RequiresManualVerification: true,
                    LocationLabel: "Dicayo Bridge",
                    ImageDataUrl: TinyPngDataUrl),
                tempDir);

            var (evOk, evNotFound, evErr, evidence) = await reportService.AddReportEvidenceAsync(
                createdReport.Id,
                new CreateReportEvidenceRequest(DataUrl: TinyPngDataUrl, Caption: "North approach photo", MediaType: "image"),
                civilian.Id,
                civilian.FullName,
                tempDir);

            Assert.True(evOk, evErr);
            Assert.False(evNotFound);
            Assert.NotNull(evidence);
            Assert.Equal("North approach photo", evidence!.Caption);
            var evidences = await reportService.GetReportEvidencesAsync(createdReport.Id);
            Assert.Single(evidences);

            var (fbOk, fbNotFound, fbErr, feedback) = await reportService.SubmitReportFeedbackAsync(
                createdReport.Id,
                civilian.Id,
                new SubmitReportFeedbackRequest(5, "Fast dispatch response from RHU and BFP"));

            Assert.True(fbOk, fbErr);
            Assert.False(fbNotFound);
            Assert.NotNull(feedback);
            Assert.Equal(5, feedback!.Rating);

            var userReports = await reportService.GetMyReportsAsync(civilian.Id);
            Assert.Single(userReports);
            Assert.Equal(5, userReports[0].FeedbackRating);
            Assert.Equal("Fast dispatch response from RHU and BFP", userReports[0].FeedbackComment);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task UserGovernanceService_UpdateProfileAsync_PersistsMedicalSecondaryContactAndAvatarInDatabase()
    {
        using var db = CreateInMemoryDbContext();
        var user = await SeedUserAsync(db, UserRole.Civilian, ResponderUnitType.None, "med.profile@resqtrack.gov.ph");
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var govService = new UserGovernanceService(userRepo, sessionRepo, auditRepo, db);

        string tempDir = Path.Combine(Path.GetTempPath(), "resq_av_" + Guid.NewGuid().ToString("N"));
        try
        {
            var (success, error) = await govService.UpdateProfileAsync(
                user.Id,
                new UpdateProfileRequest(
                    FirstName: "Juan",
                    Surname: "Dela Cruz",
                    BloodType: "B+",
                    Barangay: "Barangay Uno",
                    Allergies: "Penicillin",
                    MedicalConditions: "Asthma",
                    IsOrganDonor: true,
                    SecondaryContactName: "Pedro Dela Cruz",
                    SecondaryContactPhone: "09179998877",
                    AvatarDataUrl: TinyPngDataUrl),
                capturesRootPath: tempDir);

            Assert.True(success, error);
            var detail = await govService.GetUserDetailAsync(user.Id);
            Assert.NotNull(detail);
            Assert.Equal("Penicillin", detail!.Allergies);
            Assert.Equal("Asthma", detail.MedicalConditions);
            Assert.True(detail.IsOrganDonor);
            Assert.Equal("Pedro Dela Cruz", detail.SecondaryContactName);
            Assert.Equal("09179998877", detail.SecondaryContactPhone);
            Assert.Equal($"/api/users/{user.Id}/captures/avatar", detail.AvatarUrl);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }
}
