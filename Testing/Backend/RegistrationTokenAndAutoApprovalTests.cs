// [Layer: Testing/Backend]
// Responsibility: TDD contract tests for duplicate Front/Back rejection, wrong-slot/wrong-ID/fake-ID forensics, and Claude offline fail-closed standby strategy.
// Invariant: C# .NET 10, xUnit 2.9.3, universal lambda expressions (=>), zero hardcoded secrets, zero emojis.

using System.Net;
using System.Text;
using System.Text.Json;
using Backend.Features.Api.Controllers;
using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Implementations;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ResQTrack.Backend.Features.Services.Standby;

namespace Backend.Tests;

public class RegistrationTokenAndAutoApprovalTests
{
    private const string TestApiKeyPlaceholder = "test-anthropic-key-placeholder";

    // Valid 1x1 dark-navy PNG for Front ID fixture
    private const string FrontPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPgV/b+DwACPwF9bbBHAwAAAABJRU5ErkJggg==";

    // Valid 1x1 slate PNG (distinct SHA-256) for Back ID fixture
    private const string BackPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOo6FnwHwAFyAKkrvrnogAAAABJRU5ErkJggg==";

    // Valid 1x1 emerald PNG (distinct SHA-256) for ImagePair-B / multi-pose fixture
    private const string AltFrontPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    private static byte[] CreateFrontPngBytes() =>
        Convert.FromBase64String(FrontPngBase64);

    private static byte[] CreateBackPngBytes() =>
        Convert.FromBase64String(BackPngBase64);

    private static byte[] CreateAltFrontPngBytes() =>
        Convert.FromBase64String(AltFrontPngBase64);

    private static byte[] CreateAltBackPngBytes() =>
        CaptureStorageHelper.GenerateSyntheticFallbackPng();

    private static string CreateFrontPngDataUrl() =>
        $"data:image/png;base64,{FrontPngBase64}";

    private static string CreateBackPngDataUrl() =>
        $"data:image/png;base64,{BackPngBase64}";

    private static string CreatePngDataUrl(byte[] pngBytes) =>
        $"data:image/png;base64,{Convert.ToBase64String(pngBytes)}";

    private static HmacVerificationTokenCacheStrategy CreateTokenCacheStrategy(AppDbContext? db = null) =>
        new(Options.Create(new VerificationTokenOptions()), cache: null, db: db);

    private static (
        HmacVerificationTokenCacheStrategy TokenStrategy,
        TokenVerifiedAutoApprovalStrategy AutoApprovalStrategy,
        AuthService AuthService) CreateAuthTokenStack(AppDbContext db)
    {
        var tokenStrategy = CreateTokenCacheStrategy(db);
        var autoApprovalStrategy = new TokenVerifiedAutoApprovalStrategy(
            tokenStrategy,
            Options.Create(new VerificationTokenOptions()));
        var authService = new AuthService(
            new UserRepository(db),
            new SessionRepository(db),
            new AuditLogRepository(db),
            db,
            autoApprovalStrategy: autoApprovalStrategy,
            tokenCacheStrategy: tokenStrategy);
        return (tokenStrategy, autoApprovalStrategy, authService);
    }

    private static async Task<(string PairSha256, TokenIssueResult IdToken, TokenIssueResult FacialToken)>
        IssuePairedTokensAsync(
            IVerificationTokenCacheStrategy tokenStrategy,
            byte[] frontBytes,
            byte[] backBytes,
            double similarity = 0.91,
            string idVerdict = "VERIFIED_GENUINE")
    {
        string pairSha = tokenStrategy.ComputeImagePairSha256(frontBytes, backBytes);
        TokenIssueResult idToken = await tokenStrategy.IssueIdTokenAsync(
            imagePairSha256: pairSha,
            verdict: idVerdict,
            providerUsed: "ClaudeVision",
            modelUsed: "claude-sonnet-4-6",
            payloadJson: "{\"authenticityVerdict\":\"GENUINE_PHYSICAL_ID\"}");
        TokenIssueResult facialToken = await tokenStrategy.IssueFacialTokenAsync(
            imagePairSha256: pairSha,
            idTokenString: idToken.Token,
            faceToIdSimilarity: similarity,
            providerUsed: "ClaudeVision",
            modelUsed: "claude-sonnet-4-6",
            payloadJson: "{\"verdict\":\"LIVE_FACE_ID_MATCHED\"}");
        return (pairSha, idToken, facialToken);
    }

    private static string MutateTokenSignature(string token)
    {
        string[] parts = token.Split('.');
        Assert.Equal(2, parts.Length);
        char[] sigChars = parts[1].ToCharArray();
        sigChars[0] = sigChars[0] == 'A' ? 'B' : 'A';
        return $"{parts[0]}.{new string(sigChars)}";
    }

    private static float[] CreateNormalized128DDescriptor() =>
        Enumerable.Range(0, 128)
            .Select(i => (float)((i % 2 == 0 ? 1.0 : -1.0) / Math.Sqrt(128.0)))
            .ToArray();

