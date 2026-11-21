// [Layer: Testing/Backend]
// Responsibility: xUnit contract tests for Incident AI Auto-Approval Strategy, monitor/camera prompt resilience, fail-closed checks, and ReportService 4-arg backward compatibility.
// Invariant: C# .NET 10, xUnit 2.9.3, universal lambda expressions (=>), zero hardcoded API keys, zero emojis.

using System.Text.Json;
using Backend.Features.Api.Controllers;
using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Implementations;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.IncidentVision;
using Backend.Features.Services.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;

namespace Backend.Tests;

public class IncidentAutoApprovalTests
{
    private const string TinyPngDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";

    private static AppDbContext CreateInMemoryDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"ResQTrack_AutoApprove_{Guid.NewGuid():N}")
            .Options);

    private static async Task<User> SeedUserAsync(AppDbContext db, UserRole role = UserRole.Civilian, string email = "auto.reporter@resqtrack.gov.ph")
    {
        var (hash, salt) = ScryptPasswordHelper.HashPassword("StrongPass123!@#");
        var user = new User
        {
            Email = email,
            FullName = role == UserRole.LDRRMO_Admin ? "LDRRMO Commander" : "Resident Reporter",
            Role = role,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static CreateReportRequest BuildSampleReportRequest(
        bool isBlurry = false,
        string? imageDataUrl = TinyPngDataUrl,
        IncidentCategory category = IncidentCategory.VehicularAccident) =>
        new(
            Title: "Roadway Collision",
            Note: "Vehicle crash captured on live incident camera",
            Category: category,
            Severity: IncidentSeverity.High,
            Latitude: 8.5147,
            Longitude: 123.2842,
            GpsAccuracyMeters: 6.0,
            IsHardwareGeolocated: true,
            IsBlurry: isBlurry,
            RequiresManualVerification: true,
            LocationLabel: "Barangay Uno, Katipunan",
            ImageDataUrl: imageDataUrl,
            ReporterContactNumber: "09171234567");

    [Fact]
    public async Task CreateReportAsync_AutoApprovesGenuineOnlineCameraIncident_WhenAutoApprovalStrategyInjected()
    {
        using var db = CreateInMemoryDbContext();
        var reporter = await SeedUserAsync(db);

        var roboflowStub = new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
            ModelId: RoboflowServerlessAccidentDetectionStrategy.DefaultModelId,
            Prediction: "Needs-Manual-Review",
            Confidence: 0.45,
            NeedsReview: true,
            AuthTransport: "LOCAL_FALLBACK_NO_API_KEY",
            RawJson: "{}"));

        var claudeClientStub = new StubClaudeMessagesClient(
            modelUsed: "claude-haiku-4-5-20251001",
            rawResponseJson: """
                {"isGenuineIncident":true,"detectedCategory":"VehicularAccident","recommendedSeverity":"High","pointerIconType":"car-crash","situationDescription":"Two-vehicle collision visible on live camera monitor frame.","visibleHazards":"Deformed front bumper, debris across lane","uncertaintyNotes":"Single camera angle."}
                """);

        var dualStrategy = new DualStageIncidentSceneAiStrategy(
            roboflowStub,
            new ClaudeHaikuIncidentVisionStrategy(claudeClientStub));

        var reportService = new ReportService(
            new ReportRepository(db),
            new UserRepository(db),
            new AuditLogRepository(db),
            dualStrategy,
            new ClaudeIncidentAutoApprovalStrategy());

        string tempDir = Path.Combine(Path.GetTempPath(), "resq_auto_approve_" + Guid.NewGuid().ToString("N"));
        try
        {
            var created = await reportService.CreateReportAsync(reporter.Id, BuildSampleReportRequest(), tempDir);

            Assert.Equal(ReportStatus.Verified, created.Status);
            Assert.NotNull(created.VerifiedAt);
            Assert.False(created.RequiresManualVerification);
            Assert.True(created.AiAutoApproved);
            Assert.Equal("AI_AUTO_APPROVED", created.AiVerificationStatus);
            Assert.Equal("VehicularAccident", created.ClaudeIncidentCategory);

            // Verify prompt instructs Claude to evaluate monitor/screen captures and ignore RESQTRACK EVIDENCE ribbon
            Assert.Contains("RESQTRACK EVIDENCE", claudeClientStub.LastSerializedPayload ?? string.Empty);
            Assert.Contains("monitor", claudeClientStub.LastSerializedPayload ?? string.Empty);

            var persisted = await db.Reports.FirstAsync(r => r.Id == created.Id);
            Assert.Equal(ReportStatus.Verified, persisted.Status);
            Assert.NotNull(persisted.VerifiedAt);
            Assert.False(persisted.RequiresManualVerification);
            Assert.Contains("AI_AUTO_APPROVED", persisted.AiAnalysisJson ?? string.Empty);

            var autoAudit = await db.AuditLogs.FirstOrDefaultAsync(a => a.Action == "REPORT_AI_AUTO_APPROVED");
            Assert.NotNull(autoAudit);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task CreateReportAsync_FailsClosed_WhenImageIsNonIncident_Blurry_OrOfflineFallback()
    {
        using var db = CreateInMemoryDbContext();
        var reporter = await SeedUserAsync(db);
        string tempDir = Path.Combine(Path.GetTempPath(), "resq_fail_closed_" + Guid.NewGuid().ToString("N"));

        try
        {
            // Case 1: NonIncident verdict from online Claude Haiku 4.5
            var nonIncidentDual = new DualStageIncidentSceneAiStrategy(
                new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
                    RoboflowServerlessAccidentDetectionStrategy.DefaultModelId, "Non-Accident", 0.91, true, "Authorization: Bearer (header)", "{}")),
                new ClaudeHaikuIncidentVisionStrategy(new StubClaudeMessagesClient(
                    "claude-haiku-4-5-20251001",
                    """
                    {"isGenuineIncident":false,"detectedCategory":"NonIncident","recommendedSeverity":"Low","pointerIconType":"hazard","situationDescription":"Empty office desk with no emergency.","visibleHazards":"none","uncertaintyNotes":"No emergency present."}
                    """)));

            var nonIncidentService = new ReportService(
                new ReportRepository(db),
                new UserRepository(db),
                new AuditLogRepository(db),
                nonIncidentDual,
                new ClaudeIncidentAutoApprovalStrategy());

            var nonIncidentReport = await nonIncidentService.CreateReportAsync(reporter.Id, BuildSampleReportRequest(), tempDir);
            Assert.Equal(ReportStatus.Reported, nonIncidentReport.Status);
            Assert.Null(nonIncidentReport.VerifiedAt);
            Assert.False(nonIncidentReport.AiAutoApproved);
            Assert.Equal("AI_NON_INCIDENT_FLAGGED", nonIncidentReport.AiVerificationStatus);

            // Case 2: Blurry image (even when AI sees an emergency)
            var genuineDual = new DualStageIncidentSceneAiStrategy(
                new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
                    RoboflowServerlessAccidentDetectionStrategy.DefaultModelId, "Accident", 0.95, false, "Authorization: Bearer (header)", "{}")),
                new ClaudeHaikuIncidentVisionStrategy(new StubClaudeMessagesClient(
                    "claude-haiku-4-5-20251001",
                    """
                    {"isGenuineIncident":true,"detectedCategory":"VehicularAccident","recommendedSeverity":"High","pointerIconType":"car-crash","situationDescription":"Highway vehicle collision.","visibleHazards":"Damaged vehicles","uncertaintyNotes":"Single frame."}
                    """)));

            var genuineService = new ReportService(
                new ReportRepository(db),
                new UserRepository(db),
                new AuditLogRepository(db),
                genuineDual,
                new ClaudeIncidentAutoApprovalStrategy());

            var blurryReport = await genuineService.CreateReportAsync(reporter.Id, BuildSampleReportRequest(isBlurry: true), tempDir);
            Assert.Equal(ReportStatus.Reported, blurryReport.Status);
            Assert.Null(blurryReport.VerifiedAt);
            Assert.False(blurryReport.AiAutoApproved);
            Assert.Equal("PENDING_MANUAL_REVIEW", blurryReport.AiVerificationStatus);

            // Case 3: Both Roboflow and Claude offline (fallback only -> never blind auto-approve)
            var emptyConfig = new ConfigurationBuilder().Build();
            var offlineDual = new DualStageIncidentSceneAiStrategy(
                new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
                    RoboflowServerlessAccidentDetectionStrategy.DefaultModelId, "Needs-Manual-Review", 0.45, true, "LOCAL_FALLBACK_NO_API_KEY", "{}")),
                new ClaudeHaikuIncidentVisionStrategy(new OfflineClaudeMessagesClient(), emptyConfig));

            var offlineService = new ReportService(
                new ReportRepository(db),
                new UserRepository(db),
                new AuditLogRepository(db),
                offlineDual,
                new ClaudeIncidentAutoApprovalStrategy());

            var offlineReport = await offlineService.CreateReportAsync(reporter.Id, BuildSampleReportRequest(), tempDir);
            Assert.Equal(ReportStatus.Reported, offlineReport.Status);
            Assert.Null(offlineReport.VerifiedAt);
            Assert.False(offlineReport.AiAutoApproved);
            Assert.Equal("PENDING_MANUAL_REVIEW", offlineReport.AiVerificationStatus);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task AutoApprovePendingReportWithAiAsync_UpgradesPendingReport_AndRefusesNonIncident()
    {
        using var db = CreateInMemoryDbContext();
        var reporter = await SeedUserAsync(db, UserRole.Civilian, "civ@resqtrack.gov.ph");
        var admin = await SeedUserAsync(db, UserRole.LDRRMO_Admin, "admin@resqtrack.gov.ph");
        string tempDir = Path.Combine(Path.GetTempPath(), "resq_pending_upgrade_" + Guid.NewGuid().ToString("N"));

        try
        {
            // Seed pending report using 4-arg service (initial status Reported)
            var initialService = new ReportService(
                new ReportRepository(db),
                new UserRepository(db),
                new AuditLogRepository(db));

            var pendingGenuine = await initialService.CreateReportAsync(reporter.Id, BuildSampleReportRequest(), tempDir);
            var pendingFake = await initialService.CreateReportAsync(reporter.Id, BuildSampleReportRequest(), tempDir);

            Assert.Equal(ReportStatus.Reported, pendingGenuine.Status);
            Assert.Equal(ReportStatus.Reported, pendingFake.Status);

            // Upgrade genuine report when Claude Haiku confirms StructuralFire despite Stage 1 NeedsReview
            var upgradeDual = new DualStageIncidentSceneAiStrategy(
                new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
                    RoboflowServerlessAccidentDetectionStrategy.DefaultModelId, "Non-Accident", 0.55, true, "Authorization: Bearer (header)", "{}")),
                new ClaudeHaikuIncidentVisionStrategy(new StubClaudeMessagesClient(
                    "claude-haiku-4-5-20251001",
                    """
                    {"isGenuineIncident":true,"detectedCategory":"StructuralFire","recommendedSeverity":"Critical","pointerIconType":"fire","situationDescription":"Active structural flames and dark smoke visible on screen capture.","visibleHazards":"Open flame, heavy smoke","uncertaintyNotes":"Single camera angle."}
                    """)));

            var upgradeService = new ReportService(
                new ReportRepository(db),
                new UserRepository(db),
                new AuditLogRepository(db),
                upgradeDual,
                new ClaudeIncidentAutoApprovalStrategy());

            var upgradeResult = await upgradeService.AutoApprovePendingReportWithAiAsync(pendingGenuine.Id, admin.Id);
            Assert.True(upgradeResult.AutoApproved);
            Assert.Equal(ReportStatus.Verified, upgradeResult.Status);
            Assert.Equal("AI_AUTO_APPROVED", upgradeResult.AiVerificationStatus);
            Assert.NotNull(upgradeResult.Report);
            Assert.True(upgradeResult.Report!.AiAutoApproved);
            Assert.Equal("StructuralFire", upgradeResult.Report.ClaudeIncidentCategory);

            // Refuse NonIncident pending report via controller endpoint too
            var refuseDual = new DualStageIncidentSceneAiStrategy(
                new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
                    RoboflowServerlessAccidentDetectionStrategy.DefaultModelId, "Non-Accident", 0.92, true, "Authorization: Bearer (header)", "{}")),
                new ClaudeHaikuIncidentVisionStrategy(new StubClaudeMessagesClient(
                    "claude-haiku-4-5-20251001",
                    """
                    {"isGenuineIncident":false,"detectedCategory":"NonIncident","recommendedSeverity":"Low","pointerIconType":"hazard","situationDescription":"Selfie portrait with no emergency.","visibleHazards":"none","uncertaintyNotes":"No incident visible."}
                    """)));

            var refuseService = new ReportService(
                new ReportRepository(db),
                new UserRepository(db),
                new AuditLogRepository(db),
                refuseDual,
                new ClaudeIncidentAutoApprovalStrategy());

            var controller = new ReportsController(refuseService, new DummyWebHostEnvironment(tempDir))
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext()
                }
            };
            controller.HttpContext.Items["UserRole"] = UserRole.LDRRMO_Admin;
            controller.HttpContext.Items["UserId"] = admin.Id;

            var actionResult = await controller.AiAutoApproveReportAsync(pendingFake.Id, CancellationToken.None);
            var okResult = Assert.IsType<OkObjectResult>(actionResult);
            var json = JsonSerializer.Serialize(okResult.Value);
            Assert.Contains("\"autoApproved\":false", json);
            Assert.Contains("AI_NON_INCIDENT_FLAGGED", json);

            var persistedFake = await db.Reports.FirstAsync(r => r.Id == pendingFake.Id);
            Assert.Equal(ReportStatus.Reported, persistedFake.Status);
            Assert.Null(persistedFake.VerifiedAt);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task ReportService_FourArgConstructor_PreservesReportedStatusBackwardCompatibility()
    {
        using var db = CreateInMemoryDbContext();
        var reporter = await SeedUserAsync(db);

        var dualStrategy = new DualStageIncidentSceneAiStrategy(
            new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
                RoboflowServerlessAccidentDetectionStrategy.DefaultModelId, "Accident", 0.96, false, "Authorization: Bearer (header)", "{}")),
            new ClaudeHaikuIncidentVisionStrategy(new StubClaudeMessagesClient(
                "claude-haiku-4-5-20251001",
                """
                {"isGenuineIncident":true,"detectedCategory":"VehicularAccident","recommendedSeverity":"High","pointerIconType":"car-crash","situationDescription":"Clear highway collision.","visibleHazards":"Vehicle debris","uncertaintyNotes":"Single camera angle."}
                """)));

        // 4-arg constructor: incidentAutoApprovalStrategy == null -> must stay ReportStatus.Reported
        var legacyService = new ReportService(
            new ReportRepository(db),
            new UserRepository(db),
            new AuditLogRepository(db),
            dualStrategy);

        string tempDir = Path.Combine(Path.GetTempPath(), "resq_legacy_4arg_" + Guid.NewGuid().ToString("N"));
        try
        {
            var created = await legacyService.CreateReportAsync(reporter.Id, BuildSampleReportRequest(), tempDir);
            Assert.Equal(ReportStatus.Reported, created.Status);
            Assert.Null(created.VerifiedAt);
            Assert.True(created.RequiresManualVerification);
            Assert.False(created.AiAutoApproved);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    private sealed class StubRoboflowStrategy(RoboflowAccidentDetectionResult fixedResult) : IRoboflowAccidentDetectionStrategy
    {
        public Task<RoboflowAccidentDetectionResult> DetectAccidentAsync(
            RoboflowAccidentDetectionInput input,
            CancellationToken ct = default) =>
            Task.FromResult(fixedResult);
    }

    private sealed class StubClaudeMessagesClient(string modelUsed, string rawResponseJson) : IClaudeMessagesClient
    {
        public bool IsConfigured => true;
        public string PrimaryModel => modelUsed;
        public string FallbackModel => modelUsed;
        public string? LastSerializedPayload { get; private set; }

        public Task<ClaudeMessageAttemptResult> SendMessagesAsync(
            IReadOnlyDictionary<string, object> payloadWithoutModel,
            CancellationToken ct = default,
            string? modelOverride = null)
        {
            LastSerializedPayload = JsonSerializer.Serialize(payloadWithoutModel);
            return Task.FromResult(new ClaudeMessageAttemptResult(
                Success: true,
                RawText: rawResponseJson,
                ModelUsed: modelUsed,
                ErrorCode: null,
                ErrorMessage: null,
                HttpStatusCode: 200,
                UsedFallbackModel: false));
        }
    }

    private sealed class OfflineClaudeMessagesClient : IClaudeMessagesClient
    {
        public bool IsConfigured => false;
        public string PrimaryModel => "claude-haiku-4-5-20251001";
        public string FallbackModel => "claude-haiku-4-5-20251001";

        public Task<ClaudeMessageAttemptResult> SendMessagesAsync(
            IReadOnlyDictionary<string, object> payloadWithoutModel,
            CancellationToken ct = default,
            string? modelOverride = null) =>
            Task.FromResult(new ClaudeMessageAttemptResult(
                Success: false,
                RawText: null,
                ModelUsed: PrimaryModel,
                ErrorCode: "PROVIDER_UNAVAILABLE",
                ErrorMessage: "Not configured",
                HttpStatusCode: 0,
                UsedFallbackModel: false));
    }

    private sealed class DummyWebHostEnvironment(string contentRootPath) : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "Backend.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = contentRootPath;
        public string EnvironmentName { get; set; } = "Testing";
        public string ContentRootPath { get; set; } = contentRootPath;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
