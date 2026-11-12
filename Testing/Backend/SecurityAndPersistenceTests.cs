using Xunit;
using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Implementations;
using Backend.Features.Services.Implementations;
using Backend.Features.Api.DTOs;
using Backend.Features.Helpers.Infrastructure;

namespace Backend.Tests;

public class SecurityAndPersistenceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public void PasswordHelper_VerifyPassword_ValidatesPbkdf2Hash()
    {
        string password = "TestPassword123!@#";
        var (hash, salt) = ScryptPasswordHelper.HashPassword(password);

        Assert.NotNull(hash);
        Assert.NotNull(salt);
        Assert.True(ScryptPasswordHelper.VerifyPassword(password, hash, salt));
        Assert.False(ScryptPasswordHelper.VerifyPassword("WrongPassword123!", hash, salt));
    }

    [Fact]
    public void PasswordHelper_PasswordUnder12Chars_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() => ScryptPasswordHelper.HashPassword("Short1!"));
    }

    [Fact]
    public async Task AuthService_Registration_DoesNotAutoVerifyOnImageUpload()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo);

        string tempFolder = Path.Combine(Path.GetTempPath(), "resqtrack_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempFolder);

        try
        {
            // Valid PNG base64 data url
            string dummyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

            var request = new RegisterRequest(
                Email: "citizen.test@resqtrack.gov.ph",
                Password: "SecurePassword123!@#",
                FullName: "SALIWAN, ART LEVIN TORILLA",
                PhoneNumber: "+639171234567",
                EmployeeOrResidentId: "RES-7109-001",
                ValidIdType: "drivers",
                Role: UserRole.Civilian,
                Unit: ResponderUnitType.None,
                DepartmentOrBarangay: "Langatian",
                RankOrTitle: "Resident",
                IdCaptureDataUrl: dummyPng,
                FaceCaptureDataUrl: dummyPng,
                Sex: "Male",
                Age: 20,
                GovernmentIdType: "drivers",
                GovernmentIdNumber: "J01-24-005544",
                MiddleName: "TORILLA",
                DateOfBirth: new DateTime(2004, 8, 27, 0, 0, 0, DateTimeKind.Utc),
                Province: "Zamboanga del Norte",
                CityOrMunicipality: "Pres. Manuel A. Roxas",
                Barangay: "Langatian",
                StreetOrPurok: "Purok 2",
                Weight: "84",
                Height: "1.70"
            );

            var (success, error, user) = await authService.RegisterAsync(request, tempFolder);

            Assert.True(success, $"Registration failed with error: {error}");
            Assert.NotNull(user);

            // CRITICAL SECURITY RULE: Zero client-trusted verification. Must be Pending until approved.
            Assert.Equal(AccountStatus.Pending, user.Status);
            Assert.False(user.FaceVerified);

            // DATA INTEGRITY RULES: All fields must round-trip accurately.
            Assert.Equal("TORILLA", user.MiddleName);
            Assert.Equal(new DateTime(2004, 8, 27, 0, 0, 0, DateTimeKind.Utc), user.DateOfBirth);
            Assert.Equal("Pres. Manuel A. Roxas", user.CityOrMunicipality);
            Assert.Equal("Langatian", user.Barangay);
            Assert.Equal("Purok 2", user.StreetOrPurok);
            Assert.Equal("84", user.Weight);
            Assert.Equal("1.70", user.Height);
        }
        finally
        {
            if (Directory.Exists(tempFolder)) Directory.Delete(tempFolder, true);
        }
    }

    [Fact]
    public async Task CaptureStorageHelper_EncryptedStorage_EncryptsOnDiskAndDecryptsOnRead()
    {
        string tempFolder = Path.Combine(Path.GetTempPath(), "resqtrack_crypto_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempFolder);

        try
        {
            string dummyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
            string? savedPath = await CaptureStorageHelper.SaveCaptureDataUrlAsync(dummyPng, tempFolder, "SEC_TEST");

            Assert.NotNull(savedPath);
            Assert.True(File.Exists(savedPath));

            // On disk, file MUST NOT start with raw PNG magic bytes 0x89 0x50 0x4E 0x47 (Must be AES-256 encrypted)
            byte[] rawDiskBytes = await File.ReadAllBytesAsync(savedPath);
            bool startsWithPngMagic = rawDiskBytes.Length >= 4 &&
                                     rawDiskBytes[0] == 0x89 && rawDiskBytes[1] == 0x50 &&
                                     rawDiskBytes[2] == 0x4E && rawDiskBytes[3] == 0x47;
            Assert.False(startsWithPngMagic, "Security Violation: Stored file on disk is unencrypted plaintext PNG!");

            // Decrypted read MUST restore valid PNG bytes
            var (decryptedBytes, contentType) = await CaptureStorageHelper.ReadCaptureFileAsync(savedPath);
            Assert.Equal("image/png", contentType);
            Assert.True(CaptureStorageHelper.ValidatePngHeader(decryptedBytes), "Decrypted bytes must restore valid PNG header.");
        }
        finally
        {
            if (Directory.Exists(tempFolder)) Directory.Delete(tempFolder, true);
        }
    }

    [Fact]
    public async Task AuthService_Registration_PersistsConsentAndBiometricEnrollment_WhenDbProvided()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        string tempFolder = Path.Combine(Path.GetTempPath(), "resqtrack_consent_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempFolder);

        try
        {
            string dummyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
            float[] sample128DVector = new float[128];
            for (int i = 0; i < 128; i++) sample128DVector[i] = 0.123f;

            var request = new RegisterRequest(
                Email: "consent.test@resqtrack.gov.ph",
                Password: "SecurePassword123!@#",
                FullName: "TEST, CONSENT USER",
                PhoneNumber: "+639171234567",
                EmployeeOrResidentId: "RES-7109-002",
                ValidIdType: "drivers",
                Role: UserRole.Civilian,
                Unit: ResponderUnitType.None,
                DepartmentOrBarangay: "Matunoy",
                RankOrTitle: "Resident",
                IdCaptureDataUrl: dummyPng,
                FaceCaptureDataUrl: dummyPng,
                IdBackCaptureDataUrl: dummyPng,
                ConsentNoticeVersion: "v1.2-katipunan",
                BiometricDescriptorVector: sample128DVector
            );

            var (success, error, user) = await authService.RegisterAsync(request, tempFolder);
            Assert.True(success, error);
            Assert.NotNull(user);

            // Verify UserConsent was saved in database
            var savedConsent = await db.UserConsents.FirstOrDefaultAsync(c => c.UserId == user.Id);
            Assert.NotNull(savedConsent);
            Assert.Equal("v1.2-katipunan", savedConsent.NoticeVersion);
            Assert.Equal("EXPLICIT_OPT_IN", savedConsent.UserAction);

            // Verify BiometricEnrollment was saved in database with template data
            var savedEnrollment = await db.BiometricEnrollments.FirstOrDefaultAsync(b => b.UserId == user.Id);
            Assert.NotNull(savedEnrollment);
            Assert.Equal(128 * 4, savedEnrollment.EncryptedTemplateData.Length);
            Assert.Equal("128D_FLOAT32_NORMALIZED", savedEnrollment.TemplateFormat);
            Assert.True(savedEnrollment.IsActive);

            // Verify IdentityVerificationRecord was saved in database
            var savedRecord = await db.IdentityVerificationRecords.FirstOrDefaultAsync(r => r.UserId == user.Id);
            Assert.NotNull(savedRecord);
            Assert.Equal("PENDING_REVIEW", savedRecord.OverallVerificationStatus);
        }
        finally
        {
            if (Directory.Exists(tempFolder)) Directory.Delete(tempFolder, true);
        }
    }

    [Fact]
    public async Task UsersController_IDOR_BlocksNonAdminNonOwner_AndAllowsOwnerOrAdmin()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var governanceService = new UserGovernanceService(userRepo, sessionRepo, auditRepo);

        var targetUser = new User
        {
            Email = "target.user@resqtrack.gov.ph",
            FullName = "TARGET USER",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified
        };
        await userRepo.AddAsync(targetUser);

        var controller = new Backend.Features.Api.Controllers.UsersController(governanceService);

        // Case 1: Unrelated Civilian (IDOR Attacker) tries to access targetUser details -> MUST RETURN 403 Forbidden
        Guid attackerId = Guid.NewGuid();
        controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext()
        };
        controller.HttpContext.Items["UserId"] = attackerId;
        controller.HttpContext.Items["UserRole"] = UserRole.Civilian;

        var result1 = await controller.GetUserDetailAsync(targetUser.Id, default);
        var forbiddenResult = Assert.IsType<Microsoft.AspNetCore.Mvc.ObjectResult>(result1);
        Assert.Equal(403, forbiddenResult.StatusCode);

        // Case 2: Target User accesses own details -> MUST RETURN 200 OK
        controller.HttpContext.Items["UserId"] = targetUser.Id;
        controller.HttpContext.Items["UserRole"] = UserRole.Civilian;

        var result2 = await controller.GetUserDetailAsync(targetUser.Id, default);
        var okResultOwner = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(result2);
        Assert.NotNull(okResultOwner.Value);

        // Case 3: LDRRMO Admin accesses target user details -> MUST RETURN 200 OK
        controller.HttpContext.Items["UserId"] = Guid.NewGuid();
        controller.HttpContext.Items["UserRole"] = UserRole.LDRRMO_Admin;

        var result3 = await controller.GetUserDetailAsync(targetUser.Id, default);
        var okResultAdmin = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(result3);
        Assert.NotNull(okResultAdmin.Value);
    }

    [Fact]
    public async Task AuthService_BiometricLogin_Validates1to1Matching_AndRejectsMismatch()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        var (hash, salt) = ScryptPasswordHelper.HashPassword("SecurePassword123!@#");
        var user = new User
        {
            Email = "biometric.user@resqtrack.gov.ph",
            FullName = "BIOMETRIC TEST USER",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        await userRepo.AddAsync(user);

        // Enroll a 128-D template (unit vector pointing along first dimension)
        float[] enrolledVector = new float[128];
        enrolledVector[0] = 1.0f;
        byte[] enrolledBytes = new byte[128 * 4];
        Buffer.BlockCopy(enrolledVector, 0, enrolledBytes, 0, enrolledBytes.Length);

        db.BiometricEnrollments.Add(new BiometricEnrollment
        {
            UserId = user.Id,
            EncryptedTemplateData = enrolledBytes,
            TemplateFormat = "128D_FLOAT32_NORMALIZED",
            ModelIdentifier = "ResQTrack_Hybrid_CSLBP_Gabor_Haar",
            ModelVersion = "v1.0.0",
            EnrollmentStatus = "ACTIVE",
            EnrolledAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // Case 1: Matching live vector (similarity ~ 1.0) -> MUST SUCCEED
        float[] matchingLiveVector = new float[128];
        matchingLiveVector[0] = 0.98f;
        matchingLiveVector[1] = 0.05f;

        var requestMatch = new BiometricLoginRequest(user.Email, matchingLiveVector);
        var (successMatch, errorMatch, rawToken, session) = await authService.BiometricLoginAsync(requestMatch, "127.0.0.1", "TestAgent");

        Assert.True(successMatch, $"Expected success but got: {errorMatch}");
        Assert.NotNull(rawToken);
        Assert.NotNull(session);
        Assert.Equal(user.Email, session.Email);

        // Case 2: Mismatching live vector (orthogonal vector pointing along dimension 10, similarity ~ 0.0) -> MUST FAIL
        float[] mismatchLiveVector = new float[128];
        mismatchLiveVector[10] = 1.0f;

        var requestMismatch = new BiometricLoginRequest(user.Email, mismatchLiveVector);
        var (successMismatch, errorMismatch, _, _) = await authService.BiometricLoginAsync(requestMismatch, "127.0.0.1", "TestAgent");

        Assert.False(successMismatch);
        Assert.Contains("mismatch", errorMismatch, StringComparison.OrdinalIgnoreCase);

        // Verify audit log attempt recorded in DB
        var failedAttempt = await db.LoginAttempts.FirstOrDefaultAsync(l => l.AccountIdentifier == user.Email && !l.Success);
        Assert.NotNull(failedAttempt);
        Assert.Contains("BIOMETRIC_MISMATCH", failedAttempt.FailureReason);
    }

    [Fact]
    public async Task AuthService_AccountLockout_BlocksAfterFiveFailedAttempts()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        var (hash, salt) = ScryptPasswordHelper.HashPassword("CorrectPassword123!@#");
        var user = new User
        {
            Email = "lockout.user@resqtrack.gov.ph",
            FullName = "LOCKOUT TEST USER",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        await userRepo.AddAsync(user);

        // Execute 5 failed password login attempts
        for (int i = 0; i < 5; i++)
        {
            var (success, _, _, _) = await authService.LoginAsync(
                new LoginRequest(user.Email, "WrongPassword123!@#", "Civilian", "Landing"),
                "127.0.0.1",
                "TestAgent");
            Assert.False(success);
        }

        // 6th attempt even with CORRECT password must be blocked by lockout
        var (lockedSuccess, lockedError, _, _) = await authService.LoginAsync(
            new LoginRequest(user.Email, "CorrectPassword123!@#", "Civilian", "Landing"),
            "127.0.0.1",
            "TestAgent");

        Assert.False(lockedSuccess);
        Assert.Contains("locked", lockedError, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthService_BiometricLogin_AccountLockout_BlocksAfterFiveBiometricFailures()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        var (hash, salt) = ScryptPasswordHelper.HashPassword("CorrectPassword123!@#");
        var user = new User
        {
            Email = "bio.lockout@resqtrack.gov.ph",
            FullName = "BIO LOCKOUT USER",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        await userRepo.AddAsync(user);

        // Enroll template along dimension 0
        float[] enrolledVector = new float[128];
        enrolledVector[0] = 1.0f;
        byte[] enrolledBytes = new byte[128 * 4];
        Buffer.BlockCopy(enrolledVector, 0, enrolledBytes, 0, enrolledBytes.Length);

        db.BiometricEnrollments.Add(new BiometricEnrollment
        {
            UserId = user.Id,
            EncryptedTemplateData = enrolledBytes,
            TemplateFormat = "128D_FLOAT32_NORMALIZED",
            ModelIdentifier = "ResQTrack_Hybrid_CSLBP_Gabor_Haar",
            ModelVersion = "v1.0.0",
            EnrollmentStatus = "ACTIVE",
            EnrolledAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // 5 consecutive mismatch attempts along orthogonal dimension
        float[] mismatch = new float[128];
        mismatch[5] = 1.0f;
        for (int i = 0; i < 5; i++)
        {
            var (failRes, _, _, _) = await authService.BiometricLoginAsync(
                new BiometricLoginRequest(user.Email, mismatch),
                "127.0.0.1",
                "TestAgent");
            Assert.False(failRes);
        }

        // 6th attempt with a 100% PERFECT matching vector MUST STILL BE LOCKED OUT
        float[] perfectMatch = new float[128];
        perfectMatch[0] = 1.0f;

        var (lockedRes, lockedErr, _, _) = await authService.BiometricLoginAsync(
            new BiometricLoginRequest(user.Email, perfectMatch),
            "127.0.0.1",
            "TestAgent");

        Assert.False(lockedRes);
        Assert.Contains("locked", lockedErr, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthService_PortEnforcement_RejectsAdminOnPort5173_AndRejectsCivilianOnPort5174()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        var (hash, salt) = ScryptPasswordHelper.HashPassword("AdminPassword123!@#");
        var adminUser = new User
        {
            Email = "admin.port@resqtrack.gov.ph",
            FullName = "ADMIN PORT TEST",
            Role = UserRole.LDRRMO_Admin,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        await userRepo.AddAsync(adminUser);

        var (civHash, civSalt) = ScryptPasswordHelper.HashPassword("CivilianPassword123!@#");
        var civUser = new User
        {
            Email = "civ.port@resqtrack.gov.ph",
            FullName = "CIV PORT TEST",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = civHash,
            PasswordSalt = civSalt
        };
        await userRepo.AddAsync(civUser);

        // Case 1: Admin attempts to login through Port 5173 ("Landing" origin) -> MUST FAIL with Access Denied
        var (adminOnLandingOk, adminOnLandingErr, _, _) = await authService.LoginAsync(
            new LoginRequest(adminUser.Email, "AdminPassword123!@#", "Admin", "Landing"),
            "127.0.0.1",
            "TestAgent");
        Assert.False(adminOnLandingOk);
        Assert.Contains("Access Denied", adminOnLandingErr);

        // Case 2: Civilian attempts to login through Port 5174 ("Admin" origin) -> MUST FAIL with Access Denied
        var (civOnAdminOk, civOnAdminErr, _, _) = await authService.LoginAsync(
            new LoginRequest(civUser.Email, "CivilianPassword123!@#", "Civilian", "Admin"),
            "127.0.0.1",
            "TestAgent");
        Assert.False(civOnAdminOk);
        Assert.Contains("Access Denied", civOnAdminErr);
    }

    [Fact]
    public async Task CaptureStorageHelper_MagicBytes_RejectsExecutableOrMalformedData()
    {
        string tempDir = Path.Combine(Path.GetTempPath(), "resqtrack_magic_bytes_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        try
        {
            // Case 1: Malformed raw string
            string? result1 = await CaptureStorageHelper.SaveCaptureDataUrlAsync("not-a-valid-data-url", tempDir, "TEST");
            Assert.Null(result1);

            // Case 2: Data URL with text content (not PNG, JPEG, or WebP magic bytes)
            string textDataUrl = "data:image/png;base64," + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("MZ_FAKE_EXECUTABLE_OR_PLAIN_TEXT"));
            string? result2 = await CaptureStorageHelper.SaveCaptureDataUrlAsync(textDataUrl, tempDir, "TEST");
            Assert.Null(result2);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task IdentityAiService_AnalyzeDocumentAsync_RecognizesVersionSideAndEnforcesPwdBiometricGuard()
    {
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<IdentityAiService>.Instance;
        var service = new IdentityAiService(new DummyHttpClientFactory(), config, logger);

        // 1. LTO 2021 New DL Codes Front
        var ltoNew = await service.AnalyzeDocumentAsync(new IdentityDocumentAnalyzeRequestDto
        {
            SelectedIdCategory = "drivers",
            FrontRawText = "REPUBLIC OF THE PHILIPPINES LAND TRANSPORTATION OFFICE DRIVER'S LICENSE DL Codes A, A1, B"
        });
        Assert.Equal("drivers", ltoNew.CategoryKey);
        Assert.Equal("LTO", ltoNew.Issuer);
        Assert.Equal("2021-dl-code-v1", ltoNew.Version);
        Assert.Equal("front", ltoNew.DetectedSide);
        Assert.Equal("not_checked", ltoNew.OfficialVerificationStatus);
        Assert.True(ltoNew.AllowBiometricProfiling);

        // 2. LTO Legacy Restrictions Front
        var ltoOld = await service.AnalyzeDocumentAsync(new IdentityDocumentAnalyzeRequestDto
        {
            SelectedIdCategory = "drivers",
            FrontRawText = "LAND TRANSPORTATION OFFICE DRIVER'S LICENSE Restrictions 1, 2"
        });
        Assert.Equal("legacy-restrictions-v1", ltoOld.Version);

        // 3. PWD Unified 2026 Card -> Must enforce AllowBiometricProfiling == false
        var pwdUnified = await service.AnalyzeDocumentAsync(new IdentityDocumentAnalyzeRequestDto
        {
            SelectedIdCategory = "pwd",
            FrontRawText = "PERSONS WITH DISABILITY NCDA AO NO. 001 UNIFIED ID"
        });
        Assert.Equal("pwd", pwdUnified.CategoryKey);
        Assert.Equal("ncda-ao001-2026-unified-v1", pwdUnified.Version);
        Assert.False(pwdUnified.AllowBiometricProfiling);
        Assert.Equal("not_checked", pwdUnified.OfficialVerificationStatus);
    }

    private sealed class DummyHttpClientFactory : System.Net.Http.IHttpClientFactory
    {
        public System.Net.Http.HttpClient CreateClient(string name) => new();
    }
}