    private static RegisterRequest CreateVerifiedTokenRegisterRequest(
        string email,
        UserRole role,
        ResponderUnitType unit,
        string? idVerificationToken,
        string? facialVerificationToken,
        string? frontDataUrl = null,
        string? backDataUrl = null) =>
        new(
            Email: email,
            Password: "SecurePassword123!@#",
            FullName: "MARQUEZ, ELENA",
            ConfirmPassword: "SecurePassword123!@#",
            DisplayName: $"user_{Guid.NewGuid():N}"[..20],
            FirstName: "ELENA",
            Surname: "MARQUEZ",
            Sex: "Female",
            DateOfBirth: new DateTime(1994, 3, 11),
            PhoneNumber: "+639171234567",
            Province: "Zamboanga del Norte",
            CityOrMunicipality: "Katipunan",
            Barangay: "Barangay Uno (Pob.)",
            StreetOrPurok: "Purok 2, Rizal Street",
            GovernmentIdType: "drivers",
            GovernmentIdNumber: "K09-88-776655",
            IssuingAgency: "LTO",
            Role: role,
            Unit: unit,
            ConsentAccepted: true,
            IdCaptureDataUrl: frontDataUrl ?? CreateFrontPngDataUrl(),
            IdBackCaptureDataUrl: backDataUrl ?? CreateBackPngDataUrl(),
            FaceCaptureDataUrl: CreatePngDataUrl(CreateAltFrontPngBytes()),
            BiometricDescriptorVector: CreateNormalized128DDescriptor(),
            GeometricSignatureJson: "{\"strategy\":\"ClaudeVisionFacialBiometricStrategy\",\"livenessConfidence\":0.95}",
            MinImageDimension: 1,
            IdVerificationToken: idVerificationToken,
            FacialVerificationToken: facialVerificationToken);

    private static async Task WithTempCapturesDirectoryAsync(Func<string, Task> action)
    {
        string tempDir = Path.Combine(Path.GetTempPath(), $"resq_tok_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);
        try
        {
            await action(tempDir);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                Directory.Delete(tempDir, recursive: true);
            }
        }
    }

