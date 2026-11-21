using Xunit;
using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Implementations;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.IncidentVision;
using Backend.Features.Services.Interfaces;
using Backend.Features.Api.DTOs;
using Backend.Features.Helpers.Infrastructure;
using Microsoft.Extensions.Configuration;
using ResQTrack.Backend.Features.Services.Biometrics;

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

        // Verify biometric mismatch never writes failed LoginAttempts that could trigger password lockout
        var failedAttempt = await db.LoginAttempts.FirstOrDefaultAsync(l => l.AccountIdentifier == user.Email && !l.Success);
        Assert.Null(failedAttempt);
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
    public async Task AuthService_BiometricLogin_NeverLocksOut_AfterRepeatedFailures_OrPriorEmailAttempts()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        var (hash, salt) = ScryptPasswordHelper.HashPassword("CorrectPassword123!@#");
        var user = new User
        {
            Email = "bio.nolockout@resqtrack.gov.ph",
            FullName = "BIO NO LOCKOUT USER",
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

        // 6 consecutive biometric mismatch attempts must NOT lock out the account
        float[] mismatch = new float[128];
        mismatch[5] = 1.0f;
        for (int i = 0; i < 6; i++)
        {
            var (failRes, failErr, _, _) = await authService.BiometricLoginAsync(
                new BiometricLoginRequest(user.Email, mismatch),
                "127.0.0.1",
                "TestAgent");
            Assert.False(failRes);
            Assert.DoesNotContain("temporarily locked", failErr ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        // Next attempt with matching live face vector MUST succeed immediately without 15-minute lockout
        float[] perfectMatch = new float[128];
        perfectMatch[0] = 1.0f;

        var (okRes, okErr, rawToken, session) = await authService.BiometricLoginAsync(
            new BiometricLoginRequest(user.Email, perfectMatch),
            "127.0.0.1",
            "TestAgent");

        Assert.True(okRes, $"Expected biometric login to succeed without lockout, got error: {okErr}");
        Assert.Null(okErr);
        Assert.False(string.IsNullOrWhiteSpace(rawToken));
        Assert.NotNull(session);
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

    [Fact]
    public async Task MultiLayerBiometricLoginStrategy_1ToN_DeduplicatesClonedGalleries_SoEarlierDistinctAccountMatches()
    {
        using var db = CreateInMemoryDbContext();
        var (hash, salt) = ScryptPasswordHelper.HashPassword("StrongPass123!@#");

        string tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
        string suicoPoseJson = $"{{\"bestFrames\":{{\"CENTER\":\"{tinyPng}\"}},\"poseTag\":\"SUICO_DISTINCT_FRAME\"}}";

        var suicoUser = new User
        {
            Email = "suico.real@gmail.com",
            FullName = "JHONMARK SUICO",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        db.Users.Add(suicoUser);

        float[] suicoVec = new float[128];
        suicoVec[42] = 1.0f;
        byte[] suicoBytes = new byte[128 * sizeof(float)];
        Buffer.BlockCopy(suicoVec, 0, suicoBytes, 0, suicoBytes.Length);

        db.BiometricEnrollments.Add(new BiometricEnrollment
        {
            UserId = suicoUser.Id,
            EncryptedTemplateData = suicoBytes,
            PoseFramesJson = suicoPoseJson,
            TemplateFormat = "128D_FLOAT32_NORMALIZED",
            ModelIdentifier = "ClaudeVision-128D-MultiPose-v2",
            ModelVersion = "v1.0.0",
            EnrollmentStatus = "ACTIVE",
            EnrolledAtUtc = DateTime.UtcNow.AddDays(-2)
        });

        // Seed 20 newer cloned enrollments sharing an identical synthetic pose payload & vector
        float[] cloneVec = new float[128];
        cloneVec[0] = 1.0f;
        byte[] cloneBytes = new byte[128 * sizeof(float)];
        Buffer.BlockCopy(cloneVec, 0, cloneBytes, 0, cloneBytes.Length);

        for (int i = 0; i < 20; i++)
        {
            var cloneUser = new User
            {
                Email = $"clone.{i}@katipunan.local",
                FullName = $"Clone Test {i}",
                Role = UserRole.Civilian,
                Status = AccountStatus.Verified,
                FaceVerified = true,
                PasswordHash = hash,
                PasswordSalt = salt
            };
            db.Users.Add(cloneUser);
            db.BiometricEnrollments.Add(new BiometricEnrollment
            {
                UserId = cloneUser.Id,
                EncryptedTemplateData = cloneBytes,
                PoseFramesJson = $"{{\"capturedAtUtc\":\"2026-11-16T00:00:{i:D2}Z\",\"bestFrames\":{{\"CENTER\":\"{tinyPng}\"}},\"poseTag\":\"CLONE_ELENA\"}}",
                TemplateFormat = "128D_FLOAT32_NORMALIZED",
                ModelIdentifier = "ClaudeVision-128D-MultiPose-v2",
                ModelVersion = "v1.0.0",
                EnrollmentStatus = "ACTIVE",
                EnrolledAtUtc = DateTime.UtcNow.AddMinutes(-i)
            });
        }

        await db.SaveChangesAsync();

        var stubClaude = new TargetPoseMatchingClaudeStub("SUICO_DISTINCT_FRAME");
        var strategy = new MultiLayerBiometricLoginStrategy(db, claudeBiometricStrategy: stubClaude);

        // Live vector closer to clone[0] than SUICO's distinct vec[42] — Claude 1:N must still evaluate SUICO via deduplication!
        float[] noisyLiveVec = new float[128];
        noisyLiveVec[0] = 0.85f;
        noisyLiveVec[42] = 0.25f;

        var evalResult = await strategy.ExecuteLayersAsync(new BiometricMultiLayerContext
        {
            Email = null,
            LiveDescriptorVector = noisyLiveVec,
            LiveCaptureBase64 = tinyPng,
            LiveCaptureFramesBase64 = [tinyPng],
            LivenessScore = 0.94,
            PortalOrigin = "ResponderCivilian"
        });

        Assert.True(evalResult.IsValidated, $"Expected SUICO to match despite 20 newer clones; got failure: {evalResult.FailureReason}");
        Assert.Equal(suicoUser.Id, evalResult.MatchedUserId);
    }

    [Fact]
    public async Task MultiLayerBiometricLoginStrategy_IgnoresFrameCountsKey_MatchesDistinctCenterBase64()
    {
        using var db = CreateInMemoryDbContext();
        var (hash, salt) = ScryptPasswordHelper.HashPassword("StrongPass123!@#");

        string tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
        string distinctTargetPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mNk+M9QzwAEjDAGNzYAAIoaB/5t7s6NAAAAAElFTkSuQmCC";

        float[] sharedVec = new float[128];
        sharedVec[0] = 1.0f;
        byte[] sharedBytes = new byte[128 * sizeof(float)];
        Buffer.BlockCopy(sharedVec, 0, sharedBytes, 0, sharedBytes.Length);

        var targetUser = new User
        {
            Email = "suico.target@gmail.com",
            FullName = "SUICO TARGET",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        db.Users.Add(targetUser);
        db.BiometricEnrollments.Add(new BiometricEnrollment
        {
            UserId = targetUser.Id,
            EncryptedTemplateData = sharedBytes,
            PoseFramesJson = $"{{\"frameCounts\":{{\"CENTER\":60,\"RIGHT\":60}},\"bestFrames\":{{\"CENTER\":\"{distinctTargetPng}\"}},\"marker\":\"TARGET_MARKER\"}}",
            EnrollmentStatus = "ACTIVE",
            EnrolledAtUtc = DateTime.UtcNow.AddDays(-1)
        });

        for (int i = 0; i < 16; i++)
        {
            var clone = new User
            {
                Email = $"clone.fc.{i}@katipunan.local",
                FullName = $"Clone {i}",
                Role = UserRole.Civilian,
                Status = AccountStatus.Verified,
                FaceVerified = true,
                PasswordHash = hash,
                PasswordSalt = salt
            };
            db.Users.Add(clone);
            db.BiometricEnrollments.Add(new BiometricEnrollment
            {
                UserId = clone.Id,
                EncryptedTemplateData = sharedBytes,
                PoseFramesJson = $"{{\"frameCounts\":{{\"CENTER\":60,\"RIGHT\":60}},\"bestFrames\":{{\"CENTER\":\"{tinyPng}\"}},\"idx\":{i}}}",
                EnrollmentStatus = "ACTIVE",
                EnrolledAtUtc = DateTime.UtcNow.AddMinutes(-i)
            });
        }

        await db.SaveChangesAsync();

        var strategy = new MultiLayerBiometricLoginStrategy(db, claudeBiometricStrategy: new TargetPoseMatchingClaudeStub("TARGET_MARKER"));
        var eval = await strategy.ExecuteLayersAsync(new BiometricMultiLayerContext
        {
            Email = null,
            LiveDescriptorVector = sharedVec,
            LiveCaptureBase64 = tinyPng,
            LiveCaptureFramesBase64 = [tinyPng],
            LivenessScore = 0.94,
            PortalOrigin = "ResponderCivilian"
        });

        Assert.True(eval.IsValidated, $"Target user missed due to frameCounts collision: {eval.FailureReason}");
        Assert.Equal(targetUser.Id, eval.MatchedUserId);
    }

    [Fact]
    public async Task MultiLayerBiometricLoginStrategy_HybridClaudeUnavailable_FallsBackTo128DCosine()
    {
        using var db = CreateInMemoryDbContext();
        var (hash, salt) = ScryptPasswordHelper.HashPassword("StrongPass123!@#");
        string tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";

        float[] vec = new float[128];
        vec[3] = 1.0f;
        byte[] bytes = new byte[128 * sizeof(float)];
        Buffer.BlockCopy(vec, 0, bytes, 0, bytes.Length);

        var user = new User
        {
            Email = "cosine.fallback@resqtrack.gov.ph",
            FullName = "Fallback User",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        db.Users.Add(user);
        db.BiometricEnrollments.Add(new BiometricEnrollment
        {
            UserId = user.Id,
            EncryptedTemplateData = bytes,
            PoseFramesJson = $"{{\"bestFrames\":{{\"CENTER\":\"{tinyPng}\"}}}}",
            EnrollmentStatus = "ACTIVE",
            EnrolledAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var strategy = new MultiLayerBiometricLoginStrategy(db, claudeBiometricStrategy: new UnavailableClaudeStub());
        var eval = await strategy.ExecuteLayersAsync(new BiometricMultiLayerContext
        {
            Email = user.Email,
            LiveDescriptorVector = vec,
            LiveCaptureBase64 = tinyPng,
            LiveCaptureFramesBase64 = [tinyPng],
            LivenessScore = 0.94,
            PortalOrigin = "ResponderCivilian"
        });

        Assert.True(eval.IsValidated, $"Expected 128-D cosine fallback when Claude returns PROVIDER_UNAVAILABLE, got: {eval.FailureReason}");
        Assert.Equal(user.Id, eval.MatchedUserId);
    }

    [Fact]
    public async Task ReportService_CreateReport_CapturesContactAndEnforcesInitialReportedStatus_WithImage()
    {
        using var db = CreateInMemoryDbContext();
        var (hash, salt) = ScryptPasswordHelper.HashPassword("StrongPass123!@#");
        var reporter = new User
        {
            Email = "resident.red@resqtrack.gov.ph",
            FullName = "Resident Red",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        db.Users.Add(reporter);
        await db.SaveChangesAsync();

        var reportRepo = new ReportRepository(db);
        var userRepo = new UserRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var reportService = new ReportService(reportRepo, userRepo, auditRepo);

        string tempDir = Path.Combine(Path.GetTempPath(), "resq_red_reports_" + Guid.NewGuid().ToString("N"));
        try
        {
            string tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
            var created = await reportService.CreateReportAsync(
                reporter.Id,
                new CreateReportRequest(
                    Title: "Highway Collision",
                    Note: "Car crash near junction",
                    Category: IncidentCategory.VehicularAccident,
                    Severity: IncidentSeverity.High,
                    Latitude: 8.5147,
                    Longitude: 123.2842,
                    GpsAccuracyMeters: 8.0,
                    IsHardwareGeolocated: true,
                    IsBlurry: false,
                    RequiresManualVerification: false,
                    LocationLabel: "Barangay Uno",
                    ImageDataUrl: tinyPng,
                    ReporterContactNumber: "09171112233"),
                tempDir,
                submittedIpAddress: "203.0.113.45");

            Assert.Equal(ReportStatus.Reported, created.Status);
            Assert.Null(created.VerifiedAt);
            Assert.Equal("203.0.113.45", created.SubmittedIpAddress);
            Assert.Equal("09171112233", created.ReporterContactNumber);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task ReportService_OutOfRangeEnumCategoryZero_NormalizesToDefinedCategory()
    {
        using var db = CreateInMemoryDbContext();
        var (hash, salt) = ScryptPasswordHelper.HashPassword("StrongPass123!@#");
        var reporter = new User
        {
            Email = "enum.guard@resqtrack.gov.ph",
            FullName = "Enum Guard Resident",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        db.Users.Add(reporter);
        await db.SaveChangesAsync();

        var reportRepo = new ReportRepository(db);
        var userRepo = new UserRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var reportService = new ReportService(reportRepo, userRepo, auditRepo);

        string tempDir = Path.Combine(Path.GetTempPath(), "resq_enum_guard_" + Guid.NewGuid().ToString("N"));
        try
        {
            var created = await reportService.CreateReportAsync(
                reporter.Id,
                new CreateReportRequest(
                    Title: "Out of Range Enum Test",
                    Note: "Testing zero enum normalization",
                    Category: (IncidentCategory)0,
                    Severity: (IncidentSeverity)999,
                    Latitude: 8.5147,
                    Longitude: 123.2842,
                    GpsAccuracyMeters: 5.0,
                    IsHardwareGeolocated: true,
                    IsBlurry: false,
                    RequiresManualVerification: true,
                    LocationLabel: "Barangay Uno, Katipunan",
                    ImageDataUrl: null,
                    ReporterContactNumber: "09171112233"),
                tempDir);

            Assert.True(Enum.IsDefined(created.Category));
            Assert.Equal(IncidentCategory.VehicularAccident, created.Category);
            Assert.True(Enum.IsDefined(created.Severity));
            Assert.Equal(IncidentSeverity.Medium, created.Severity);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public void ClientNetworkHelper_RejectsSpoofedXssAndSqlInjectionHeaders_AcceptsValidIp()
    {
        var spoofedCtx = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        spoofedCtx.Request.Headers["X-Forwarded-For"] = "<script>alert(1)</script>, ' OR 1=1 --";
        spoofedCtx.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");

        string? resolvedFromSpoofed = ClientNetworkHelper.ResolveClientIpAddress(spoofedCtx);
        Assert.Equal("127.0.0.1", resolvedFromSpoofed);

        var validCtx = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        validCtx.Request.Headers["X-Forwarded-For"] = "203.0.113.77, 10.0.0.1";
        validCtx.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");

        string? resolvedFromValid = ClientNetworkHelper.ResolveClientIpAddress(validCtx);
        Assert.Equal("203.0.113.77", resolvedFromValid);
    }

    [Fact]
    public async Task CaptureStorageHelper_BlocksPathTraversalAndConfigFiles()
    {
        Assert.False(CaptureStorageHelper.IsPathWithinAllowedRoots("appsettings.json"));
        Assert.False(CaptureStorageHelper.IsPathWithinAllowedRoots("appsettings.Development.json"));
        Assert.False(CaptureStorageHelper.IsPathWithinAllowedRoots(".env"));
        Assert.False(CaptureStorageHelper.IsPathWithinAllowedRoots("Program.cs"));
        Assert.False(CaptureStorageHelper.IsPathWithinAllowedRoots("../../appsettings.json"));

        string allowedUploadPath = Path.Combine(Directory.GetCurrentDirectory(), "server-data", "uploads", "captures", "test_capture.png.enc");
        Assert.True(CaptureStorageHelper.IsPathWithinAllowedRoots(allowedUploadPath));

        var (fallbackBytes, contentType) = await CaptureStorageHelper.ReadCaptureFileAsync("appsettings.json");
        Assert.Equal("image/png", contentType);
        Assert.True(CaptureStorageHelper.ValidatePngHeader(fallbackBytes));
    }

    [Fact]
    public async Task IdentityAiService_GetBiometricTrainingStatus_NonExistentEmailReturnsNotReady()
    {
        using var db = CreateInMemoryDbContext();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<IdentityAiService>.Instance;
        var service = new IdentityAiService(new DummyHttpClientFactory(), config, logger, db: db);

        var status = await service.GetBiometricTrainingStatusAsync("nonexistent.account@resqtrack.gov.ph");
        Assert.False(status.Exists);
        Assert.False(status.Found);
        Assert.False(status.HasBiometricEnrollment);
        Assert.False(status.IsReady);
        Assert.False(status.Ready);
        Assert.Equal("NONE", status.TrainingStatus);
        Assert.Equal("NONE", status.BiometricTrainingStatus);
    }

    [Fact]
    public async Task RoboflowServerlessAccidentDetectionStrategy_UsesBearerAuthorizationHeader_AndNeverQueryStringApiKey()
    {
        HttpRequestMessage? capturedRequest = null;
        var handler = new DelegatingCallbackHandler(req =>
        {
            capturedRequest = req;
            const string json = """
                {
                  "predictions": [
                    { "class": "Accident", "confidence": 0.93 }
                  ]
                }
                """;
            return new System.Net.Http.HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json")
            };
        });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Roboflow:ApiKey"] = "rf_test_secret_header_only_key"
            })
            .Build();

        var strategy = new RoboflowServerlessAccidentDetectionStrategy(
            new System.Net.Http.HttpClient(handler),
            config);

        string tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
        var result = await strategy.DetectAccidentAsync(new RoboflowAccidentDetectionInput(
            ImageDataUrl: tinyPng,
            TitleHint: "Highway collision",
            CategoryHint: "VehicularAccident"));

        Assert.NotNull(capturedRequest);
        Assert.Equal("https://serverless.roboflow.com/accident-and-non-accident-label-image-dataset/14", capturedRequest!.RequestUri?.ToString());
        Assert.DoesNotContain("api_key", capturedRequest.RequestUri?.Query ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        Assert.NotNull(capturedRequest.Headers.Authorization);
        Assert.Equal("Bearer", capturedRequest.Headers.Authorization!.Scheme);
        Assert.Equal("rf_test_secret_header_only_key", capturedRequest.Headers.Authorization.Parameter);

        Assert.Equal("accident-and-non-accident-label-image-dataset/14", result.ModelId);
        Assert.Equal("Accident", result.Prediction);
        Assert.Equal(0.93, result.Confidence);
        Assert.False(result.NeedsReview);
        Assert.Equal("Authorization: Bearer (header)", result.AuthTransport);
    }

    [Fact]
    public async Task DualStageIncidentSceneAiStrategy_CombinesRoboflowAndClaudeHaiku45_MapsPointerIcons_AndEnforcesPendingReview()
    {
        var roboflowStub = new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
            ModelId: "accident-and-non-accident-label-image-dataset/14",
            Prediction: "Accident",
            Confidence: 0.91,
            NeedsReview: false,
            AuthTransport: "Authorization: Bearer (header)",
            RawJson: "{\"predictions\":[{\"class\":\"Accident\",\"confidence\":0.91}]}"));

        var claudeClientStub = new CapturingClaudeMessagesClient(
            modelUsed: "claude-haiku-4-5-20251001",
            rawResponseJson: """
                {"isGenuineIncident":true,"detectedCategory":"StructuralFire","recommendedSeverity":"Critical","pointerIconType":"fire","situationDescription":"Active two-story commercial structure fire with dense black smoke plume.","visibleHazards":"Flames near overhead power lines, dense smoke across national highway","uncertaintyNotes":"Rear alley egress not visible from single camera frame; requires BFP dispatcher confirmation."}
                """);

        var claudeStrategy = new ClaudeHaikuIncidentVisionStrategy(claudeClientStub);
        var dualStrategy = new DualStageIncidentSceneAiStrategy(roboflowStub, claudeStrategy);

        string tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
        var analysis = await dualStrategy.AnalyzeAsync(new AnalyzeIncidentImageRequest(
            ImageDataUrl: tinyPng,
            TitleHint: "Market Fire <script>ignore</script>",
            NoteHint: "Heavy smoke near public market",
            CategoryHint: "StructuralFire"));

        Assert.Equal("claude-haiku-4-5-20251001", claudeClientStub.LastModelOverride);
        Assert.Equal(
            "<untrusted_user_query>Market Fire scriptignore/script</untrusted_user_query>",
            ClaudeHaikuIncidentVisionStrategy.IsolateUntrustedUserHint("Market Fire <script>ignore</script>"));
        Assert.Contains("untrusted_user_query", claudeClientStub.LastSerializedPayload ?? string.Empty);
        Assert.Contains("Market Fire scriptignore/script", claudeClientStub.LastSerializedPayload ?? string.Empty);

        Assert.Equal("accident-and-non-accident-label-image-dataset/14", analysis.RoboflowModelId);
        Assert.Equal("Accident", analysis.RoboflowPrediction);
        Assert.Equal(0.91, analysis.RoboflowConfidence);
        Assert.Equal("Authorization: Bearer (header)", analysis.RoboflowAuthTransport);
        Assert.Equal("claude-haiku-4-5-20251001", analysis.ClaudeModelUsed);
        Assert.True(analysis.IsGenuineIncident);
        Assert.Equal("StructuralFire", analysis.DetectedCategory);
        Assert.Equal("Critical", analysis.RecommendedSeverity);
        Assert.Equal("fire", analysis.PointerIconType);
        Assert.Equal("PENDING_REVIEW", analysis.VerificationStatus);
        Assert.Equal("FIRE (BFP)", analysis.RecommendedAgencyUnit);

        Assert.Equal("car-crash", ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon("VehicularAccident"));
        Assert.Equal("fire", ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon("StructuralFire"));
        Assert.Equal("medical", ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon("MedicalEmergency"));
        Assert.Equal("crime", ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon("CrimeOrSecurity"));
        Assert.Equal("flood", ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon("NaturalDisaster"));
        Assert.Equal("hazard", ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon("HazardFixture"));
    }

    [Fact]
    public async Task ReportService_CreateReportAsync_PersistsRoboflowAndClaudeHaikuFields_WhileKeepingStatusReported()
    {
        using var db = CreateInMemoryDbContext();
        var (hash, salt) = ScryptPasswordHelper.HashPassword("StrongPass123!@#");
        var reporter = new User
        {
            Email = "vision.reporter@resqtrack.gov.ph",
            FullName = "Vision Reporter",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };
        db.Users.Add(reporter);
        await db.SaveChangesAsync();

        var reportRepo = new ReportRepository(db);
        var userRepo = new UserRepository(db);
        var auditRepo = new AuditLogRepository(db);

        var roboflowStub = new StubRoboflowStrategy(new RoboflowAccidentDetectionResult(
            ModelId: "accident-and-non-accident-label-image-dataset/14",
            Prediction: "Accident",
            Confidence: 0.94,
            NeedsReview: false,
            AuthTransport: "Authorization: Bearer (header)",
            RawJson: "{\"predictions\":[{\"class\":\"Accident\",\"confidence\":0.94}]}"));

        var claudeClientStub = new CapturingClaudeMessagesClient(
            modelUsed: "claude-haiku-4-5-20251001",
            rawResponseJson: """
                {"isGenuineIncident":true,"detectedCategory":"VehicularAccident","recommendedSeverity":"High","pointerIconType":"car-crash","situationDescription":"Multi-vehicle collision blocking north lane in Barangay Uno.","visibleHazards":"Shattered glass, spilled coolant, lane blockage","uncertaintyNotes":"Number of vehicle occupants unclear from exterior angle."}
                """);

        var dualStrategy = new DualStageIncidentSceneAiStrategy(
            roboflowStub,
            new ClaudeHaikuIncidentVisionStrategy(claudeClientStub));

        var reportService = new ReportService(reportRepo, userRepo, auditRepo, dualStrategy);

        string tempDir = Path.Combine(Path.GetTempPath(), "resq_vision_reports_" + Guid.NewGuid().ToString("N"));
        try
        {
            string tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
            var created = await reportService.CreateReportAsync(
                reporter.Id,
                new CreateReportRequest(
                    Title: "Highway Collision",
                    Note: "Two vehicles collided at junction",
                    Category: IncidentCategory.VehicularAccident,
                    Severity: IncidentSeverity.High,
                    Latitude: 8.5147,
                    Longitude: 123.2842,
                    GpsAccuracyMeters: 6.5,
                    IsHardwareGeolocated: true,
                    IsBlurry: false,
                    RequiresManualVerification: false,
                    LocationLabel: "Barangay Uno, Katipunan",
                    ImageDataUrl: tinyPng,
                    ReporterContactNumber: "09171234567"),
                tempDir,
                submittedIpAddress: "203.0.113.88");

            // Mandatory Governance Invariant: AI analysis NEVER auto-verifies a report
            Assert.Equal(ReportStatus.Reported, created.Status);
            Assert.Null(created.VerifiedAt);
            Assert.True(created.RequiresManualVerification);

            // Both Roboflow Stage 1 and Claude Haiku 4.5 Stage 2 metadata must persist
            Assert.Equal("accident-and-non-accident-label-image-dataset/14", created.RoboflowModelId);
            Assert.Equal("Accident", created.RoboflowPrediction);
            Assert.Equal(0.94, created.RoboflowConfidence);
            Assert.False(created.RoboflowNeedsReview);
            Assert.Equal("claude-haiku-4-5-20251001", created.ClaudeModelUsed);
            Assert.Equal("VehicularAccident", created.ClaudeIncidentCategory);
            Assert.Contains("Multi-vehicle collision", created.ClaudeSituationSummary);
            Assert.Contains("Shattered glass", created.ClaudeVisibleHazards);
            Assert.Contains("occupants unclear", created.ClaudeUncertaintyNotes);
            Assert.Equal("car-crash", created.PointerIconType);

            var persistedEntity = await db.Reports.FirstOrDefaultAsync(r => r.Id == created.Id);
            Assert.NotNull(persistedEntity);
            Assert.Equal(ReportStatus.Reported, persistedEntity!.Status);
            Assert.Null(persistedEntity.VerifiedAt);
            Assert.True(persistedEntity.RequiresManualVerification);
            Assert.Equal("car-crash", persistedEntity.PointerIconType);
            Assert.False(string.IsNullOrWhiteSpace(persistedEntity.AiAnalysisJson));
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    private sealed class UnavailableClaudeStub : IClaudeBiometricIdentityStrategy
    {
        public bool IsConfigured => true;

        public Task<ClaudeBiometricIdentityResult> VerifyLiveAgainstCachedPosesAsync(
            ClaudeBiometricIdentityInput input,
            CancellationToken ct = default) =>
            Task.FromResult(new ClaudeBiometricIdentityResult(
                SamePerson: false,
                IsLiveHuman: false,
                Similarity: 0.0,
                ModelUsed: "claude-sonnet-4-6",
                Reason: "Simulated transient timeout",
                ErrorCode: "PROVIDER_UNAVAILABLE"));
    }

    private sealed class TargetPoseMatchingClaudeStub(string targetMarker) : IClaudeBiometricIdentityStrategy
    {
        public bool IsConfigured => true;

        public Task<ClaudeBiometricIdentityResult> VerifyLiveAgainstCachedPosesAsync(
            ClaudeBiometricIdentityInput input,
            CancellationToken ct = default)
        {
            bool isTarget = input.PoseFramesJson?.Contains(targetMarker, StringComparison.Ordinal) == true;
            return Task.FromResult(new ClaudeBiometricIdentityResult(
                SamePerson: isTarget,
                IsLiveHuman: true,
                Similarity: isTarget ? 0.95 : 0.12,
                ModelUsed: "claude-sonnet-4-6",
                Reason: isTarget ? "Matched target identity." : "Different person."));
        }
    }

    private sealed class DummyHttpClientFactory : System.Net.Http.IHttpClientFactory
    {
        public System.Net.Http.HttpClient CreateClient(string name) => new();
    }

    private sealed class DelegatingCallbackHandler(
        Func<System.Net.Http.HttpRequestMessage, System.Net.Http.HttpResponseMessage> handler)
        : System.Net.Http.HttpMessageHandler
    {
        protected override Task<System.Net.Http.HttpResponseMessage> SendAsync(
            System.Net.Http.HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromResult(handler(request));
    }

    private sealed class StubRoboflowStrategy(RoboflowAccidentDetectionResult fixedResult)
        : IRoboflowAccidentDetectionStrategy
    {
        public Task<RoboflowAccidentDetectionResult> DetectAccidentAsync(
            RoboflowAccidentDetectionInput input,
            CancellationToken ct = default) =>
            Task.FromResult(fixedResult);
    }

    private sealed class CapturingClaudeMessagesClient(string modelUsed, string rawResponseJson)
        : IClaudeMessagesClient
    {
        public bool IsConfigured => true;
        public string PrimaryModel => "claude-sonnet-4-6";
        public string FallbackModel => "claude-sonnet-5-5";
        public string? LastModelOverride { get; private set; }
        public string? LastSerializedPayload { get; private set; }

        public Task<ClaudeMessageAttemptResult> SendMessagesAsync(
            IReadOnlyDictionary<string, object> payloadWithoutModel,
            CancellationToken ct = default,
            string? modelOverride = null)
        {
            LastModelOverride = modelOverride;
            LastSerializedPayload = System.Text.Json.JsonSerializer.Serialize(payloadWithoutModel);
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
}
