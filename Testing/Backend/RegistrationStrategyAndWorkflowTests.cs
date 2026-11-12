// [Layer: Testing/Backend]
// Responsibility: Unit and integration tests for ResQTrack 6-Phase Manual Registration, Strategy Pattern, Decorator Pattern, and Provider Resolution.
// Universal lambda expressions (=>). Zero emojis.

using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Implementations;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Verification;
using Backend.Features.Services.Verification.Decorators;
using Backend.Features.Services.Verification.Providers;

namespace Backend.Tests;

public class RegistrationStrategyAndWorkflowTests
{
    private static AppDbContext CreateInMemoryDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options);

    private static string CreateValidPngDataUrl() =>
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    private static string CreateCorruptDataUrl() =>
        "data:image/png;base64,VGhpcyBpcyBub3QgYSB2YWxpZCBQTkcgZmlsZSBhdCBhbGwh";

    // -------------------------------------------------------------------------
    // 1. ManualIdentityVerificationProvider Tests
    // -------------------------------------------------------------------------

    [Fact]
    public async Task ManualIdentityVerificationProvider_ValidFrontAndBack_ReturnsPendingReview()
    {
        var provider = new ManualIdentityVerificationProvider();
        string tempDir = Path.Combine(Path.GetTempPath(), "resq_test_id_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var context = new IdentityDocumentSubmissionContext(
                Email: "citizen.id@resqtrack.gov.ph",
                GovernmentIdType: "Philippine National ID (PhilSys)",
                GovernmentIdNumber: "7109-1234-5678-9012",
                FrontImageDataUrl: CreateValidPngDataUrl(),
                BackImageDataUrl: CreateValidPngDataUrl(),
                CapturesRootPath: tempDir,
                MinWidth: 1,
                MinHeight: 1,
                MaxWidth: 8192,
                MaxHeight: 8192,
                MaxUploadSizeBytes: 5 * 1024 * 1024,
                RequireBothSides: false);

            var result = await provider.SubmitIdentityDocumentAsync(context);

            Assert.True(result.Success);
            Assert.Equal("PendingReview", result.VerificationStatus);
            Assert.Equal("SUBMITTED_PENDING_ADMIN_REVIEW", result.DocumentCheckStatus);
            Assert.False(result.IsAuthenticityVerified);
            Assert.NotNull(result.FrontEncryptedFilePath);
            Assert.NotNull(result.BackEncryptedFilePath);
            Assert.Equal(VerificationErrorType.None, result.ErrorType);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task ManualIdentityVerificationProvider_MissingRequiredFront_ReturnsValidationError()
    {
        var provider = new ManualIdentityVerificationProvider();
        var context = new IdentityDocumentSubmissionContext(
            Email: "citizen.nofront@resqtrack.gov.ph",
            GovernmentIdType: "Driver's License",
            GovernmentIdNumber: "N01-23-456789",
            FrontImageDataUrl: null,
            BackImageDataUrl: null,
            CapturesRootPath: Path.GetTempPath(),
            MinWidth: 1,
            MinHeight: 1,
            MaxWidth: 8192,
            MaxHeight: 8192,
            MaxUploadSizeBytes: 5 * 1024 * 1024,
            RequireFront: true,
            RequireBothSides: false);

        var result = await provider.SubmitIdentityDocumentAsync(context);

        Assert.False(result.Success);
        Assert.Equal(VerificationErrorType.ValidationError, result.ErrorType);
        Assert.Contains("Front", result.ErrorMessage ?? string.Empty);
    }

    [Fact]
    public async Task ManualIdentityVerificationProvider_CorruptMagicBytes_ReturnsUnsupportedMediaType()
    {
        var provider = new ManualIdentityVerificationProvider();
        var context = new IdentityDocumentSubmissionContext(
            Email: "citizen.badmagic@resqtrack.gov.ph",
            GovernmentIdType: "Passport",
            GovernmentIdNumber: "P1234567A",
            FrontImageDataUrl: CreateCorruptDataUrl(),
            BackImageDataUrl: null,
            CapturesRootPath: Path.GetTempPath(),
            MinWidth: 1,
            MinHeight: 1,
            MaxWidth: 8192,
            MaxHeight: 8192,
            MaxUploadSizeBytes: 5 * 1024 * 1024,
            RequireBothSides: false);

        var result = await provider.SubmitIdentityDocumentAsync(context);

        Assert.False(result.Success);
        Assert.Equal(VerificationErrorType.UnsupportedMediaType, result.ErrorType);
    }

    // -------------------------------------------------------------------------
    // 2. ManualFacialReviewProvider Tests
    // -------------------------------------------------------------------------

    [Fact]
    public async Task ManualFacialReviewProvider_ValidCaptureAndConsent_ReturnsPendingReview()
    {
        var provider = new ManualFacialReviewProvider();
        string tempDir = Path.Combine(Path.GetTempPath(), "resq_test_face_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var context = new FacialRecordSubmissionContext(
                Email: "citizen.face@resqtrack.gov.ph",
                FaceCaptureDataUrl: CreateValidPngDataUrl(),
                ConsentAccepted: true,
                ConsentNoticeVersion: "v2.0-manual-registration",
                OptionalDescriptorVector: null,
                CapturesRootPath: tempDir,
                MinWidth: 1,
                MinHeight: 1,
                MaxWidth: 8192,
                MaxHeight: 8192,
                MaxUploadSizeBytes: 5 * 1024 * 1024,
                RequireFacialCapture: true);

            var result = await provider.SubmitFacialRecordAsync(context);

            Assert.True(result.Success);
            Assert.Equal("PendingReview", result.VerificationStatus);
            Assert.Equal("NOT_PERFORMED_MANUAL_REVIEW", result.FaceMatchStatus);
            Assert.Equal("CAPTURED_PENDING_ADMIN_REVIEW", result.LivenessStatus);
            Assert.False(result.IsFaceMatched);
            Assert.False(result.IsIdentityVerified);
            Assert.Null(result.EnrolledTemplateBytes);
            Assert.NotNull(result.FaceEncryptedFilePath);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task ManualFacialReviewProvider_MissingConsent_ReturnsValidationError()
    {
        var provider = new ManualFacialReviewProvider();
        var context = new FacialRecordSubmissionContext(
            Email: "citizen.noconsent@resqtrack.gov.ph",
            FaceCaptureDataUrl: CreateValidPngDataUrl(),
            ConsentAccepted: false,
            ConsentNoticeVersion: "v2.0-manual-registration",
            OptionalDescriptorVector: null,
            CapturesRootPath: Path.GetTempPath(),
            MinWidth: 1,
            MinHeight: 1,
            MaxWidth: 8192,
            MaxHeight: 8192,
            MaxUploadSizeBytes: 5 * 1024 * 1024,
            RequireFacialCapture: true);

        var result = await provider.SubmitFacialRecordAsync(context);

        Assert.False(result.Success);
        Assert.Equal(VerificationErrorType.ValidationError, result.ErrorType);
        Assert.Contains("consent", result.ErrorMessage ?? string.Empty, StringComparison.OrdinalIgnoreCase);
    }

    // -------------------------------------------------------------------------
    // 3. Decorator Pattern Tests
    // -------------------------------------------------------------------------

    [Fact]
    public void LoggingDecorators_DelegateExecutionToUnderlyingProviders()
    {
        var innerId = new ManualIdentityVerificationProvider();
        var loggingId = new LoggingIdentityVerificationDecorator(innerId, NullLogger<LoggingIdentityVerificationDecorator>.Instance);

        var innerFace = new ManualFacialReviewProvider();
        var loggingFace = new LoggingFacialVerificationDecorator(innerFace, NullLogger<LoggingFacialVerificationDecorator>.Instance);

        Assert.Equal(innerId.ProviderName, loggingId.ProviderName);
        Assert.Equal(innerId.ProviderMode, loggingId.ProviderMode);
        Assert.Equal(innerFace.ProviderName, loggingFace.ProviderName);
        Assert.Equal(innerFace.ProviderMode, loggingFace.ProviderMode);
    }

    [Fact]
    public async Task ResilienceDecorators_CatchExceptionsGracefully()
    {
        var throwingId = new ThrowingIdentityVerificationProvider();
        var resilientId = new ResilienceIdentityVerificationDecorator(throwingId, NullLogger<ResilienceIdentityVerificationDecorator>.Instance);

        var context = new IdentityDocumentSubmissionContext(
            Email: "resilience.test@resqtrack.gov.ph",
            GovernmentIdType: "PhilSys",
            GovernmentIdNumber: null,
            FrontImageDataUrl: null,
            BackImageDataUrl: null,
            CapturesRootPath: Path.GetTempPath(),
            MinWidth: 1,
            MinHeight: 1,
            MaxWidth: 1024,
            MaxHeight: 1024,
            MaxUploadSizeBytes: 1024,
            RequireBothSides: false);

        var result = await resilientId.SubmitIdentityDocumentAsync(context);

        Assert.False(result.Success);
        Assert.Equal(VerificationErrorType.InternalError, result.ErrorType);
        Assert.Equal("Identity verification provider encountered an internal storage or processing error.", result.ErrorMessage);
    }

    // -------------------------------------------------------------------------
    // 4. VerificationProviderResolver Tests
    // -------------------------------------------------------------------------

    [Fact]
    public void VerificationProviderResolver_ResolvesConfiguredProviders()
    {
        var options = Options.Create(new VerificationProviderOptions
        {
            IdentityProvider = "Manual",
            FacialProvider = "Manual"
        });

        var resolver = new VerificationProviderResolver(
            options,
            null,
            NullLogger<VerificationProviderResolver>.Instance);

        var idProvider = resolver.ResolveIdentityProvider();
        var faceProvider = resolver.ResolveFacialProvider();

        Assert.NotNull(idProvider);
        Assert.NotNull(faceProvider);
        Assert.Equal("Manual", idProvider.ProviderMode);
        Assert.Equal("Manual", faceProvider.ProviderMode);
    }

    [Fact]
    public void VerificationProviderResolver_ResolvesIsolatedStrategies()
    {
        var options = Options.Create(new VerificationProviderOptions
        {
            IdentityProvider = "AutomatedOcr",
            FacialProvider = "InternalBiometric"
        });

        var resolver = new VerificationProviderResolver(
            options,
            null,
            NullLogger<VerificationProviderResolver>.Instance);

        var idProvider = resolver.ResolveIdentityProvider();
        var faceProvider = resolver.ResolveFacialProvider();

        Assert.Equal("AutomatedOcr", idProvider.ProviderMode);
        Assert.Equal("InternalBiometric", faceProvider.ProviderMode);
    }

    // -------------------------------------------------------------------------
    // 5. AuthService 6-Phase Manual Registration & Workflow Tests
    // -------------------------------------------------------------------------

    [Fact]
    public async Task AuthService_RegisterWithDetailsAsync_PersistsUserAndRecords_InManualMode()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);

        var authService = new AuthService(
            userRepo,
            sessionRepo,
            auditRepo,
            db,
            new ManualIdentityVerificationProvider(),
            new ManualFacialReviewProvider());

        string tempDir = Path.Combine(Path.GetTempPath(), "resq_test_reg_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var request = new RegisterRequest(
                Email: "manual.citizen@resqtrack.gov.ph",
                Password: "SecurePassword123!@#",
                FullName: "Rizal, Juan Protacio Jr",
                ConfirmPassword: "SecurePassword123!@#",
                DisplayName: "citizen_katipunan_01",
                FirstName: "Juan",
                MiddleName: "Protacio",
                Surname: "Rizal",
                Suffix: "Jr",
                Sex: "Male",
                DateOfBirth: new DateTime(1995, 6, 19),
                Age: 31,
                PhoneNumber: "+639171234567",
                Province: "Zamboanga del Norte",
                CityOrMunicipality: "Katipunan",
                Barangay: "Barangay Uno (Pob.)",
                StreetOrPurok: "Purok 3, Mabini Street",
                Weight: "65 kg",
                Height: "172 cm",
                GovernmentIdType: "Philippine National ID (PhilSys)",
                IssuingAgency: "PSA",
                Role: UserRole.Civilian,
                Unit: ResponderUnitType.None,
                ConsentAccepted: true,
                IdCaptureDataUrl: CreateValidPngDataUrl(),
                IdBackCaptureDataUrl: CreateValidPngDataUrl(),
                FaceCaptureDataUrl: CreateValidPngDataUrl(),
                MinImageDimension: 1);

            var (success, error, statusCode, errorCode, user, response) = await authService.RegisterWithDetailsAsync(request, tempDir);

            Assert.True(success, error);
            Assert.Equal(201, statusCode);
            Assert.NotNull(user);
            Assert.NotNull(response);
            Assert.Equal("manual.citizen@resqtrack.gov.ph", user.Email);
            Assert.Equal("citizen_katipunan_01", user.DisplayName);
            Assert.Equal("Juan", user.FirstName);
            Assert.Equal("Rizal", user.Surname);
            Assert.Equal(AccountStatus.Pending, user.Status);
            Assert.False(user.FaceVerified);
            Assert.Equal("PendingReview", user.IdentityVerificationStatus);
            Assert.Equal("PendingReview", user.FacialVerificationStatus);
            Assert.Equal("ManualIdentityVerificationProvider", user.IdentityVerificationProvider);
            Assert.Equal("ManualFacialReviewProvider", user.FacialVerificationProvider);

            // UserConsent must be persisted
            var consent = await db.UserConsents.FirstOrDefaultAsync(c => c.UserId == user.Id);
            Assert.NotNull(consent);
            Assert.Equal("EXPLICIT_OPT_IN", consent.UserAction);

            // IdentityVerificationRecord must be persisted with PENDING_REVIEW
            var idRecord = await db.IdentityVerificationRecords.FirstOrDefaultAsync(r => r.UserId == user.Id);
            Assert.NotNull(idRecord);
            Assert.Equal("PENDING_REVIEW", idRecord.OverallVerificationStatus);
            Assert.Equal("ManualIdentityVerificationProvider", idRecord.ExtractionEngine);

            // Under Manual mode, BiometricEnrollments must NOT be auto-enrolled
            var enrollment = await db.BiometricEnrollments.FirstOrDefaultAsync(b => b.UserId == user.Id);
            Assert.Null(enrollment);

            // AuditLog must be appended
            var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.ActorUserId == user.Id);
            Assert.NotNull(audit);
            Assert.Equal("USER_REGISTERED", audit.Action);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task AuthService_RegisterWithDetailsAsync_RejectsLdrrmoAdmin_SelfRegistration()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        var request = new RegisterRequest(
            Email: "rogue.admin@resqtrack.gov.ph",
            Password: "SecurePassword123!@#",
            FullName: "Admin, Rogue",
            ConfirmPassword: "SecurePassword123!@#",
            DisplayName: "fake_admin",
            FirstName: "Rogue",
            Surname: "Admin",
            Role: UserRole.LDRRMO_Admin,
            Unit: ResponderUnitType.None,
            ConsentAccepted: true);

        var (success, error, statusCode, errorCode, user, response) = await authService.RegisterWithDetailsAsync(request, Path.GetTempPath());

        Assert.False(success);
        Assert.Null(user);
        Assert.Null(response);
        Assert.Equal(403, statusCode);
        Assert.Equal("ROLE_FORBIDDEN", errorCode);
    }

    [Fact]
    public async Task AuthService_RegisterWithDetailsAsync_RejectsDuplicateEmail()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        // Pre-seed user
        var (hash, salt) = ScryptPasswordHelper.HashPassword("Password123!@#");
        db.Users.Add(new User
        {
            Email = "existing.citizen@resqtrack.gov.ph",
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var request = new RegisterRequest(
            Email: "existing.citizen@resqtrack.gov.ph",
            Password: "SecurePassword123!@#",
            FullName: "Clara, Maria",
            ConfirmPassword: "SecurePassword123!@#",
            DisplayName: "citizen2",
            FirstName: "Maria",
            Surname: "Clara",
            Role: UserRole.Civilian,
            Unit: ResponderUnitType.None,
            ConsentAccepted: true);

        var (success, error, statusCode, errorCode, user, response) = await authService.RegisterWithDetailsAsync(request, Path.GetTempPath());

        Assert.False(success);
        Assert.Null(user);
        Assert.Null(response);
        Assert.Equal(409, statusCode);
        Assert.Equal("EMAIL_CONFLICT", errorCode);
    }

    [Fact]
    public async Task AuthService_RegisterWithDetailsAsync_RejectsPasswordMismatch()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        var request = new RegisterRequest(
            Email: "mismatch.test@resqtrack.gov.ph",
            Password: "SecurePassword123!@#",
            FullName: "Luna, Juan",
            ConfirmPassword: "DifferentPassword456!@#",
            DisplayName: "mismatch_user",
            FirstName: "Juan",
            Surname: "Luna",
            Role: UserRole.Civilian,
            Unit: ResponderUnitType.None,
            ConsentAccepted: true);

        var (success, error, statusCode, errorCode, user, response) = await authService.RegisterWithDetailsAsync(request, Path.GetTempPath());

        Assert.False(success);
        Assert.Null(user);
        Assert.Null(response);
        Assert.Equal(400, statusCode);
        Assert.Equal("PASSWORD_MISMATCH", errorCode);
    }

    [Fact]
    public async Task AuthService_Login_EnforcesEmailOnlyAuthentication_RejectsDisplayName()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        string rawPassword = "ValidPassword123!@#";
        var (hash, salt) = ScryptPasswordHelper.HashPassword(rawPassword);

        var user = new User
        {
            Email = "verified.medic@resqtrack.gov.ph",
            DisplayName = "rhu_medic_01",
            FullName = "Maria Santos",
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = UserRole.Responder,
            Unit = ResponderUnitType.RHU,
            Status = AccountStatus.Verified,
            IdentityVerificationStatus = "Verified",
            FacialVerificationStatus = "Verified",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        // 1. Attempt login using DisplayName as identifier -> MUST FAIL
        var dnLoginReq = new LoginRequest("rhu_medic_01", rawPassword);
        var (dnSuccess, dnError, _, dnSession) = await authService.LoginAsync(dnLoginReq, "127.0.0.1", "UnitTestAgent");
        Assert.False(dnSuccess);
        Assert.Null(dnSession);
        Assert.Contains("Invalid credentials", dnError ?? string.Empty);

        // 2. Attempt login using actual Email -> MUST SUCCEED
        var emailLoginReq = new LoginRequest("verified.medic@resqtrack.gov.ph", rawPassword);
        var (emailSuccess, emailError, _, emailSession) = await authService.LoginAsync(emailLoginReq, "127.0.0.1", "UnitTestAgent");
        Assert.True(emailSuccess, emailError);
        Assert.NotNull(emailSession);
        Assert.Equal("rhu_medic_01", emailSession.DisplayName);
        Assert.Equal("verified.medic@resqtrack.gov.ph", emailSession.Email);
    }
}

// Helper class for testing resilience decorator
internal class ThrowingIdentityVerificationProvider : IIdentityVerificationProvider
{
    public string ProviderName => "ThrowingIdentityVerificationProvider";
    public string ProviderMode => "MockThrowing";

    public Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default) =>
        throw new InvalidOperationException("Simulated failure in ThrowingIdentityVerificationProvider.");
}