    private static AppDbContext CreateInMemoryDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options);

    private static IConfiguration BuildClaudeConfig(string? apiKey = TestApiKeyPlaceholder)
    {
        var values = new Dictionary<string, string?>();
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            values["Claude:ApiKey"] = apiKey;
        }

        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }

    private static async Task WithClearedAiEnvironmentAsync(Func<Task> action)
    {
        string[] keys =
        [
            "ANTHROPIC_API_KEY",
            "CLAUDE_API_KEY",
            "GEMINI_API_KEY",
            "OPENAI_API_KEY",
            "AZURE_VISION_KEY",
            "AZURE_VISION_ENDPOINT"
        ];

        var previous = keys.ToDictionary(k => k, k => Environment.GetEnvironmentVariable(k));
        try
        {
            foreach (var key in keys)
            {
                Environment.SetEnvironmentVariable(key, null);
            }

            await action();
        }
        finally
        {
            foreach (var kvp in previous)
            {
                Environment.SetEnvironmentVariable(kvp.Key, kvp.Value);
            }
        }
    }

    [Fact]
    public async Task IdentityAiService_DuplicateFrontAndBackBytes_RejectsWithDuplicateErrorCode()
    {
        await WithClearedAiEnvironmentAsync(async () =>
        {
            var stubClaude = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: true,
                    RawText: JsonSerializer.Serialize(new
                    {
                        IdType = "DRIVERS_LICENSE",
                        FirstName = "ELENA",
                        Surname = "MARQUEZ",
                        DateOfBirth = "1994-03-11",
                        LicenseNumber = "K09-88-776655"
                    }),
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: null,
                    ErrorMessage: null,
                    HttpStatusCode: 200,
                    UsedFallbackModel: false));

            var service = new IdentityAiService(
                new StubHttpClientFactory(),
                BuildClaudeConfig(),
                NullLogger<IdentityAiService>.Instance,
                stubClaude);

            byte[] frontBytes = CreateFrontPngBytes();
            byte[] duplicateBackBytes = (byte[])frontBytes.Clone();

            var result = await service.ExtractIdOcrAsync(
                frontBytes,
                "image/png",
                duplicateBackBytes,
                "image/png",
                "drivers",
                "claude");

            Assert.False(result.Success);
            Assert.Equal("DUPLICATE_FRONT_BACK_IMAGE", result.ErrorCode);
            Assert.Equal(0, stubClaude.CallCount);
            Assert.Empty(result.ExtractedFields);
        });
    }

    [Fact]
    public async Task IdentityAiService_BackUploadedInFrontSlot_RejectsWithWrongIdSideFrontExpected()
    {
        await WithClearedAiEnvironmentAsync(async () =>
        {
            const string payloadJson =
                "{\"success\":false,\"errorCode\":\"WRONG_ID_SIDE_FRONT_EXPECTED\",\"frontSlotDetectedSide\":\"BACK\",\"backSlotDetectedSide\":\"BACK\",\"matchesSelectedIdType\":true,\"isGenuineId\":true}";

            var stubClaude = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: true,
                    RawText: payloadJson,
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: null,
                    ErrorMessage: null,
                    HttpStatusCode: 200,
                    UsedFallbackModel: false));

            var service = new IdentityAiService(
                new StubHttpClientFactory(),
                BuildClaudeConfig(),
                NullLogger<IdentityAiService>.Instance,
                stubClaude);

            var result = await service.ExtractIdOcrAsync(
                CreateFrontPngBytes(),
                "image/png",
                CreateBackPngBytes(),
                "image/png",
                "drivers",
                "claude");

            Assert.False(result.Success);
            Assert.Equal("WRONG_ID_SIDE_FRONT_EXPECTED", result.ErrorCode);
            Assert.Empty(result.ExtractedFields);
        });
    }

    [Fact]
    public async Task IdentityAiService_FrontUploadedInBackSlot_RejectsWithWrongIdSideBackExpected()
    {
        await WithClearedAiEnvironmentAsync(async () =>
        {
            const string payloadJson =
                "{\"success\":false,\"errorCode\":\"WRONG_ID_SIDE_BACK_EXPECTED\",\"frontSlotDetectedSide\":\"FRONT\",\"backSlotDetectedSide\":\"FRONT\",\"matchesSelectedIdType\":true,\"isGenuineId\":true}";

            var stubClaude = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: true,
                    RawText: payloadJson,
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: null,
                    ErrorMessage: null,
                    HttpStatusCode: 200,
                    UsedFallbackModel: false));

            var service = new IdentityAiService(
                new StubHttpClientFactory(),
                BuildClaudeConfig(),
                NullLogger<IdentityAiService>.Instance,
                stubClaude);

            var result = await service.ExtractIdOcrAsync(
                CreateFrontPngBytes(),
                "image/png",
                CreateBackPngBytes(),
                "image/png",
                "drivers",
                "claude");

            Assert.False(result.Success);
            Assert.Equal("WRONG_ID_SIDE_BACK_EXPECTED", result.ErrorCode);
            Assert.Empty(result.ExtractedFields);
        });
    }

    [Fact]
    public async Task IdentityAiService_WrongSelectedIdType_RejectsWithWrongGovernmentIdType()
    {
        await WithClearedAiEnvironmentAsync(async () =>
        {
            string payloadJson = JsonSerializer.Serialize(new
            {
                success = false,
                errorCode = "WRONG_GOVERNMENT_ID_TYPE",
                detectedIdType = "passport",
                detectedIdLabel = "Philippine Passport",
                matchesSelectedIdType = false,
                isGenuineId = true,
                frontSlotDetectedSide = "FRONT",
                backSlotDetectedSide = "BACK",
                FirstName = "ELENA",
                Surname = "MARQUEZ"
            });

            var stubClaude = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: true,
                    RawText: payloadJson,
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: null,
                    ErrorMessage: null,
                    HttpStatusCode: 200,
                    UsedFallbackModel: false));

            var service = new IdentityAiService(
                new StubHttpClientFactory(),
                BuildClaudeConfig(),
                NullLogger<IdentityAiService>.Instance,
                stubClaude);

            var result = await service.ExtractIdOcrAsync(
                CreateFrontPngBytes(),
                "image/png",
                CreateBackPngBytes(),
                "image/png",
                "drivers",
                "claude");

            Assert.False(result.Success);
            Assert.Equal("WRONG_GOVERNMENT_ID_TYPE", result.ErrorCode);
            Assert.Empty(result.ExtractedFields);
        });
    }

    [Fact]
    public async Task IdentityAiService_FakeOrSpecimenId_RejectsWithFakeOrAiGeneratedId()
    {
        await WithClearedAiEnvironmentAsync(async () =>
        {
            string payloadJson = JsonSerializer.Serialize(new
            {
                success = false,
                errorCode = "FAKE_OR_AI_GENERATED_ID",
                isGenuineId = false,
                authenticityVerdict = "SPECIMEN",
                authenticityReason = "Watermark SPECIMEN marker detected on card surface.",
                matchesSelectedIdType = true,
                frontSlotDetectedSide = "FRONT",
                backSlotDetectedSide = "BACK"
            });

            var stubClaude = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: true,
                    RawText: payloadJson,
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: null,
                    ErrorMessage: null,
                    HttpStatusCode: 200,
                    UsedFallbackModel: false));

            var service = new IdentityAiService(
                new StubHttpClientFactory(),
                BuildClaudeConfig(),
                NullLogger<IdentityAiService>.Instance,
                stubClaude);

            var result = await service.ExtractIdOcrAsync(
                CreateFrontPngBytes(),
                "image/png",
                CreateBackPngBytes(),
                "image/png",
                "drivers",
                "claude");

            Assert.False(result.Success);
            Assert.Equal("FAKE_OR_AI_GENERATED_ID", result.ErrorCode);
            Assert.False(result.IsAuthentic);
            Assert.Empty(result.ExtractedFields);
        });
    }

    [Fact]
    public async Task IdentityAiService_NonIdDocument_RejectsWithNonIdDocument()
    {
        await WithClearedAiEnvironmentAsync(async () =>
        {
            string payloadJson = JsonSerializer.Serialize(new
            {
                success = false,
                errorCode = "NON_ID_DOCUMENT",
                isGenuineId = false,
                authenticityVerdict = "NON_ID_DOCUMENT",
                authenticityReason = "Image depicts a non-ID document or selfie.",
                matchesSelectedIdType = true,
                frontSlotDetectedSide = "FRONT",
                backSlotDetectedSide = "BACK"
            });

            var stubClaude = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: true,
                    RawText: payloadJson,
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: null,
                    ErrorMessage: null,
                    HttpStatusCode: 200,
                    UsedFallbackModel: false));

            var service = new IdentityAiService(
                new StubHttpClientFactory(),
                BuildClaudeConfig(),
                NullLogger<IdentityAiService>.Instance,
                stubClaude);

            var result = await service.ExtractIdOcrAsync(
                CreateFrontPngBytes(),
                "image/png",
                CreateBackPngBytes(),
                "image/png",
                "drivers",
                "claude");

            Assert.False(result.Success);
            Assert.Equal("NON_ID_DOCUMENT", result.ErrorCode);
            Assert.False(result.IsAuthentic);
            Assert.Empty(result.ExtractedFields);
        });
    }

    [Fact]
    public async Task ClaudeAutoApproveGovIdStrategy_WhenClaudeOffline_DoesNotReturnApprovedTrueFallback()
    {
        await WithClearedAiEnvironmentAsync(async () =>
        {
            using var db = CreateInMemoryDbContext();
            var pendingUser = new User
            {
                Email = "offline.standby.test@resqtrack.gov.ph",
                FullName = "MARQUEZ, ELENA",
                FirstName = "ELENA",
                Surname = "MARQUEZ",
                PasswordHash = "hash",
                PasswordSalt = "salt",
                Role = UserRole.Civilian,
                Status = AccountStatus.Pending,
                GovernmentIdType = "drivers",
                ValidIdType = "drivers"
            };
            db.Users.Add(pendingUser);
            await db.SaveChangesAsync();

            // 1. Missing/disabled API key path
            var emptyConfig = new ConfigurationBuilder().Build();
            var strategyMissingKey = new ClaudeAutoApproveGovIdStrategy(
                db,
                emptyConfig,
                new StubHttpClientFactory(),
                NullLogger<ClaudeAutoApproveGovIdStrategy>.Instance);

            var missingKeyDecision = await strategyMissingKey.EvaluateAndApproveAsync(
                new StandbyGovIdApprovalRequest(
                    UserId: pendingUser.Id,
                    GovernmentIdType: "drivers",
                    FrontIdImageUrl: CreateFrontPngDataUrl(),
                    BackIdImageUrl: CreateBackPngDataUrl(),
                    FirstName: "ELENA",
                    LastName: "MARQUEZ",
                    DateOfBirth: "1994-03-11",
                    ApplyToDatabase: true));

            Assert.False(missingKeyDecision.Approved);
            Assert.NotEqual("Approved", missingKeyDecision.DecisionStatus);
            Assert.Equal(AccountStatus.Pending, pendingUser.Status);

            // 2. Failing IClaudeMessagesClient stub path (HTTP 503 PROVIDER_UNAVAILABLE)
            var failingStubClaude = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: false,
                    RawText: null,
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: "PROVIDER_UNAVAILABLE",
                    ErrorMessage: "Claude API offline.",
                    HttpStatusCode: 503,
                    UsedFallbackModel: false));

            var strategyFailingStub = new ClaudeAutoApproveGovIdStrategy(
                db,
                BuildClaudeConfig(),
                new StubHttpClientFactory(),
                NullLogger<ClaudeAutoApproveGovIdStrategy>.Instance,
                failingStubClaude);

            var failingStubDecision = await strategyFailingStub.EvaluateAndApproveAsync(
                new StandbyGovIdApprovalRequest(
                    UserId: pendingUser.Id,
                    GovernmentIdType: "drivers",
                    FrontIdImageUrl: CreateFrontPngDataUrl(),
                    BackIdImageUrl: CreateBackPngDataUrl(),
                    FirstName: "ELENA",
                    LastName: "MARQUEZ",
                    DateOfBirth: "1994-03-11",
                    ApplyToDatabase: true));

            Assert.False(failingStubDecision.Approved);
            Assert.NotEqual("Approved", failingStubDecision.DecisionStatus);
            Assert.Equal(AccountStatus.Pending, pendingUser.Status);
        });
    }

    [Fact]
    public async Task HmacVerificationTokenCacheStrategy_IssuePair_ValidateAndConsumeOnce_ThenRejectsReplay()
    {
        using var db = CreateInMemoryDbContext();
        var strategy = CreateTokenCacheStrategy(db);

        var (pairSha, idIssue, facialIssue) = await IssuePairedTokensAsync(
            strategy,
            CreateFrontPngBytes(),
            CreateBackPngBytes(),
            similarity: 0.89,
            idVerdict: "VERIFIED_GENUINE");

        Assert.False(string.IsNullOrWhiteSpace(idIssue.Token));
        Assert.False(string.IsNullOrWhiteSpace(facialIssue.Token));

        Guid consumingUserId = Guid.NewGuid();
        var firstConsume = await strategy.ValidateAndConsumePairAsync(
            idIssue.Token,
            facialIssue.Token,
            pairSha,
            consumingUserId);

        Assert.True(firstConsume.Success);
        Assert.Null(firstConsume.ErrorCode);
        Assert.NotNull(firstConsume.IdResult);
        Assert.NotNull(firstConsume.FacialResult);
        Assert.Equal(idIssue.TokenId, firstConsume.IdResult!.TokenId);
        Assert.Equal(facialIssue.TokenId, firstConsume.FacialResult!.TokenId);

        List<VerificationTokenRecord> persistedTokens = await db.VerificationTokenRecords
            .Where(t => t.TokenId == idIssue.TokenId || t.TokenId == facialIssue.TokenId)
            .ToListAsync();

        Assert.Equal(2, persistedTokens.Count);
        Assert.All(persistedTokens, record =>
        {
            Assert.NotNull(record.ConsumedAtUtc);
            Assert.Equal(consumingUserId, record.ConsumedByUserId);
        });

        var replayConsume = await strategy.ValidateAndConsumePairAsync(
            idIssue.Token,
            facialIssue.Token,
            pairSha,
            Guid.NewGuid());

        Assert.False(replayConsume.Success);
        Assert.Equal("VERIFICATION_TOKEN_REPLAYED", replayConsume.ErrorCode);
    }

    [Fact]
    public async Task HmacVerificationTokenCacheStrategy_TamperedSignature_OrCrossPairedTokens_RejectsInvalidToken()
    {
        using var db = CreateInMemoryDbContext();
        var strategy = CreateTokenCacheStrategy(db);

        var (shaA, idTokenA, facialTokenA) = await IssuePairedTokensAsync(
            strategy,
            CreateFrontPngBytes(),
            CreateBackPngBytes(),
            similarity: 0.90,
            idVerdict: "VERIFIED_GENUINE");

        var (shaB, _, facialTokenB) = await IssuePairedTokensAsync(
            strategy,
            CreateAltFrontPngBytes(),
            CreateAltBackPngBytes(),
            similarity: 0.92,
            idVerdict: "VERIFIED_GENUINE");

        string tamperedIdToken = MutateTokenSignature(idTokenA.Token);
        var tamperedResult = await strategy.ValidateAndConsumePairAsync(
            tamperedIdToken,
            facialTokenA.Token,
            shaA,
            Guid.NewGuid());

        Assert.False(tamperedResult.Success);
        Assert.Equal("INVALID_VERIFICATION_TOKEN", tamperedResult.ErrorCode);

        var crossPairedResult = await strategy.ValidateAndConsumePairAsync(
            idTokenA.Token,
            facialTokenB.Token,
            shaA,
            Guid.NewGuid());

        Assert.False(crossPairedResult.Success);
        Assert.Equal("INVALID_VERIFICATION_TOKEN", crossPairedResult.ErrorCode);

        var swappedShaResult = await strategy.ValidateAndConsumePairAsync(
            idTokenA.Token,
            facialTokenA.Token,
            shaB,
            Guid.NewGuid());

        Assert.False(swappedShaResult.Success);
        Assert.Equal("INVALID_VERIFICATION_TOKEN", swappedShaResult.ErrorCode);
    }

    [Fact]
    public async Task AuthService_WithValidVerifiedTokens_AutoApprovesCivilianAndPersistsSqlAuditTrail()
    {
        using var db = CreateInMemoryDbContext();
        var (tokenStrategy, _, authService) = CreateAuthTokenStack(db);

        var (_, idIssue, facialIssue) = await IssuePairedTokensAsync(
            tokenStrategy,
            CreateFrontPngBytes(),
            CreateBackPngBytes(),
            similarity: 0.91,
            idVerdict: "VERIFIED_GENUINE");

        await WithTempCapturesDirectoryAsync(async capturesDir =>
        {
            var request = CreateVerifiedTokenRegisterRequest(
                email: "auto.civilian@resqtrack.gov.ph",
                role: UserRole.Civilian,
                unit: ResponderUnitType.None,
                idVerificationToken: idIssue.Token,
                facialVerificationToken: facialIssue.Token);

            var (success, error, statusCode, errorCode, user, response) =
                await authService.RegisterWithDetailsAsync(request, capturesDir);

            Assert.True(success, error);
            Assert.Equal(201, statusCode);
            Assert.Null(errorCode);
            Assert.NotNull(user);
            Assert.NotNull(response);

            Assert.Equal(AccountStatus.Verified, user!.Status);
            Assert.True(user.FaceVerified);
            Assert.True(user.AutoApprovedByAi);
            Assert.NotNull(user.IdVerificationTokenId);
            Assert.NotNull(user.FacialVerificationTokenId);
            Assert.Equal(idIssue.TokenId, user.IdVerificationTokenId);
            Assert.Equal(facialIssue.TokenId, user.FacialVerificationTokenId);

            Assert.True(response!.AutoApprovedByAi);
            Assert.Equal("Verified", response.Status);
            Assert.True(response.FaceVerified);

            IdentityVerificationRecord? verificationRecord = await db.IdentityVerificationRecords
                .FirstOrDefaultAsync(r => r.UserId == user.Id);
            Assert.NotNull(verificationRecord);
            Assert.True(verificationRecord!.AutoApproved);
            Assert.Equal(user.IdVerificationTokenId, verificationRecord.VerificationTokenId);
            Assert.Equal("APPROVED_AUTO_AI", verificationRecord.OverallVerificationStatus);

            BiometricEnrollment? biometricEnrollment = await db.BiometricEnrollments
                .FirstOrDefaultAsync(b => b.UserId == user.Id);
            Assert.NotNull(biometricEnrollment);
            Assert.Equal("ACTIVE", biometricEnrollment!.EnrollmentStatus);

            AuditLog? auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(a => a.ActorUserId == user.Id && a.Action == "ACCOUNT_AUTO_APPROVED_AI");
            Assert.NotNull(auditLog);

            List<VerificationTokenRecord> tokenRecords = await db.VerificationTokenRecords
                .Where(t => t.TokenId == idIssue.TokenId || t.TokenId == facialIssue.TokenId)
                .ToListAsync();
            Assert.Equal(2, tokenRecords.Count);
            Assert.All(tokenRecords, record =>
            {
                Assert.NotNull(record.ConsumedAtUtc);
                Assert.Equal(user.Id, record.ConsumedByUserId);
            });
        });
    }

    [Fact]
    public async Task AuthService_WithValidVerifiedTokens_AutoApprovesAllowedResponderUnits()
    {
        using var db = CreateInMemoryDbContext();
        var (tokenStrategy, _, authService) = CreateAuthTokenStack(db);

        ResponderUnitType[] allowedUnits =
        [
            ResponderUnitType.FIRE,
            ResponderUnitType.RHU,
            ResponderUnitType.PNP
        ];

        await WithTempCapturesDirectoryAsync(async capturesDir =>
        {
            foreach (ResponderUnitType unit in allowedUnits)
            {
                var (_, idIssue, facialIssue) = await IssuePairedTokensAsync(
                    tokenStrategy,
                    CreateFrontPngBytes(),
                    CreateBackPngBytes(),
                    similarity: 0.90,
                    idVerdict: "VERIFIED_GENUINE");

                var request = CreateVerifiedTokenRegisterRequest(
                    email: $"auto.responder.{unit.ToString().ToLowerInvariant()}@resqtrack.gov.ph",
                    role: UserRole.Responder,
                    unit: unit,
                    idVerificationToken: idIssue.Token,
                    facialVerificationToken: facialIssue.Token);

                var (success, error, statusCode, errorCode, user, response) =
                    await authService.RegisterWithDetailsAsync(request, capturesDir);

                Assert.True(success, error);
                Assert.Equal(201, statusCode);
                Assert.Null(errorCode);
                Assert.NotNull(user);
                Assert.NotNull(response);
                Assert.Equal(AccountStatus.Verified, user!.Status);
                Assert.True(user.FaceVerified);
                Assert.True(user.AutoApprovedByAi);
                Assert.True(response!.AutoApprovedByAi);
                Assert.Equal(unit, user.Unit);
            }
        });
    }

    [Fact]
    public async Task AuthService_WithValidVerifiedTokens_RejectsLdrrmoAdminAndTamperedTokensAndReplay()
    {
        using var db = CreateInMemoryDbContext();
        var (tokenStrategy, _, authService) = CreateAuthTokenStack(db);

        var (_, idIssue, facialIssue) = await IssuePairedTokensAsync(
            tokenStrategy,
            CreateFrontPngBytes(),
            CreateBackPngBytes(),
            similarity: 0.93,
            idVerdict: "VERIFIED_GENUINE");

        await WithTempCapturesDirectoryAsync(async capturesDir =>
        {
            // 1. Valid tokens submitted with UserRole.LDRRMO_Admin -> 403 ROLE_FORBIDDEN
            var adminRequest = CreateVerifiedTokenRegisterRequest(
                email: "blocked.admin@resqtrack.gov.ph",
                role: UserRole.LDRRMO_Admin,
                unit: ResponderUnitType.None,
                idVerificationToken: idIssue.Token,
                facialVerificationToken: facialIssue.Token);

            var adminResult = await authService.RegisterWithDetailsAsync(adminRequest, capturesDir);
            Assert.False(adminResult.Success);
            Assert.Equal(403, adminResult.StatusCode);
            Assert.Equal("ROLE_FORBIDDEN", adminResult.ErrorCode);
            Assert.Null(adminResult.User);

            // 2. Tampered facial token submitted for Civilian -> 400 INVALID_VERIFICATION_TOKEN
            var tamperedRequest = CreateVerifiedTokenRegisterRequest(
                email: "tampered.civilian@resqtrack.gov.ph",
                role: UserRole.Civilian,
                unit: ResponderUnitType.None,
                idVerificationToken: idIssue.Token,
                facialVerificationToken: MutateTokenSignature(facialIssue.Token));

            var tamperedResult = await authService.RegisterWithDetailsAsync(tamperedRequest, capturesDir);
            Assert.False(tamperedResult.Success);
            Assert.Equal(400, tamperedResult.StatusCode);
            Assert.Equal("INVALID_VERIFICATION_TOKEN", tamperedResult.ErrorCode);
            Assert.Null(tamperedResult.User);

            // 3. Submitting ONLY IdVerificationToken without FacialVerificationToken -> 400 INVALID_VERIFICATION_TOKEN
            var partialTokenRequest = CreateVerifiedTokenRegisterRequest(
                email: "partial.token@resqtrack.gov.ph",
                role: UserRole.Civilian,
                unit: ResponderUnitType.None,
                idVerificationToken: idIssue.Token,
                facialVerificationToken: null);

            var partialTokenResult = await authService.RegisterWithDetailsAsync(partialTokenRequest, capturesDir);
            Assert.False(partialTokenResult.Success);
            Assert.Equal(400, partialTokenResult.StatusCode);
            Assert.Equal("INVALID_VERIFICATION_TOKEN", partialTokenResult.ErrorCode);
            Assert.Null(partialTokenResult.User);

            // 4. Consume valid pair once on legitimate Civilian registration
            var firstCivilianRequest = CreateVerifiedTokenRegisterRequest(
                email: "legit.civilian@resqtrack.gov.ph",
                role: UserRole.Civilian,
                unit: ResponderUnitType.None,
                idVerificationToken: idIssue.Token,
                facialVerificationToken: facialIssue.Token);

            var firstCivilianResult = await authService.RegisterWithDetailsAsync(firstCivilianRequest, capturesDir);
            Assert.True(firstCivilianResult.Success, firstCivilianResult.Error);
            Assert.Equal(201, firstCivilianResult.StatusCode);

            // 5. Re-submitting already-consumed tokens for a new Civilian user -> 400 VERIFICATION_TOKEN_REPLAYED
            var replayRequest = CreateVerifiedTokenRegisterRequest(
                email: "replay.civilian@resqtrack.gov.ph",
                role: UserRole.Civilian,
                unit: ResponderUnitType.None,
                idVerificationToken: idIssue.Token,
                facialVerificationToken: facialIssue.Token);

            var replayResult = await authService.RegisterWithDetailsAsync(replayRequest, capturesDir);
            Assert.False(replayResult.Success);
            Assert.Equal(400, replayResult.StatusCode);
            Assert.Equal("VERIFICATION_TOKEN_REPLAYED", replayResult.ErrorCode);
            Assert.Null(replayResult.User);

            // 6. Submitting WITHOUT any tokens preserves ADR-04 Pending / unverified defaults
            var manualPendingRequest = CreateVerifiedTokenRegisterRequest(
                email: "adr04.pending@resqtrack.gov.ph",
                role: UserRole.Civilian,
                unit: ResponderUnitType.None,
                idVerificationToken: null,
                facialVerificationToken: null);

            var manualPendingResult = await authService.RegisterWithDetailsAsync(manualPendingRequest, capturesDir);
            Assert.True(manualPendingResult.Success, manualPendingResult.Error);
            Assert.Equal(201, manualPendingResult.StatusCode);
            Assert.NotNull(manualPendingResult.User);
            Assert.Equal(AccountStatus.Pending, manualPendingResult.User!.Status);
            Assert.False(manualPendingResult.User.FaceVerified);
            Assert.False(manualPendingResult.User.AutoApprovedByAi);
            Assert.False(manualPendingResult.Response!.AutoApprovedByAi);
        });
    }

    [Fact]
    public async Task IdentityAiService_AnalyzeFacialGeometryAsync_WithFrontIdAndIdToken_MintsPairedFacialTokenOnMatch_AndRejectsMismatch()
    {
        await WithClearedAiEnvironmentAsync(async () =>
        {
            using var db = CreateInMemoryDbContext();
            var tokenStrategy = CreateTokenCacheStrategy(db);
            string pairSha = tokenStrategy.ComputeImagePairSha256(CreateFrontPngBytes(), CreateBackPngBytes());
            TokenIssueResult idIssue = await tokenStrategy.IssueIdTokenAsync(
                imagePairSha256: pairSha,
                verdict: "VERIFIED_GENUINE",
                providerUsed: "ClaudeVision",
                modelUsed: "claude-sonnet-4-6",
                payloadJson: "{\"authenticityVerdict\":\"GENUINE_PHYSICAL_ID\"}");

            var request = new FacialGeometryAnalysisRequestDto
            {
                FrontIdDataUrl = CreateFrontPngDataUrl(),
                CenterFrameDataUrl = CreatePngDataUrl(CreateAltFrontPngBytes()),
                RightFrameDataUrl = CreatePngDataUrl(CreateAltBackPngBytes()),
                LeftFrameDataUrl = CreateBackPngDataUrl(),
                BlinkFrameDataUrl = CreateFrontPngDataUrl(),
                IdVerificationToken = idIssue.Token,
                BlurVariance = 120,
                SamplingFps = 30,
                TotalCachedFrames = 60
            };

            // 1. Live human & face-to-ID match (0.91) -> mints paired FacialVerificationToken
            var matchStub = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: true,
                    RawText: "{\"isLiveHuman\":true,\"faceToIdSimilarity\":0.91,\"verdict\":\"MATCH\"}",
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: null,
                    ErrorMessage: null,
                    HttpStatusCode: 200,
                    UsedFallbackModel: false));

            var matchService = new IdentityAiService(
                new StubHttpClientFactory(),
                BuildClaudeConfig(),
                NullLogger<IdentityAiService>.Instance,
                matchStub,
                tokenStrategy);

            FacialGeometryAnalysisResponseDto matchResponse = await matchService.AnalyzeFacialGeometryAsync(request);

            Assert.True(matchResponse.IsLiveHuman);
            Assert.True(matchResponse.IsFaceMatchedToId);
            Assert.False(string.IsNullOrWhiteSpace(matchResponse.FacialVerificationToken));
            Assert.True(matchResponse.IsAutoApproveEligible);
            Assert.Null(matchResponse.ErrorCode);

            TokenValidationResult facialValidation = await tokenStrategy.ValidateTokenAsync(
                matchResponse.FacialVerificationToken!,
                "FACIAL");
            Assert.True(facialValidation.IsValid);
            Assert.Equal(Guid.Parse(idIssue.TokenId), facialValidation.PairedIdTokenId);

            // 2. Face-to-ID mismatch (0.35) -> rejects with FACE_TO_ID_MISMATCH and mints no token
            var mismatchStub = new StubClaudeMessagesClient(
                isConfigured: true,
                responder: _ => new ClaudeMessageAttemptResult(
                    Success: true,
                    RawText: "{\"isLiveHuman\":true,\"faceToIdSimilarity\":0.35,\"verdict\":\"MISMATCH\"}",
                    ModelUsed: "claude-sonnet-4-6",
                    ErrorCode: null,
                    ErrorMessage: null,
                    HttpStatusCode: 200,
                    UsedFallbackModel: false));

            var mismatchService = new IdentityAiService(
                new StubHttpClientFactory(),
                BuildClaudeConfig(),
                NullLogger<IdentityAiService>.Instance,
                mismatchStub,
                tokenStrategy);

            FacialGeometryAnalysisResponseDto mismatchResponse = await mismatchService.AnalyzeFacialGeometryAsync(request);

            Assert.False(mismatchResponse.IsFaceMatchedToId);
            Assert.Equal("FACE_TO_ID_MISMATCH", mismatchResponse.ErrorCode);
            Assert.Null(mismatchResponse.FacialVerificationToken);
            Assert.False(mismatchResponse.IsAutoApproveEligible);
        });
    }

    [Fact]
    public async Task IdentityController_ExtractOcrMultipart_WhenRequireDualSideTrueAndIdTypeEmpty_ReturnsBadRequestMissingIdType()
    {
        var stubAiService = new StubIdentityAiService();
        var controller = new IdentityController(stubAiService);
        string[] emptyIdTypes = [string.Empty, "   "];

        foreach (string idType in emptyIdTypes)
        {
            IFormFile frontImage = CreateImageFormFile(CreateFrontPngBytes(), "front.png");
            IFormFile backImage = CreateImageFormFile(CreateBackPngBytes(), "back.png");

            IActionResult actionResult = await controller.ExtractOcrMultipartAsync(
                frontImage: frontImage,
                backImage: backImage,
                idType: idType,
                preferredProvider: "claude",
                requireDualSide: "true",
                ct: CancellationToken.None);

            var badRequest = Assert.IsType<BadRequestObjectResult>(actionResult);
            Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);

            var payload = Assert.IsType<AiOcrResponseDto>(badRequest.Value);
            Assert.False(payload.Success);
            Assert.Equal("MISSING_ID_TYPE", payload.ErrorCode);
            Assert.False(payload.RequiresPendingManualReview);
            Assert.Equal(0, stubAiService.ExtractIdOcrCallCount);
        }
    }

    [Fact]
    public async Task IdentityController_AiExtract_WhenServiceReturnsMissingIdType_MapsToBadRequest()
    {
        var stubAiService = new StubIdentityAiService(
            extractIdentityResponder: _ => new AiExtractResponseDto
            {
                Success = false,
                ErrorCode = "MISSING_ID_TYPE",
                ErrorMessage = "Government ID document type is required."
            });

        var controller = new IdentityController(stubAiService);
        var request = new AiExtractRequestDto
        {
            ImageDataUrl = CreateFrontPngDataUrl(),
            IdType = string.Empty
        };

        IActionResult actionResult = await controller.AiExtractAsync(request, CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(actionResult);
        Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);

        var payload = Assert.IsAssignableFrom<AiExtractResponseDto>(badRequest.Value);
        Assert.False(payload.Success);
        Assert.Equal("MISSING_ID_TYPE", payload.ErrorCode);
        Assert.Equal("Government ID document type is required.", payload.ErrorMessage);
        Assert.Equal(1, stubAiService.ExtractIdentityCallCount);
    }

    [Fact]
    public async Task IdentityController_ExtractOcrMultipart_WhenRequireDualSideTrueAndValidIdType_InvokesService()
    {
        var stubAiService = new StubIdentityAiService();
        var controller = new IdentityController(stubAiService);

        IFormFile frontImage = CreateImageFormFile(CreateFrontPngBytes(), "front.png");
        IFormFile backImage = CreateImageFormFile(CreateBackPngBytes(), "back.png");

        IActionResult actionResult = await controller.ExtractOcrMultipartAsync(
            frontImage: frontImage,
            backImage: backImage,
            idType: "drivers",
            preferredProvider: "claude",
            requireDualSide: "true",
            ct: CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        Assert.Equal(StatusCodes.Status200OK, okResult.StatusCode);

        var payload = Assert.IsType<AiOcrResponseDto>(okResult.Value);
        Assert.True(payload.Success);
        Assert.Equal("drivers", payload.IdType);
        Assert.Equal(1, stubAiService.ExtractIdOcrCallCount);
    }

    private static IFormFile CreateImageFormFile(byte[] bytes, string fileName, string contentType = "image/png") =>
        new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };

    private sealed class StubIdentityAiService(
        Func<AiExtractRequestDto, AiExtractResponseDto>? extractIdentityResponder = null,
        Func<string?, AiOcrResponseDto>? extractIdOcrResponder = null) : IIdentityAiService
    {
        public int ExtractIdentityCallCount { get; private set; }
        public int ExtractIdOcrCallCount { get; private set; }

        public AiProviderStatusDto GetAiStatus() =>
            new() { ClaudeConfigured = true, ActiveChain = "ClaudeVision" };

        public Task<AiExtractResponseDto> ExtractIdentityAsync(AiExtractRequestDto request, CancellationToken ct = default) =>
            Task.FromResult(InvokeExtractIdentity(request));

        public Task<AiOcrResponseDto> ExtractIdOcrAsync(
            byte[] frontBytes,
            string frontMime,
            byte[]? backBytes,
            string? backMime,
            string? idType,
            string? preferredProvider = null,
            CancellationToken ct = default) =>
            Task.FromResult(InvokeExtractIdOcr(idType));

        public Task<IdentityDocumentAnalyzeResponseDto> AnalyzeDocumentAsync(
            IdentityDocumentAnalyzeRequestDto request,
            CancellationToken ct = default) =>
            Task.FromResult(new IdentityDocumentAnalyzeResponseDto());

        public Task<FacialGeometryAnalysisResponseDto> AnalyzeFacialGeometryAsync(
            FacialGeometryAnalysisRequestDto request,
            CancellationToken ct = default) =>
            Task.FromResult(new FacialGeometryAnalysisResponseDto());

        private AiExtractResponseDto InvokeExtractIdentity(AiExtractRequestDto request)
        {
            ExtractIdentityCallCount += 1;
            return extractIdentityResponder != null
                ? extractIdentityResponder(request)
                : new AiExtractResponseDto
                {
                    Success = true,
                    ProviderUsed = "StubClaudeVision",
                    IdType = request.IdType ?? request.HintType,
                    IsAuthentic = true,
                    Confidence = 0.95
                };
        }

        private AiOcrResponseDto InvokeExtractIdOcr(string? idType)
        {
            ExtractIdOcrCallCount += 1;
            return extractIdOcrResponder != null
                ? extractIdOcrResponder(idType)
                : new AiOcrResponseDto
                {
                    Success = true,
                    ProviderUsed = "StubClaudeVision",
                    IdType = idType,
                    IsAuthentic = true,
                    Confidence = 0.95
                };
        }
    }

    private sealed class StubClaudeMessagesClient(
        bool isConfigured,
        Func<IReadOnlyDictionary<string, object>, ClaudeMessageAttemptResult> responder) : IClaudeMessagesClient
    {
        public bool IsConfigured => isConfigured;
        public string PrimaryModel => "claude-sonnet-4-6";
        public string FallbackModel => "claude-sonnet-5-5";
        public int CallCount { get; private set; }

        public Task<ClaudeMessageAttemptResult> SendMessagesAsync(
            IReadOnlyDictionary<string, object> payloadWithoutModel,
            CancellationToken ct = default,
            string? modelOverride = null)
        {
            CallCount += 1;
            return Task.FromResult(responder(payloadWithoutModel));
        }
    }

    private sealed class StubNoOpHttpMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
            {
                Content = new StringContent("{\"error\":\"offline\"}", Encoding.UTF8, "application/json")
            });
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        private readonly StubNoOpHttpMessageHandler _handler = new();
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }
}
