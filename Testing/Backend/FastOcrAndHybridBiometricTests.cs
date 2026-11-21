// [Layer: Testing/Backend]
// Responsibility: TDD RED contract tests for fast compact OCR prompting, preferredModel forwarding, Redis offline circuit breaker, per-attempt Claude timeout failover, and hybrid cached-pose biometric verification.
// Invariant: C# 13 (.NET 10), xUnit 2.9.3, universal expression-bodied arrow lambdas (=>), zero hardcoded secrets, zero emojis.

using System.Buffers.Binary;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
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
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ResQTrack.Backend.Features.Services.Biometrics;

namespace Backend.Tests;

public class FastOcrAndHybridBiometricTests
{
    private const string TestApiKeyPlaceholder = "test-anthropic-key-placeholder";

    [Fact]
    public async Task SharedGovIdForensicsEvaluator_UsesCompactPromptWithCacheControlAndNoRawTextBloat()
    {
        string genuineOcrJson = JsonSerializer.Serialize(new
        {
            unreadable = false,
            isGenuineId = true,
            authenticityVerdict = "GENUINE_PHYSICAL_ID",
            detectedIdType = "drivers",
            detectedIdLabel = "Philippine Driver's License",
            matchesSelectedIdType = true,
            frontSlotDetectedSide = "FRONT",
            backSlotDetectedSide = "BACK",
            areSidesIdentical = false,
            confidence = 0.94,
            IdType = "DRIVERS_LICENSE",
            fields = new
            {
                FirstName = new { value = "ELENA", confidence = 0.95 },
                Surname = new { value = "MARQUEZ", confidence = 0.95 },
                LicenseNumber = new { value = "K09-88-776655", confidence = 0.94 }
            }
        });

        var handler = new StubClaudeHttpMessageHandler((ctx, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    BuildAnthropicMessageEnvelope(genuineOcrJson, ctx.Model ?? "claude-sonnet-4-6"),
                    Encoding.UTF8,
                    "application/json")
            }));

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var config = BuildClaudeConfig();
            var claudeClient = new ClaudeMessagesClient(
                new HttpClient(handler),
                config,
                NullLogger<ClaudeMessagesClient>.Instance);
            var evaluator = new SharedGovIdForensicsEvaluator(
                config,
                claudeClient,
                NullLogger<SharedGovIdForensicsEvaluator>.Instance);

            var result = await evaluator.EvaluateAsync(
                new GovIdAuthenticityInput(
                    FrontBytes: CreateDistinctPngBytes("gov-front"),
                    FrontMimeType: "image/png",
                    BackBytes: CreateDistinctPngBytes("gov-back"),
                    BackMimeType: "image/png",
                    SelectedIdType: "drivers",
                    PreferredModel: null,
                    RequireDualSideVerification: true),
                CancellationToken.None);

            Assert.True(result.Success);
            Assert.Single(handler.CapturedRequests);

            StubRequestContext captured = handler.CapturedRequests[0];
            Assert.Contains("/v1/messages", captured.Request.RequestUri?.AbsoluteUri ?? string.Empty, StringComparison.OrdinalIgnoreCase);

            using var doc = JsonDocument.Parse(captured.Body);
            JsonElement root = doc.RootElement;

            int maxTokens = root.GetProperty("max_tokens").GetInt32();
            Assert.InRange(maxTokens, 768, 1280);
            Assert.True(maxTokens <= 1280, $"Expected compact max_tokens <= 1280, actual: {maxTokens}");

            Assert.True(root.TryGetProperty("system", out JsonElement systemProp));
            Assert.Equal(JsonValueKind.Array, systemProp.ValueKind);

            bool hasEphemeralCacheControl = false;
            var systemTexts = new StringBuilder();

            foreach (JsonElement block in systemProp.EnumerateArray())
            {
                if (block.TryGetProperty("text", out JsonElement textProp) &&
                    textProp.ValueKind == JsonValueKind.String)
                {
                    systemTexts.AppendLine(textProp.GetString());
                }

                if (block.TryGetProperty("cache_control", out JsonElement cacheControl) &&
                    cacheControl.ValueKind == JsonValueKind.Object &&
                    cacheControl.TryGetProperty("type", out JsonElement cacheType) &&
                    string.Equals(cacheType.GetString(), "ephemeral", StringComparison.Ordinal))
                {
                    hasEphemeralCacheControl = true;
                }
            }

            string systemPromptText = systemTexts.ToString();
            Assert.True(hasEphemeralCacheControl, "Expected at least one system prompt block with cache_control.type == 'ephemeral'.");
            Assert.DoesNotContain("\"RawText\": <verbatim", systemPromptText, StringComparison.OrdinalIgnoreCase);
            Assert.True(
                systemPromptText.Contains("single-line", StringComparison.OrdinalIgnoreCase) ||
                systemPromptText.Contains("omit", StringComparison.OrdinalIgnoreCase),
                "Expected compact single-line or omit instruction in forensic system prompt.");
        });
    }

    [Fact]
    public async Task IdentityController_ExtractOcrMultipart_HonorsPreferredModelFormField()
    {
        string genuineOcrJson = JsonSerializer.Serialize(new
        {
            unreadable = false,
            isGenuineId = true,
            authenticityVerdict = "GENUINE_PHYSICAL_ID",
            detectedIdType = "drivers",
            detectedIdLabel = "Philippine Driver's License",
            matchesSelectedIdType = true,
            frontSlotDetectedSide = "FRONT",
            backSlotDetectedSide = "BACK",
            areSidesIdentical = false,
            confidence = 0.94,
            IdType = "DRIVERS_LICENSE",
            fields = new
            {
                FirstName = new { value = "ELENA", confidence = 0.95 },
                Surname = new { value = "MARQUEZ", confidence = 0.95 },
                LicenseNumber = new { value = "K09-88-776655", confidence = 0.94 }
            }
        });

        var claudeStub = new RecordingStubClaudeMessagesClient(
            primaryModel: "claude-sonnet-4-6",
            fallbackModel: "claude-sonnet-5-5",
            responder: (_, modelOverride) => new ClaudeMessageAttemptResult(
                Success: true,
                RawText: genuineOcrJson,
                ModelUsed: string.IsNullOrWhiteSpace(modelOverride) ? "claude-sonnet-4-6" : modelOverride.Trim(),
                ErrorCode: null,
                ErrorMessage: null,
                HttpStatusCode: 200,
                UsedFallbackModel: false));

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var config = BuildClaudeConfig();
            var aiService = new IdentityAiService(
                new StubHttpClientFactory(),
                config,
                NullLogger<IdentityAiService>.Instance,
                claudeStub);
            var controller = new IdentityController(aiService);

            IFormFile frontImage = CreateImageFormFile(CreateDistinctPngBytes("multipart-front"), "front.png");
            IFormFile backImage = CreateImageFormFile(CreateDistinctPngBytes("multipart-back"), "back.png");

            IActionResult actionResult = await controller.ExtractOcrMultipartAsync(
                frontImage: frontImage,
                backImage: backImage,
                idType: "drivers",
                preferredProvider: "claude",
                preferredModel: "claude-sonnet-5-5",
                ct: CancellationToken.None);

            var okResult = Assert.IsType<OkObjectResult>(actionResult);
            var payload = Assert.IsType<AiOcrResponseDto>(okResult.Value);

            Assert.True(payload.Success);
            Assert.NotEmpty(claudeStub.RequestedModels);
            Assert.Equal("claude-sonnet-5-5", claudeStub.RequestedModels[0]);
            Assert.Equal("claude-sonnet-5-5", payload.ModelUsed);
        });
    }

    [Fact]
    public async Task VerificationTokenCache_RedisOfflineCircuitBreaker_SkipsSlowRepeatTimeouts()
    {
        var failingCache = new SlowFailingDistributedCache(delayMs: 500);
        var strategy = new HmacVerificationTokenCacheStrategy(
            Options.Create(new VerificationTokenOptions()),
            failingCache,
            db: null);

        string pairSha = strategy.ComputeImagePairSha256(
            CreateDistinctPngBytes("tok-front"),
            CreateDistinctPngBytes("tok-back"));

        var sw1 = Stopwatch.StartNew();
        TokenIssueResult firstIssue = await strategy.IssueIdTokenAsync(
            imagePairSha256: pairSha,
            verdict: "GENUINE_PHYSICAL_ID",
            providerUsed: "ClaudeVision",
            modelUsed: "claude-sonnet-4-6",
            payloadJson: "{\"authenticityVerdict\":\"GENUINE_PHYSICAL_ID\"}");
        sw1.Stop();

        int callsAfterFirst = failingCache.CallCount;
        Assert.False(string.IsNullOrWhiteSpace(firstIssue.Token));
        Assert.True(callsAfterFirst >= 1, "Expected first issuance to probe IDistributedCache.");
        Assert.True(sw1.ElapsedMilliseconds < 450, $"Expected first call under 450ms, actual: {sw1.ElapsedMilliseconds}ms");

        var sw2 = Stopwatch.StartNew();
        TokenIssueResult secondIssue = await strategy.IssueIdTokenAsync(
            imagePairSha256: pairSha,
            verdict: "GENUINE_PHYSICAL_ID",
            providerUsed: "ClaudeVision",
            modelUsed: "claude-sonnet-4-6",
            payloadJson: "{\"authenticityVerdict\":\"GENUINE_PHYSICAL_ID\"}");
        sw2.Stop();

        Assert.False(string.IsNullOrWhiteSpace(secondIssue.Token));
        Assert.Equal(callsAfterFirst, failingCache.CallCount);
        Assert.True(sw2.ElapsedMilliseconds < 50, $"Expected second call with open circuit breaker under 50ms, actual: {sw2.ElapsedMilliseconds}ms");
    }

    [Fact]
    public async Task ClaudeMessagesClient_PerAttemptTimeout_FailsOverFastWhenPrimaryStalls()
    {
        var handler = new StubClaudeHttpMessageHandler(async (ctx, ct) =>
        {
            if (string.Equals(ctx.Model, "claude-sonnet-4-6", StringComparison.OrdinalIgnoreCase))
            {
                await Task.Delay(2500, ct);
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(
                        BuildAnthropicMessageEnvelope("{\"stalled\":true}", "claude-sonnet-4-6"),
                        Encoding.UTF8,
                        "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    BuildAnthropicMessageEnvelope("{\"FirstName\":\"ELENA\",\"Surname\":\"MARQUEZ\"}", ctx.Model ?? "claude-sonnet-5-5"),
                    Encoding.UTF8,
                    "application/json")
            };
        });

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var config = BuildClaudeConfig(
                primaryModel: "claude-sonnet-4-6",
                fallbackModel: "claude-sonnet-5-5",
                timeoutSeconds: "1");

            var client = new ClaudeMessagesClient(
                new HttpClient(handler),
                config,
                NullLogger<ClaudeMessagesClient>.Instance);

            var payload = new Dictionary<string, object>
            {
                ["max_tokens"] = 256,
                ["messages"] = new object[]
                {
                    new { role = "user", content = "Extract visible fields." }
                }
            };

            var sw = Stopwatch.StartNew();
            ClaudeMessageAttemptResult attempt = await client.SendMessagesAsync(payload);
            sw.Stop();

            Assert.True(attempt.Success);
            Assert.True(attempt.UsedFallbackModel);
            Assert.Equal("claude-sonnet-5-5", attempt.ModelUsed);
            Assert.Equal(["claude-sonnet-4-6", "claude-sonnet-5-5"], handler.RequestedModels);
            Assert.True(sw.ElapsedMilliseconds < 2000, $"Expected fast per-attempt timeout failover under 2000ms, actual: {sw.ElapsedMilliseconds}ms");
        });
    }

    [Fact]
    public async Task ClaudeCachedPoseIdentityStrategy_MatchesLiveFrameAgainstAllFourCachedPoses_AndRejectsMismatch()
    {
        byte[] liveBytes = CreateDistinctPngBytes("live-selfie");
        byte[] centerBytes = CreateDistinctPngBytes("pose-center");
        byte[] rightBytes = CreateDistinctPngBytes("pose-right");
        byte[] leftBytes = CreateDistinctPngBytes("pose-left");
        byte[] blinkBytes = CreateDistinctPngBytes("pose-blink");

        string liveDataUrl = ToPngDataUrl(liveBytes);
        string poseFramesJson = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["CENTER"] = ToPngDataUrl(centerBytes),
            ["RIGHT"] = ToPngDataUrl(rightBytes),
            ["LEFT"] = ToPngDataUrl(leftBytes),
            ["BLINK"] = ToPngDataUrl(blinkBytes)
        });

        bool returnMatchVerdict = true;

        var handler = new StubClaudeHttpMessageHandler((ctx, _) =>
        {
            if (string.Equals(ctx.Model, "claude-sonnet-4-6", StringComparison.OrdinalIgnoreCase))
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound)
                {
                    Content = new StringContent(
                        "{\"type\":\"error\",\"error\":{\"type\":\"not_found_error\",\"message\":\"model unavailable\"}}",
                        Encoding.UTF8,
                        "application/json")
                });
            }

            string responseJson = returnMatchVerdict
                ? "{\"samePerson\":true,\"isLiveHuman\":true,\"similarity\":0.91,\"reason\":\"Live frame matches all 4 cached enrollment poses.\"}"
                : "{\"samePerson\":false,\"isLiveHuman\":true,\"similarity\":0.18,\"reason\":\"Facial structure does not match enrolled pose gallery.\"}";

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    BuildAnthropicMessageEnvelope(responseJson, ctx.Model ?? "claude-sonnet-5-5"),
                    Encoding.UTF8,
                    "application/json")
            });
        });

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var config = BuildClaudeConfig();
            var claudeClient = new ClaudeMessagesClient(
                new HttpClient(handler),
                config,
                NullLogger<ClaudeMessagesClient>.Instance);
            IClaudeBiometricIdentityStrategy strategy = new ClaudeCachedPoseIdentityStrategy(
                claudeClient,
                config,
                NullLogger<ClaudeCachedPoseIdentityStrategy>.Instance);

            ClaudeBiometricIdentityResult matchResult = await strategy.VerifyLiveAgainstCachedPosesAsync(
                new ClaudeBiometricIdentityInput(
                    LiveCaptureBase64: liveDataUrl,
                    PoseFramesJson: poseFramesJson),
                CancellationToken.None);

            Assert.True(matchResult.SamePerson);
            Assert.True(matchResult.IsLiveHuman);
            Assert.Equal(0.91, matchResult.Similarity, precision: 2);
            Assert.True(matchResult.UsedFallbackModel);
            Assert.Equal("claude-sonnet-5-5", matchResult.ModelUsed);
            Assert.Equal(["claude-sonnet-4-6", "claude-sonnet-5-5"], handler.RequestedModels);

            StubRequestContext lastRequest = handler.CapturedRequests[^1];
            using var doc = JsonDocument.Parse(lastRequest.Body);
            JsonElement contentArray = doc.RootElement.GetProperty("messages")[0].GetProperty("content");

            List<string> sentImagePayloads = [];
            foreach (JsonElement block in contentArray.EnumerateArray())
            {
                if (block.TryGetProperty("type", out JsonElement typeProp) &&
                    string.Equals(typeProp.GetString(), "image", StringComparison.OrdinalIgnoreCase))
                {
                    string? base64Data = block.GetProperty("source").GetProperty("data").GetString();
                    if (!string.IsNullOrWhiteSpace(base64Data))
                    {
                        sentImagePayloads.Add(base64Data);
                    }
                }
            }

            Assert.Equal(5, sentImagePayloads.Count);
            Assert.Contains(Convert.ToBase64String(liveBytes), sentImagePayloads);
            Assert.Contains(Convert.ToBase64String(centerBytes), sentImagePayloads);
            Assert.Contains(Convert.ToBase64String(rightBytes), sentImagePayloads);
            Assert.Contains(Convert.ToBase64String(leftBytes), sentImagePayloads);
            Assert.Contains(Convert.ToBase64String(blinkBytes), sentImagePayloads);

            returnMatchVerdict = false;
            handler.RequestedModels.Clear();

            ClaudeBiometricIdentityResult mismatchResult = await strategy.VerifyLiveAgainstCachedPosesAsync(
                new ClaudeBiometricIdentityInput(
                    LiveCaptureBase64: liveDataUrl,
                    PoseFramesJson: poseFramesJson),
                CancellationToken.None);

            Assert.False(mismatchResult.SamePerson);
            Assert.True(mismatchResult.Similarity < 0.70);
        });
    }

    [Fact]
    public async Task MultiLayerBiometricLoginStrategy_HybridMode_VerifiesSamePersonWithLowLightLocalVector_AndHandles1ToNTopK()
    {
        using var db = CreateInMemoryDbContext();
        var (hash, salt) = ScryptPasswordHelper.HashPassword("SecurePassword123!@#");

        var alice = new User
        {
            Email = "alice@resqtrack.ph",
            FullName = "ALICE VERIFIED",
            FirstName = "ALICE",
            Surname = "VERIFIED",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };

        var bob = new User
        {
            Email = "bob@resqtrack.ph",
            FullName = "BOB VERIFIED",
            FirstName = "BOB",
            Surname = "VERIFIED",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };

        db.Users.AddRange(alice, bob);

        float[] aliceVector = new float[128];
        aliceVector[0] = 1.0f;

        float[] bobVector = new float[128];
        bobVector[1] = 1.0f;

        byte[] aliceCenterBytes = CreateDistinctPngBytes("alice-center");
        string aliceCenterBase64 = Convert.ToBase64String(aliceCenterBytes);

        string alicePoseFramesJson = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["CENTER"] = ToPngDataUrl(aliceCenterBytes),
            ["RIGHT"] = ToPngDataUrl(CreateDistinctPngBytes("alice-right")),
            ["LEFT"] = ToPngDataUrl(CreateDistinctPngBytes("alice-left")),
            ["BLINK"] = ToPngDataUrl(CreateDistinctPngBytes("alice-blink"))
        });

        string bobPoseFramesJson = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["CENTER"] = ToPngDataUrl(CreateDistinctPngBytes("bob-center")),
            ["RIGHT"] = ToPngDataUrl(CreateDistinctPngBytes("bob-right")),
            ["LEFT"] = ToPngDataUrl(CreateDistinctPngBytes("bob-left")),
            ["BLINK"] = ToPngDataUrl(CreateDistinctPngBytes("bob-blink"))
        });

        db.BiometricEnrollments.AddRange(
            new BiometricEnrollment
            {
                UserId = alice.Id,
                EncryptedTemplateData = ToFloatBytes(aliceVector),
                PoseFramesJson = alicePoseFramesJson,
                TemplateFormat = "128D_FLOAT32_NORMALIZED",
                ModelIdentifier = "ResQTrack_Hybrid_CSLBP_Gabor_Haar",
                ModelVersion = "v1.0.0",
                EnrollmentStatus = "ACTIVE",
                EnrolledAtUtc = DateTime.UtcNow
            },
            new BiometricEnrollment
            {
                UserId = bob.Id,
                EncryptedTemplateData = ToFloatBytes(bobVector),
                PoseFramesJson = bobPoseFramesJson,
                TemplateFormat = "128D_FLOAT32_NORMALIZED",
                ModelIdentifier = "ResQTrack_Hybrid_CSLBP_Gabor_Haar",
                ModelVersion = "v1.0.0",
                EnrollmentStatus = "ACTIVE",
                EnrolledAtUtc = DateTime.UtcNow
            });

        await db.SaveChangesAsync();

        // Low-light drifted local vector: cosine ~0.40 (< 0.82) against Alice, 0.0 against Bob.
        float[] driftedVector = new float[128];
        driftedVector[0] = 0.40f;
        driftedVector[2] = MathF.Sqrt(1.0f - (0.40f * 0.40f));

        double aliceCosine = MultiLayerBiometricLoginStrategy.ComputeCosineSimilarity(driftedVector, aliceVector);
        Assert.InRange(aliceCosine, 0.35, 0.45);

        string liveCaptureDataUrl = ToPngDataUrl(CreateDistinctPngBytes("alice-low-light-live"));
        bool claudeConfirmsAliceMatch = true;

        var handler = new StubClaudeHttpMessageHandler((ctx, _) =>
        {
            bool isAliceGallery = ctx.Body.Contains(aliceCenterBase64, StringComparison.Ordinal);
            string verdictJson = claudeConfirmsAliceMatch && isAliceGallery
                ? "{\"samePerson\":true,\"isLiveHuman\":true,\"similarity\":0.91,\"reason\":\"Live low-light frame matches Alice's cached 4-pose gallery.\"}"
                : "{\"samePerson\":false,\"isLiveHuman\":true,\"similarity\":0.19,\"reason\":\"Live frame does not match enrolled pose gallery.\"}";

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    BuildAnthropicMessageEnvelope(verdictJson, ctx.Model ?? "claude-sonnet-4-6"),
                    Encoding.UTF8,
                    "application/json")
            });
        });

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var config = BuildClaudeConfig();
            var claudeClient = new ClaudeMessagesClient(
                new HttpClient(handler),
                config,
                NullLogger<ClaudeMessagesClient>.Instance);
            var claudeStrategy = new ClaudeCachedPoseIdentityStrategy(
                claudeClient,
                config,
                NullLogger<ClaudeCachedPoseIdentityStrategy>.Instance);
            var loginStrategy = new MultiLayerBiometricLoginStrategy(db, null, null, claudeStrategy);

            // Case A1: 1:1 low-light drifted local vector + LiveCaptureBase64 -> Claude confirms SamePerson = true -> SUCCEEDS
            claudeConfirmsAliceMatch = true;
            BiometricMultiLayerEvaluationResult caseAMatch = await loginStrategy.ExecuteLayersAsync(
                new BiometricMultiLayerContext
                {
                    Email = "alice@resqtrack.ph",
                    LiveCaptureBase64 = liveCaptureDataUrl,
                    LiveDescriptorVector = driftedVector,
                    LivenessScore = 0.96,
                    PortalOrigin = "ResponderCivilian"
                });

            Assert.True(caseAMatch.IsValidated);
            Assert.Equal("SUCCESS_LOGIN", caseAMatch.ValidationVerdict);
            Assert.Equal(alice.Id, caseAMatch.MatchedUserId);
            Assert.Equal("alice@resqtrack.ph", caseAMatch.MatchedEmail);

            // Case A2: 1:1 low-light drifted local vector + LiveCaptureBase64 -> Claude returns SamePerson = false -> REJECTS
            claudeConfirmsAliceMatch = false;
            BiometricMultiLayerEvaluationResult caseAReject = await loginStrategy.ExecuteLayersAsync(
                new BiometricMultiLayerContext
                {
                    Email = "alice@resqtrack.ph",
                    LiveCaptureBase64 = liveCaptureDataUrl,
                    LiveDescriptorVector = driftedVector,
                    LivenessScore = 0.96,
                    PortalOrigin = "ResponderCivilian"
                });

            Assert.False(caseAReject.IsValidated);
            Assert.Equal("INVALID", caseAReject.ValidationVerdict);
            Assert.Null(caseAReject.MatchedUserId);

            // Case B: 1:N without Email, only LiveCaptureBase64 + drifted local vector -> selects Top-K candidate (alice@resqtrack.ph) and verifies via Claude cached-pose strategy
            claudeConfirmsAliceMatch = true;
            handler.CapturedRequests.Clear();

            BiometricMultiLayerEvaluationResult caseB1ToN = await loginStrategy.ExecuteLayersAsync(
                new BiometricMultiLayerContext
                {
                    Email = null,
                    LiveCaptureBase64 = liveCaptureDataUrl,
                    LiveDescriptorVector = driftedVector,
                    LivenessScore = 0.96,
                    PortalOrigin = "ResponderCivilian"
                });

            Assert.True(caseB1ToN.IsValidated);
            Assert.Equal("SUCCESS_LOGIN", caseB1ToN.ValidationVerdict);
            Assert.Equal(alice.Id, caseB1ToN.MatchedUserId);
            Assert.Equal("alice@resqtrack.ph", caseB1ToN.MatchedEmail);
            Assert.Contains(handler.CapturedRequests, r => r.Body.Contains(aliceCenterBase64, StringComparison.Ordinal));
        });
    }

    [Fact]
    public async Task AuthService_SuccessfulSignIn_ResetsPriorFailedLoginLockoutWindow()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        const string validPassword = "CorrectPassword123!@#";
        var (hash, salt) = ScryptPasswordHelper.HashPassword(validPassword);

        var pwUser = new User
        {
            Email = "pw.lockout.reset@resqtrack.gov.ph",
            FullName = "PW LOCKOUT RESET",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };

        var bioUser = new User
        {
            Email = "bio.lockout.reset@resqtrack.gov.ph",
            FullName = "BIO LOCKOUT RESET",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };

        await userRepo.AddAsync(pwUser);
        await userRepo.AddAsync(bioUser);

        float[] enrolledVector = new float[128];
        enrolledVector[0] = 1.0f;

        db.BiometricEnrollments.Add(new BiometricEnrollment
        {
            UserId = bioUser.Id,
            EncryptedTemplateData = ToFloatBytes(enrolledVector),
            TemplateFormat = "128D_FLOAT32_NORMALIZED",
            ModelIdentifier = "ResQTrack_Hybrid_CSLBP_Gabor_Haar",
            ModelVersion = "v1.0.0",
            EnrollmentStatus = "ACTIVE",
            EnrolledAtUtc = DateTime.UtcNow
        });

        DateTime now = DateTime.UtcNow;

        for (int i = 0; i < 5; i++)
        {
            db.LoginAttempts.Add(new LoginAttempt
            {
                AccountIdentifier = pwUser.Email,
                AttemptType = "PASSWORD",
                Success = false,
                FailureReason = "INVALID_PASSWORD",
                AttemptedAtUtc = now.AddMinutes(-6 + i)
            });

            db.LoginAttempts.Add(new LoginAttempt
            {
                AccountIdentifier = bioUser.Email,
                AttemptType = "BIOMETRIC_1TO1",
                Success = false,
                FailureReason = "BIOMETRIC_MISMATCH",
                AttemptedAtUtc = now.AddMinutes(-6 + i)
            });
        }

        // Recorded successful attempt strictly after the 5 failures resets the lockout cutoff.
        db.LoginAttempts.AddRange(
            new LoginAttempt
            {
                AccountIdentifier = pwUser.Email,
                AttemptType = "PASSWORD",
                Success = true,
                AttemptedAtUtc = now.AddSeconds(-10)
            },
            new LoginAttempt
            {
                AccountIdentifier = bioUser.Email,
                AttemptType = "BIOMETRIC_1TO1",
                Success = true,
                AttemptedAtUtc = now.AddSeconds(-10)
            });

        await db.SaveChangesAsync();

        var (pwSuccess, pwError, pwToken, _) = await authService.LoginAsync(
            new LoginRequest(pwUser.Email, validPassword, "Civilian", "Landing"),
            "127.0.0.1",
            "TestAgent");

        Assert.True(pwSuccess, $"Expected password login after success reset to succeed, got error: {pwError}");
        Assert.Null(pwError);
        Assert.False(string.IsNullOrWhiteSpace(pwToken));

        var (bioSuccess, bioError, bioToken, _) = await authService.BiometricLoginAsync(
            new BiometricLoginRequest(bioUser.Email, enrolledVector),
            "127.0.0.1",
            "TestAgent");

        Assert.True(bioSuccess, $"Expected biometric login after success reset to succeed, got error: {bioError}");
        Assert.Null(bioError);
        Assert.False(string.IsNullOrWhiteSpace(bioToken));
    }

    [Fact]
    public async Task AuthService_ExpiredLockoutWindowAllowsLogin_AndActiveLockoutReportsDynamicRemainingMinutes()
    {
        using var db = CreateInMemoryDbContext();
        var userRepo = new UserRepository(db);
        var sessionRepo = new SessionRepository(db);
        var auditRepo = new AuditLogRepository(db);
        var authService = new AuthService(userRepo, sessionRepo, auditRepo, db);

        const string validPassword = "CorrectPassword123!@#";
        var (hash, salt) = ScryptPasswordHelper.HashPassword(validPassword);

        var expiredUser = new User
        {
            Email = "expired.lockout@resqtrack.gov.ph",
            FullName = "EXPIRED LOCKOUT USER",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };

        var activeLockedUser = new User
        {
            Email = "active.lockout@resqtrack.gov.ph",
            FullName = "ACTIVE LOCKOUT USER",
            Role = UserRole.Civilian,
            Status = AccountStatus.Verified,
            PasswordHash = hash,
            PasswordSalt = salt
        };

        await userRepo.AddAsync(expiredUser);
        await userRepo.AddAsync(activeLockedUser);

        DateTime now = DateTime.UtcNow;

        for (int i = 0; i < 5; i++)
        {
            db.LoginAttempts.Add(new LoginAttempt
            {
                AccountIdentifier = expiredUser.Email,
                AttemptType = "PASSWORD",
                Success = false,
                FailureReason = "INVALID_PASSWORD",
                AttemptedAtUtc = now.AddMinutes(-16)
            });

            db.LoginAttempts.Add(new LoginAttempt
            {
                AccountIdentifier = activeLockedUser.Email,
                AttemptType = "PASSWORD",
                Success = false,
                FailureReason = "INVALID_PASSWORD",
                AttemptedAtUtc = now.AddMinutes(-10).AddSeconds(-1)
            });
        }

        await db.SaveChangesAsync();

        var (expiredSuccess, expiredError, expiredToken, _) = await authService.LoginAsync(
            new LoginRequest(expiredUser.Email, validPassword, "Civilian", "Landing"),
            "127.0.0.1",
            "TestAgent");

        Assert.True(expiredSuccess, $"Expected login with expired (>15m) failures to succeed, got error: {expiredError}");
        Assert.Null(expiredError);
        Assert.False(string.IsNullOrWhiteSpace(expiredToken));

        var (lockedSuccess, lockedError, _, _) = await authService.LoginAsync(
            new LoginRequest(activeLockedUser.Email, validPassword, "Civilian", "Landing"),
            "127.0.0.1",
            "TestAgent");

        Assert.False(lockedSuccess);
        Assert.NotNull(lockedError);
        Assert.Contains("locked", lockedError, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("wait 5 minute", lockedError, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("wait 15 minute", lockedError, StringComparison.OrdinalIgnoreCase);

        float[] probeVector = new float[128];
        probeVector[0] = 1.0f;

        var (bioLockedSuccess, bioLockedError, _, _) = await authService.BiometricLoginAsync(
            new BiometricLoginRequest(activeLockedUser.Email, probeVector),
            "127.0.0.1",
            "TestAgent");

        Assert.False(bioLockedSuccess);
        Assert.NotNull(bioLockedError);
        Assert.DoesNotContain("locked", bioLockedError, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("wait", bioLockedError, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("No active biometric enrollment", bioLockedError, StringComparison.OrdinalIgnoreCase);
    }

    private static AppDbContext CreateInMemoryDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options);

    private static IConfiguration BuildClaudeConfig(
        string? apiKey = TestApiKeyPlaceholder,
        string? primaryModel = null,
        string? fallbackModel = null,
        string? timeoutSeconds = null)
    {
        var values = new Dictionary<string, string?>();
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            values["Claude:ApiKey"] = apiKey;
        }
        if (!string.IsNullOrWhiteSpace(primaryModel))
        {
            values["Claude:Model"] = primaryModel;
        }
        if (!string.IsNullOrWhiteSpace(fallbackModel))
        {
            values["Claude:FallbackModel"] = fallbackModel;
        }
        if (!string.IsNullOrWhiteSpace(timeoutSeconds))
        {
            values["Claude:TimeoutSeconds"] = timeoutSeconds;
        }

        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }

    private static string BuildAnthropicMessageEnvelope(string assistantText, string model = "claude-sonnet-4-6") =>
        JsonSerializer.Serialize(new
        {
            id = "msg_test_fast_ocr",
            type = "message",
            role = "assistant",
            model,
            content = new[]
            {
                new { type = "text", text = assistantText }
            }
        });

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
            foreach (string key in keys)
            {
                Environment.SetEnvironmentVariable(key, null);
            }

            await action();
        }
        finally
        {
            foreach (KeyValuePair<string, string?> kvp in previous)
            {
                Environment.SetEnvironmentVariable(kvp.Key, kvp.Value);
            }
        }
    }

    private static IFormFile CreateImageFormFile(byte[] bytes, string fileName, string contentType = "image/png") =>
        new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };

    private static string ToPngDataUrl(byte[] pngBytes) =>
        $"data:image/png;base64,{Convert.ToBase64String(pngBytes)}";

    private static byte[] ToFloatBytes(float[] vector)
    {
        byte[] bytes = new byte[vector.Length * sizeof(float)];
        Buffer.BlockCopy(vector, 0, bytes, 0, bytes.Length);
        return bytes;
    }

    private static byte[] CreateDistinctPngBytes(string tag)
    {
        byte[] basePng = CaptureStorageHelper.GenerateSyntheticFallbackPng();
        const int iendSize = 12;
        int prefixLength = basePng.Length - iendSize;

        byte[] chunkType = Encoding.ASCII.GetBytes("tEXt");
        byte[] chunkData = Encoding.ASCII.GetBytes($"Tag\0{tag}");
        byte[] crcInput = new byte[chunkType.Length + chunkData.Length];
        Buffer.BlockCopy(chunkType, 0, crcInput, 0, chunkType.Length);
        Buffer.BlockCopy(chunkData, 0, crcInput, chunkType.Length, chunkData.Length);

        uint crc = ComputeCrc32(crcInput);
        byte[] output = new byte[prefixLength + 4 + chunkType.Length + chunkData.Length + 4 + iendSize];

        Buffer.BlockCopy(basePng, 0, output, 0, prefixLength);
        int offset = prefixLength;
        BinaryPrimitives.WriteUInt32BigEndian(output.AsSpan(offset, 4), (uint)chunkData.Length);
        offset += 4;
        Buffer.BlockCopy(chunkType, 0, output, offset, chunkType.Length);
        offset += chunkType.Length;
        Buffer.BlockCopy(chunkData, 0, output, offset, chunkData.Length);
        offset += chunkData.Length;
        BinaryPrimitives.WriteUInt32BigEndian(output.AsSpan(offset, 4), crc);
        offset += 4;
        Buffer.BlockCopy(basePng, prefixLength, output, offset, iendSize);

        return output;
    }

    private static uint ComputeCrc32(byte[] data)
    {
        uint crc = 0xFFFFFFFFu;
        foreach (byte b in data)
        {
            crc ^= b;
            for (int bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
            }
        }
        return ~crc;
    }

    private sealed record StubRequestContext(string? Model, string Body, HttpRequestMessage Request);

    private sealed class StubClaudeHttpMessageHandler(Func<StubRequestContext, CancellationToken, Task<HttpResponseMessage>> responder)
        : HttpMessageHandler
    {
        public List<string> RequestedModels { get; } = [];
        public List<StubRequestContext> CapturedRequests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            string body = request.Content != null
                ? await request.Content.ReadAsStringAsync(cancellationToken)
                : string.Empty;

            string? model = null;
            if (!string.IsNullOrWhiteSpace(body))
            {
                try
                {
                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("model", out JsonElement modelProp))
                    {
                        model = modelProp.GetString();
                    }
                }
                catch
                {
                    model = null;
                }
            }

            if (!string.IsNullOrWhiteSpace(model))
            {
                RequestedModels.Add(model);
            }

            var context = new StubRequestContext(model, body, request);
            CapturedRequests.Add(context);
            return await responder(context, cancellationToken);
        }
    }

    private sealed class RecordingStubClaudeMessagesClient(
        string primaryModel,
        string fallbackModel,
        Func<IReadOnlyDictionary<string, object>, string?, ClaudeMessageAttemptResult> responder) : IClaudeMessagesClient
    {
        public bool IsConfigured => true;
        public string PrimaryModel => primaryModel;
        public string FallbackModel => fallbackModel;
        public List<string> RequestedModels { get; } = [];

        public Task<ClaudeMessageAttemptResult> SendMessagesAsync(
            IReadOnlyDictionary<string, object> payloadWithoutModel,
            CancellationToken ct = default,
            string? modelOverride = null)
        {
            string effectiveModel = string.IsNullOrWhiteSpace(modelOverride) ? PrimaryModel : modelOverride.Trim();
            RequestedModels.Add(effectiveModel);
            return Task.FromResult(responder(payloadWithoutModel, modelOverride));
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

    private sealed class SlowFailingDistributedCache(int delayMs) : IDistributedCache
    {
        private int _callCount;
        public int CallCount => Volatile.Read(ref _callCount);

        public byte[]? Get(string key) =>
            SimulateSyncFailure<byte[]?>();

        public async Task<byte[]?> GetAsync(string key, CancellationToken token = default)
        {
            await SimulateDelayAndThrowAsync(token);
            return null;
        }

        public void Refresh(string key) =>
            SimulateSyncFailure<int>();

        public Task RefreshAsync(string key, CancellationToken token = default) =>
            SimulateDelayAndThrowAsync(token);

        public void Remove(string key) =>
            SimulateSyncFailure<int>();

        public Task RemoveAsync(string key, CancellationToken token = default) =>
            SimulateDelayAndThrowAsync(token);

        public void Set(string key, byte[] value, DistributedCacheEntryOptions options) =>
            SimulateSyncFailure<int>();

        public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default) =>
            SimulateDelayAndThrowAsync(token);

        private async Task SimulateDelayAndThrowAsync(CancellationToken token)
        {
            Interlocked.Increment(ref _callCount);
            await Task.Delay(delayMs, token);
            throw new TimeoutException(
                "Simulated Redis offline connection timeout.",
                new SocketException((int)SocketError.TimedOut));
        }

        private T SimulateSyncFailure<T>()
        {
            Interlocked.Increment(ref _callCount);
            Thread.Sleep(delayMs);
            throw new TimeoutException(
                "Simulated Redis offline connection timeout.",
                new SocketException((int)SocketError.TimedOut));
        }
    }
}
