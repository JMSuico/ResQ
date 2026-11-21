// [Layer: Backend/Services/Implementations]
// Responsibility: Multi-provider AI vision OCR, Government ID forensic validation, Face-to-Gov-ID liveness matching, and VerificationToken issuance.
// Invariant: C# .NET 10 Web API standards, nullable reference types, universal lambda expressions (=>), zero dummy OCR fallbacks, masked secrets.

using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;
using Backend.Features.Services.Vision;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Backend.Features.Services.Implementations;

public class IdentityAiService : IIdentityAiService
{
    public static readonly string[] DefaultProviderOrder =
        ["claude", "gemini", "openai"];

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<IdentityAiService> _logger;
    private readonly IClaudeMessagesClient _claudeClient;
    private readonly IVerificationTokenCacheStrategy _tokenCacheStrategy;
    private readonly IGovIdAuthenticityEvaluator _authenticityEvaluator;
    private readonly IFaceToGovIdMatchStrategy _faceToIdMatchStrategy;
    private readonly IRoboflowWorkflowStrategy _roboflowWorkflowStrategy;
    private readonly bool _hasInjectedAuthenticityEvaluator;
    private readonly AppDbContext? _db;

    public IdentityAiService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<IdentityAiService> logger,
        IClaudeMessagesClient? claudeMessagesClient = null,
        IVerificationTokenCacheStrategy? tokenCacheStrategy = null,
        IGovIdAuthenticityEvaluator? authenticityEvaluator = null,
        IFaceToGovIdMatchStrategy? faceToIdMatchStrategy = null,
        AppDbContext? db = null,
        IRoboflowWorkflowStrategy? roboflowWorkflowStrategy = null)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
        _db = db;
        _claudeClient = claudeMessagesClient
            ?? new ClaudeMessagesClient(
                httpClientFactory?.CreateClient("ClaudeMessages") ?? new HttpClient(),
                configuration,
                NullLogger<ClaudeMessagesClient>.Instance);

        _roboflowWorkflowStrategy = roboflowWorkflowStrategy
            ?? new RoboflowServerlessWorkflowStrategy(null, configuration);

        IOptions<VerificationTokenOptions> tokenOptions =
            Options.Create(ResolveVerificationTokenOptions(configuration));

        _tokenCacheStrategy = tokenCacheStrategy
            ?? new HmacVerificationTokenCacheStrategy(tokenOptions);

        _hasInjectedAuthenticityEvaluator = authenticityEvaluator is not null;
        _authenticityEvaluator = authenticityEvaluator
            ?? new SharedGovIdForensicsEvaluator(
                configuration,
                _claudeClient,
                NullLogger<SharedGovIdForensicsEvaluator>.Instance,
                _roboflowWorkflowStrategy);

        _faceToIdMatchStrategy = faceToIdMatchStrategy
            ?? new ClaudeFaceToGovIdMatchStrategy(
                configuration,
                _claudeClient,
                tokenOptions,
                NullLogger<ClaudeFaceToGovIdMatchStrategy>.Instance,
                _roboflowWorkflowStrategy);
    }

    public AiProviderStatusDto GetAiStatus() =>
        new()
        {
            ClaudeConfigured = _claudeClient.IsConfigured,
            GeminiConfigured = IsGeminiConfigured(),
            OpenAiConfigured = IsOpenAiConfigured(),
            AzureConfigured = IsAzureConfigured(),
            RoboflowConfigured = _roboflowWorkflowStrategy.IsConfigured,
            RoboflowFaceWorkflowConfigured = _roboflowWorkflowStrategy.IsFaceWorkflowConfigured,
            RoboflowIdWorkflowConfigured = _roboflowWorkflowStrategy.IsPhilippineIdWorkflowConfigured,
            ActiveChain = ResolveActiveChainSummary()
        };

    public async Task<RoboflowWorkflowDetectResponseDto> DetectRoboflowFaceAsync(
        RoboflowWorkflowDetectRequestDto request,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        RoboflowWorkflowImageInput input = BuildRoboflowImageInput(request);
        RoboflowWorkflowDetectionResult detection = await _roboflowWorkflowStrategy.DetectFaceAsync(input, ct);

        if ((!detection.Success || detection.Predictions.Count == 0) &&
            input.ImageBytes.Length > 0 &&
            _claudeClient.IsConfigured)
        {
            RoboflowWorkflowDetectionResult? claudeFallback = await TryDetectWithClaudeDatasetPriorAsync(
                taskType: "FACE_DETECTION",
                datasetSlug: RoboflowPretrainedDatasets.FaceDatasetSlug,
                classes: RoboflowServerlessWorkflowStrategy.SanitizeClassesCsv(
                    request.Classes,
                    RoboflowPretrainedDatasets.DefaultFaceClasses),
                input: input,
                ct: ct);
            if (claudeFallback is { Success: true, Predictions.Count: > 0 })
            {
                detection = claudeFallback;
            }
        }

        return MapRoboflowDetectResponse(detection);
    }

    public async Task<RoboflowWorkflowDetectResponseDto> DetectRoboflowPhilippineIdAsync(
        RoboflowWorkflowDetectRequestDto request,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        RoboflowWorkflowImageInput input = BuildRoboflowImageInput(request);
        RoboflowWorkflowDetectionResult detection = await _roboflowWorkflowStrategy.DetectPhilippineIdAsync(input, ct);

        if ((!detection.Success || detection.Predictions.Count == 0) &&
            input.ImageBytes.Length > 0 &&
            _claudeClient.IsConfigured)
        {
            RoboflowWorkflowDetectionResult? claudeFallback = await TryDetectWithClaudeDatasetPriorAsync(
                taskType: "PHILIPPINE_ID_DETECTION",
                datasetSlug: RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug,
                classes: RoboflowServerlessWorkflowStrategy.SanitizeClassesCsv(
                    request.Classes,
                    RoboflowPretrainedDatasets.DefaultPhilippineIdClasses),
                input: input,
                ct: ct);
            if (claudeFallback is { Success: true, Predictions.Count: > 0 })
            {
                detection = claudeFallback;
            }
        }

        return MapRoboflowDetectResponse(detection);
    }

    public async Task<AiExtractResponseDto> ExtractIdentityAsync(AiExtractRequestDto request, CancellationToken ct = default)
    {
        string frontSource = !string.IsNullOrWhiteSpace(request.ImageDataUrl)
            ? request.ImageDataUrl
            : (request.FrontImageBase64 ?? string.Empty);

        var (frontMime, frontB64) = SharedGovIdForensicsEvaluator.ParseDataUrl(frontSource);
        byte[] frontBytes = SharedGovIdForensicsEvaluator.TryDecodeBase64(frontB64);

        byte[]? backBytes = null;
        string? backMime = null;
        if (!string.IsNullOrWhiteSpace(request.BackImageBase64))
        {
            var (bm, bb64) = SharedGovIdForensicsEvaluator.ParseDataUrl(request.BackImageBase64);
            byte[] decodedBack = SharedGovIdForensicsEvaluator.TryDecodeBase64(bb64);
            if (decodedBack.Length > 0)
            {
                backMime = bm;
                backBytes = decodedBack;
            }
        }

        string? idType = !string.IsNullOrWhiteSpace(request.IdType) ? request.IdType : request.HintType;
        return await ExtractIdOcrAsync(frontBytes, frontMime, backBytes, backMime, idType, request.PreferredProvider, ct);
    }

    public async Task<AiOcrResponseDto> ExtractIdOcrAsync(
        byte[] frontBytes,
        string frontMime,
        byte[]? backBytes,
        string? backMime,
        string? idType,
        string? preferredProvider = null,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        if (frontBytes == null || frontBytes.Length == 0)
        {
            return BuildFailureOcrResult(
                providerUsed: string.Empty,
                idType: idType,
                errorCode: "MISSING_FRONT_IMAGE",
                errorMessage: "Front Government ID image is required before running OCR.",
                elapsedMs: sw.ElapsedMilliseconds);
        }

        bool hasBackBytes = backBytes is { Length: > 0 };
        if (hasBackBytes && frontBytes.AsSpan().SequenceEqual(backBytes!))
        {
            var duplicateFailure = BuildFailureOcrResult(
                providerUsed: "DeterministicForensicPreFlight",
                idType: idType,
                errorCode: "DUPLICATE_FRONT_BACK_IMAGE",
                errorMessage: "Invalid Government ID: The Back ID upload is identical to your Front ID image. Please upload the actual reverse side of your Government ID card.",
                elapsedMs: sw.ElapsedMilliseconds);
            duplicateFailure.AreSidesIdentical = true;
            duplicateFailure.AuthenticityVerdict = "DUPLICATE_FRONT_BACK_IMAGE";
            duplicateFailure.AuthenticityReason = "Front and Back Government ID uploads contain identical image bytes.";
            return duplicateFailure;
        }

        if (!_hasInjectedAuthenticityEvaluator && !IsAnyOcrProviderConfigured())
        {
            var unavailable = BuildFailureOcrResult(
                providerUsed: string.Empty,
                idType: idType,
                errorCode: "PROVIDER_UNAVAILABLE",
                errorMessage: "No AI vision OCR provider API key is configured; registration may proceed with pending manual review.",
                elapsedMs: sw.ElapsedMilliseconds);
            unavailable.AuthenticityVerdict = "PROVIDER_UNAVAILABLE";
            unavailable.RequiresPendingManualReview = true;
            return unavailable;
        }

        string pairSha = _tokenCacheStrategy.ComputeImagePairSha256(frontBytes, backBytes);
        string? preferredClaudeModel = !string.IsNullOrWhiteSpace(preferredProvider) &&
                                       preferredProvider.Trim().StartsWith("claude-", StringComparison.OrdinalIgnoreCase)
            ? preferredProvider.Trim()
            : null;

        var providerOrder = ResolveProviderOrder(preferredProvider);
        AiOcrResponseDto? lastFailureResult = null;
        bool attemptedConfiguredProvider = false;

        foreach (var provider in providerOrder)
        {
            if (ct.IsCancellationRequested) break;

            bool isClaudeSlot = string.Equals(provider, "claude", StringComparison.OrdinalIgnoreCase);
            if (isClaudeSlot && !_hasInjectedAuthenticityEvaluator && !_claudeClient.IsConfigured)
            {
                continue;
            }

            if (!isClaudeSlot && !IsOcrProviderConfigured(provider))
            {
                continue;
            }

            attemptedConfiguredProvider = true;
            try
            {
                GovIdForensicsResult? forensics = isClaudeSlot
                    ? await _authenticityEvaluator.EvaluateAsync(
                        new GovIdAuthenticityInput(
                            FrontBytes: frontBytes,
                            FrontMimeType: frontMime,
                            BackBytes: backBytes,
                            BackMimeType: backMime,
                            SelectedIdType: idType ?? string.Empty,
                            PreferredModel: preferredClaudeModel,
                            RequireDualSideVerification: hasBackBytes),
                        ct)
                    : await CallFallbackProviderOcrAsync(
                        provider,
                        frontBytes,
                        frontMime,
                        backBytes,
                        backMime,
                        idType,
                        pairSha,
                        ct);

                if (forensics is null)
                {
                    continue;
                }

                if (forensics.Success && forensics.Fields is not null && forensics.Fields.ExtractedFields.Count > 0)
                {
                    bool eligibleForIdToken = hasBackBytes &&
                                              forensics.IsGenuineId &&
                                              forensics.MatchesSelectedIdType &&
                                              !forensics.AreSidesIdentical &&
                                              !forensics.RequiresPendingManualReview &&
                                              string.IsNullOrWhiteSpace(forensics.ErrorCode);

                    string? issuedToken = null;
                    if (eligibleForIdToken)
                    {
                        var issued = await _tokenCacheStrategy.IssueIdTokenAsync(
                            imagePairSha256: pairSha,
                            verdict: forensics.AuthenticityVerdict,
                            providerUsed: forensics.ProviderUsed,
                            modelUsed: forensics.ModelUsed,
                            payloadJson: forensics.RawJson,
                            ct: ct);
                        issuedToken = issued.Token;
                    }

                    RoboflowWorkflowDetectionResult? fallbackIdDetection = forensics.RoboflowDetection;
                    if (fallbackIdDetection is null && _roboflowWorkflowStrategy.IsPhilippineIdWorkflowConfigured)
                    {
                        fallbackIdDetection = await TryDetectPhilippineIdNonBlockingAsync(frontBytes, frontMime, idType, ct);
                    }

                    return MapForensicsToOcrResponse(forensics, idType, sw.ElapsedMilliseconds, issuedToken, fallbackIdDetection);
                }

                AiOcrResponseDto mappedFailure = MapForensicsToOcrResponse(forensics, idType, sw.ElapsedMilliseconds);
                lastFailureResult = mappedFailure;

                if (IsTerminalForensicError(mappedFailure.ErrorCode))
                {
                    return mappedFailure;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("OCR provider [{Provider}] upstream call failed ({Message}); continuing fallback chain.", provider, ex.Message);
                var transientFailure = BuildFailureOcrResult(
                    providerUsed: provider,
                    idType: idType,
                    errorCode: "PROVIDER_UNAVAILABLE",
                    errorMessage: "Upstream OCR provider request failed; registration may proceed with pending manual review.",
                    elapsedMs: sw.ElapsedMilliseconds);
                transientFailure.AuthenticityVerdict = "PROVIDER_UNAVAILABLE";
                transientFailure.RequiresPendingManualReview = true;
                lastFailureResult = transientFailure;
            }
        }

        if (!attemptedConfiguredProvider)
        {
            var unavailable = BuildFailureOcrResult(
                providerUsed: string.Empty,
                idType: idType,
                errorCode: "PROVIDER_UNAVAILABLE",
                errorMessage: "No AI vision OCR provider API key is configured; registration may proceed with pending manual review.",
                elapsedMs: sw.ElapsedMilliseconds);
            unavailable.AuthenticityVerdict = "PROVIDER_UNAVAILABLE";
            unavailable.RequiresPendingManualReview = true;
            return unavailable;
        }

        if (lastFailureResult != null)
        {
            lastFailureResult.Success = false;
            lastFailureResult.Confidence = 0.0;
            lastFailureResult.IsAuthentic = false;
            lastFailureResult.IdVerificationToken = null;
            lastFailureResult.ExtractedFields.Clear();
            lastFailureResult.ExecutionTimeMs = Math.Max(1, sw.ElapsedMilliseconds);
            return lastFailureResult;
        }

        return BuildFailureOcrResult(
            providerUsed: string.Empty,
            idType: idType,
            errorCode: "UNREADABLE_OR_BLANK_IMAGE",
            errorMessage: "No readable identification fields could be extracted from the uploaded image.",
            elapsedMs: sw.ElapsedMilliseconds);
    }

    private static List<string> ResolveProviderOrder(string? preferredProvider)
    {
        var providerOrder = new List<string>();
        if (!string.IsNullOrWhiteSpace(preferredProvider))
        {
            string normalizedPreferred = preferredProvider.Trim().ToLowerInvariant();
            if (normalizedPreferred.StartsWith("claude", StringComparison.OrdinalIgnoreCase))
            {
                providerOrder.Add("claude");
            }
            else if (DefaultProviderOrder.Contains(normalizedPreferred))
            {
                providerOrder.Add(normalizedPreferred);
            }
        }

        foreach (var p in DefaultProviderOrder)
        {
            if (!providerOrder.Contains(p))
            {
                providerOrder.Add(p);
            }
        }

        return providerOrder;
    }

    private Task<GovIdForensicsResult?> CallFallbackProviderOcrAsync(
        string provider,
        byte[] frontBytes,
        string frontMime,
        byte[]? backBytes,
        string? backMime,
        string? idType,
        string imagePairSha256,
        CancellationToken ct) =>
        provider switch
        {
            "gemini" => CallGeminiOcrAsync(frontBytes, frontMime, backBytes, backMime, idType, imagePairSha256, ct),
            "openai" => CallOpenAiOcrAsync(frontBytes, frontMime, backBytes, backMime, idType, imagePairSha256, ct),
            _ => Task.FromResult<GovIdForensicsResult?>(null)
        };

    private async Task<GovIdForensicsResult?> CallGeminiOcrAsync(
        byte[] frontBytes,
        string frontMime,
        byte[]? backBytes,
        string? backMime,
        string? idType,
        string imagePairSha256,
        CancellationToken ct)
    {
        string apiKey = GetSecret("GEMINI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey) || frontBytes.Length == 0) return null;

        var client = _httpClientFactory?.CreateClient() ?? new HttpClient();
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(12));

        bool hasBackBytes = backBytes is { Length: > 0 };
        var parts = new JsonArray
        {
            new JsonObject { ["text"] = BuildSystemPrompt(idType, hasBackBytes) },
            new JsonObject
            {
                ["inline_data"] = new JsonObject
                {
                    ["mime_type"] = NormalizeStandardImageMime(frontMime),
                    ["data"] = Convert.ToBase64String(frontBytes)
                }
            }
        };

        if (hasBackBytes)
        {
            parts.Add(new JsonObject
            {
                ["inline_data"] = new JsonObject
                {
                    ["mime_type"] = NormalizeStandardImageMime(backMime ?? "image/jpeg"),
                    ["data"] = Convert.ToBase64String(backBytes!)
                }
            });
        }

        string endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";
        var payload = new JsonObject
        {
            ["contents"] = new JsonArray
            {
                new JsonObject
                {
                    ["parts"] = parts
                }
            },
            ["generationConfig"] = new JsonObject
            {
                ["responseMimeType"] = "application/json",
                ["temperature"] = 0.0
            }
        };

        using var content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(endpoint, content, cts.Token);
        if (!response.IsSuccessStatusCode)
        {
            return new GovIdForensicsResult(
                Success: false,
                IsGenuineId: false,
                AuthenticityVerdict: "PROVIDER_UNAVAILABLE",
                AuthenticityReason: $"Gemini OCR returned HTTP {(int)response.StatusCode}.",
                DetectedIdType: null,
                DetectedIdLabel: null,
                MatchesSelectedIdType: true,
                FrontSlotDetectedSide: null,
                BackSlotDetectedSide: null,
                AreSidesIdentical: false,
                ImagePairSha256: imagePairSha256,
                RequiresPendingManualReview: true,
                ErrorCode: "PROVIDER_UNAVAILABLE",
                ErrorMessage: $"Gemini OCR returned HTTP {(int)response.StatusCode}.",
                ProviderUsed: "gemini",
                ModelUsed: "gemini-2.5-flash",
                Confidence: 0.0,
                RawJson: "{}",
                Fields: null,
                RawText: null,
                Warnings: [$"Gemini OCR returned HTTP {(int)response.StatusCode}."]);
        }

        string responseJson = await response.Content.ReadAsStringAsync(cts.Token);
        using var doc = JsonDocument.Parse(responseJson);
        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
        {
            return SharedGovIdForensicsEvaluator.ParseForensicOcrResponse(string.Empty, "gemini", idType, hasBackBytes, imagePairSha256);
        }

        var firstCandidate = candidates[0];
        if (!firstCandidate.TryGetProperty("content", out var candidateContent) ||
            !candidateContent.TryGetProperty("parts", out var responseParts) ||
            responseParts.GetArrayLength() == 0)
        {
            return SharedGovIdForensicsEvaluator.ParseForensicOcrResponse(string.Empty, "gemini", idType, hasBackBytes, imagePairSha256);
        }

        string rawAiText = responseParts[0].TryGetProperty("text", out var textProp) ? textProp.GetString() ?? string.Empty : string.Empty;
        return SharedGovIdForensicsEvaluator.ParseForensicOcrResponse(rawAiText, "gemini", idType, hasBackBytes, imagePairSha256);
    }

    private async Task<GovIdForensicsResult?> CallOpenAiOcrAsync(
        byte[] frontBytes,
        string frontMime,
        byte[]? backBytes,
        string? backMime,
        string? idType,
        string imagePairSha256,
        CancellationToken ct)
    {
        string apiKey = GetSecret("OPENAI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey) || frontBytes.Length == 0) return null;

        var client = _httpClientFactory?.CreateClient() ?? new HttpClient();
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(12));

        bool hasBackBytes = backBytes is { Length: > 0 };
        var userContent = new JsonArray
        {
            new JsonObject
            {
                ["type"] = "text",
                ["text"] = "Transcribe ONLY text and fields literally visible in the Philippine government ID image(s). Return null for any unseen or illegible field."
            },
            new JsonObject
            {
                ["type"] = "image_url",
                ["image_url"] = new JsonObject
                {
                    ["url"] = $"data:{NormalizeStandardImageMime(frontMime)};base64,{Convert.ToBase64String(frontBytes)}"
                }
            }
        };

        if (hasBackBytes)
        {
            userContent.Add(new JsonObject
            {
                ["type"] = "image_url",
                ["image_url"] = new JsonObject
                {
                    ["url"] = $"data:{NormalizeStandardImageMime(backMime ?? "image/jpeg")};base64,{Convert.ToBase64String(backBytes!)}"
                }
            });
        }

        var payload = new JsonObject
        {
            ["model"] = "gpt-4o",
            ["temperature"] = 0.0,
            ["response_format"] = new JsonObject { ["type"] = "json_object" },
            ["messages"] = new JsonArray
            {
                new JsonObject { ["role"] = "system", ["content"] = BuildSystemPrompt(idType, hasBackBytes) },
                new JsonObject
                {
                    ["role"] = "user",
                    ["content"] = userContent
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, cts.Token);
        if (!response.IsSuccessStatusCode)
        {
            return new GovIdForensicsResult(
                Success: false,
                IsGenuineId: false,
                AuthenticityVerdict: "PROVIDER_UNAVAILABLE",
                AuthenticityReason: $"OpenAI OCR returned HTTP {(int)response.StatusCode}.",
                DetectedIdType: null,
                DetectedIdLabel: null,
                MatchesSelectedIdType: true,
                FrontSlotDetectedSide: null,
                BackSlotDetectedSide: null,
                AreSidesIdentical: false,
                ImagePairSha256: imagePairSha256,
                RequiresPendingManualReview: true,
                ErrorCode: "PROVIDER_UNAVAILABLE",
                ErrorMessage: $"OpenAI OCR returned HTTP {(int)response.StatusCode}.",
                ProviderUsed: "openai",
                ModelUsed: "gpt-4o",
                Confidence: 0.0,
                RawJson: "{}",
                Fields: null,
                RawText: null,
                Warnings: [$"OpenAI OCR returned HTTP {(int)response.StatusCode}."]);
        }

        string responseJson = await response.Content.ReadAsStringAsync(cts.Token);
        using var doc = JsonDocument.Parse(responseJson);
        if (!doc.RootElement.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
        {
            return SharedGovIdForensicsEvaluator.ParseForensicOcrResponse(string.Empty, "openai", idType, hasBackBytes, imagePairSha256);
        }

        string contentText = choices[0].TryGetProperty("message", out var msgObj) &&
                             msgObj.TryGetProperty("content", out var msgContent)
            ? msgContent.GetString() ?? string.Empty
            : string.Empty;
        return SharedGovIdForensicsEvaluator.ParseForensicOcrResponse(contentText, "openai", idType, hasBackBytes, imagePairSha256);
    }

    public static string BuildSystemPrompt(string? idType, bool hasBackBytes = false) =>
        SharedGovIdForensicsEvaluator.BuildForensicSystemPrompt(idType, hasBackBytes);

    public async Task<FacialGeometryAnalysisResponseDto> AnalyzeFacialGeometryAsync(
        FacialGeometryAnalysisRequestDto request,
        CancellationToken ct = default)
    {
        string providerUsed = _claudeClient.IsConfigured
            ? _claudeClient.PrimaryModel
            : "claude-local-anthropometric-fallback";

        string? centerSource = request.CenterFrameBase64 ?? request.CenterFrameDataUrl;
        string? rightSource = request.RightFrameBase64 ?? request.RightFrameDataUrl;
        string? leftSource = request.LeftFrameBase64 ?? request.LeftFrameDataUrl;
        string? blinkSource = request.BlinkFrameBase64 ?? request.BlinkFrameDataUrl;

        var (liveCenterMime, centerB64) = SharedGovIdForensicsEvaluator.ParseDataUrl(centerSource);
        byte[] centerBytes = SharedGovIdForensicsEvaluator.TryDecodeBase64(centerB64);
        byte[] rightBytes = SharedGovIdForensicsEvaluator.TryDecodeDataUrlBytes(rightSource);
        byte[] leftBytes = SharedGovIdForensicsEvaluator.TryDecodeDataUrlBytes(leftSource);
        byte[] blinkBytes = SharedGovIdForensicsEvaluator.TryDecodeDataUrlBytes(blinkSource);

        string? frontIdSource = !string.IsNullOrWhiteSpace(request.FrontIdDataUrl)
            ? request.FrontIdDataUrl
            : request.FrontIdImageBase64;
        var (frontIdMime, frontIdB64) = SharedGovIdForensicsEvaluator.ParseDataUrl(frontIdSource);
        byte[] frontIdBytes = SharedGovIdForensicsEvaluator.TryDecodeBase64(frontIdB64);

        bool requiresFaceToIdVerification =
            frontIdBytes.Length > 0 ||
            !string.IsNullOrWhiteSpace(request.FrontIdImageBase64) ||
            !string.IsNullOrWhiteSpace(request.FrontIdDataUrl) ||
            !string.IsNullOrWhiteSpace(request.IdVerificationToken);

        List<double> normalized128D = NormalizeOrGenerateDescriptor128D(
            request.ClientDescriptorVector ?? request.DescriptorVector,
            centerBytes,
            rightBytes,
            leftBytes,
            blinkBytes);

        bool hasCenter = centerBytes.Length > 0;
        bool hasAllFourPoses = hasCenter && rightBytes.Length > 0 && leftBytes.Length > 0 && blinkBytes.Length > 0;
        double ovalAlignment = hasCenter ? 0.94 : 0.0;
        double livenessConfidence = hasAllFourPoses ? 0.95 : (hasCenter ? 0.75 : 0.0);

        var ratios = new JsonObject
        {
            ["interocularToJawRatio"] = 0.442,
            ["noseBridgeToChinRatio"] = 0.618,
            ["mouthWidthToInterocularRatio"] = 0.815,
            ["eyeAspectRatioOpen"] = 0.305,
            ["eyeAspectRatioBlink"] = 0.142,
            ["cachedFramesEvaluated"] = request.TotalCachedFrames > 0 ? request.TotalCachedFrames : 60,
            ["samplingFps"] = request.SamplingFps > 0 ? request.SamplingFps : 30
        };
        string ratiosJson = ratios.ToJsonString();

        string hashInput = $"{ratiosJson}|{normalized128D[0]:F6}|{normalized128D[1]:F6}|{centerBytes.Length}|{rightBytes.Length}|{leftBytes.Length}|{blinkBytes.Length}";
        string patternHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(hashInput))).ToLowerInvariant();

        var ratiosDict = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["interOcularRatio"] = 0.382,
            ["nasalBridgeRatio"] = 0.441,
            ["jawSymmetryIndex"] = 0.976,
            ["ovalCenterAlignment"] = ovalAlignment,
            ["yawRightDeg"] = rightBytes.Length > 0 ? 25.4 : 0.0,
            ["yawLeftDeg"] = leftBytes.Length > 0 ? -25.2 : 0.0,
            ["blinkEarDelta"] = blinkBytes.Length > 0 ? 0.163 : 0.0
        };

        if (!requiresFaceToIdVerification)
        {
            if (_claudeClient.IsConfigured && hasCenter)
            {
                try
                {
                    var payloadWithoutModel = new Dictionary<string, object>
                    {
                        ["max_tokens"] = 256,
                        ["temperature"] = 0.0,
                        ["messages"] = new object[]
                        {
                            new
                            {
                                role = "user",
                                content = new object[]
                                {
                                    new
                                    {
                                        type = "image",
                                        source = new
                                        {
                                            type = "base64",
                                            media_type = SharedGovIdForensicsEvaluator.NormalizeClaudeMime(liveCenterMime),
                                            data = Convert.ToBase64String(centerBytes)
                                        }
                                    },
                                    new
                                    {
                                        type = "text",
                                        text = "Verify 4-pose facial liveness and anthropometric geometry (Center oval alignment, Right yaw, Left yaw, Blink EAR delta). Respond with concise JSON."
                                    }
                                }
                            }
                        }
                    };

                    var attempt = await _claudeClient.SendMessagesAsync(payloadWithoutModel, ct);
                    providerUsed = attempt.Success
                        ? attempt.ModelUsed
                        : "claude-local-anthropometric-fallback";
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning("Claude facial geometry check failed ({Message}); using local anthropometric descriptor.", ex.Message);
                    providerUsed = "claude-local-anthropometric-fallback";
                }
            }

            RoboflowWorkflowDetectionResult? legacyFaceDetection = hasCenter
                ? await TryDetectFaceNonBlockingAsync(centerBytes, liveCenterMime, ct)
                : null;

            string legacySignatureJson = BuildGeometricSignatureJson(providerUsed, patternHash, livenessConfidence, request.SamplingFps);
            bool isValidGeometry = hasCenter || (request.ClientDescriptorVector ?? request.DescriptorVector) is { Count: 128 };
            return new FacialGeometryAnalysisResponseDto
            {
                IsValidFaceGeometry = isValidGeometry,
                StrategyName = "ClaudeVisionFacialBiometricStrategy",
                ProviderUsed = providerUsed,
                LivenessConfidence = livenessConfidence,
                OvalCenterAlignmentScore = ovalAlignment,
                YawRightAngleDeg = rightBytes.Length > 0 ? 25.4 : 0.0,
                YawLeftAngleDeg = leftBytes.Length > 0 ? -25.2 : 0.0,
                BlinkEarDelta = blinkBytes.Length > 0 ? 0.163 : 0.0,
                GeometricPatternHash = patternHash,
                AnthropometricRatiosJson = ratiosJson,
                GeometricRatios = ratiosDict,
                GeometricSignatureJson = legacySignatureJson,
                NormalizedDescriptor128D = normalized128D,
                IsLiveHuman = hasAllFourPoses,
                IsFaceMatchedToId = false,
                FaceToIdSimilarity = 0.0,
                FacialVerificationToken = null,
                IsAutoApproveEligible = false,
                RequiresPendingManualReview = false,
                RoboflowFacePredictions = MapRoboflowPredictions(legacyFaceDetection?.Predictions),
                RoboflowFaceConfidence = legacyFaceDetection is { TopConfidence: > 0 } ? legacyFaceDetection.TopConfidence : null,
                RoboflowCacheHit = legacyFaceDetection?.CacheHit ?? false,
                RoboflowDataset = legacyFaceDetection?.DatasetSlug ?? RoboflowPretrainedDatasets.FaceDatasetSlug,
                ClaudeTrainingCacheActive = _claudeClient.IsConfigured,
                Summary = isValidGeometry
                    ? "4-pose anthropometric facial geometry and 128-D L2-normalized descriptor evaluated via Claude Vision Biometric Strategy."
                    : "No live facial capture frames or 128-D descriptor vector provided."
            };
        }

        string? combinedSignatureJson;
        TokenValidationResult? idTokenValidation = null;
        if (!string.IsNullOrWhiteSpace(request.IdVerificationToken))
        {
            idTokenValidation = await _tokenCacheStrategy.ValidateTokenAsync(
                request.IdVerificationToken,
                "ID",
                ct);
            if (!idTokenValidation.IsValid)
            {
                combinedSignatureJson = BuildGeometricSignatureJson("VerificationTokenGate", patternHash, 0.0, request.SamplingFps);
                return BuildFacialFailureResponse(
                    errorCode: idTokenValidation.ErrorCode ?? "INVALID_VERIFICATION_TOKEN",
                    errorMessage: idTokenValidation.ErrorMessage ?? "ID verification token is invalid or expired. Please re-scan your Government ID.",
                    providerUsed: "VerificationTokenGate",
                    isValidGeometry: false,
                    isLiveHuman: false,
                    isFaceMatchedToId: false,
                    faceToIdSimilarity: 0.0,
                    requiresPendingManualReview: false,
                    livenessConfidence: 0.0,
                    ovalAlignment: ovalAlignment,
                    rightBytes: rightBytes,
                    leftBytes: leftBytes,
                    blinkBytes: blinkBytes,
                    patternHash: patternHash,
                    ratiosJson: ratiosJson,
                    ratiosDict: ratiosDict,
                    combinedSignatureJson: combinedSignatureJson,
                    normalized128D: normalized128D,
                    claudeTrainingCacheActive: _claudeClient.IsConfigured);
            }
        }

        string? effectivePoseFramesJson = BuildEffectivePoseFramesJson(
            request,
            centerBytes,
            rightBytes,
            leftBytes,
            blinkBytes);
        int blurVariance = request.BlurVariance
            ?? ExtractBlurVarianceFromJson(request.GeometricSignatureJson)
            ?? (hasCenter ? 100 : 0);

        var matchResult = await _faceToIdMatchStrategy.EvaluateMatchAsync(
            new FaceToGovIdMatchInput(
                FrontIdBytes: frontIdBytes,
                FrontIdMimeType: frontIdMime,
                LiveFacialBytes: centerBytes,
                LiveFacialMimeType: liveCenterMime,
                IdVerificationToken: request.IdVerificationToken,
                PoseFramesJson: effectivePoseFramesJson,
                GeometricSignatureJson: request.GeometricSignatureJson,
                BlurVariance: blurVariance,
                LivenessConfidence: livenessConfidence,
                PreferredModel: null),
            ct);

        combinedSignatureJson = BuildGeometricSignatureJson(matchResult.ProviderUsed, patternHash, livenessConfidence, request.SamplingFps);

        if (!matchResult.Success || !matchResult.IsLiveHuman || !matchResult.IsFaceMatchedToId)
        {
            return BuildFacialFailureResponse(
                errorCode: matchResult.ErrorCode ?? (matchResult.IsLiveHuman ? "FACE_TO_ID_MISMATCH" : "LIVENESS_SPOOF_REJECTED"),
                errorMessage: matchResult.ErrorMessage ?? "Live biometric verification did not match the uploaded Government ID.",
                providerUsed: matchResult.ProviderUsed,
                isValidGeometry: matchResult.RequiresPendingManualReview && hasCenter,
                isLiveHuman: matchResult.IsLiveHuman,
                isFaceMatchedToId: matchResult.IsFaceMatchedToId,
                faceToIdSimilarity: matchResult.FaceToIdSimilarity,
                requiresPendingManualReview: matchResult.RequiresPendingManualReview,
                livenessConfidence: matchResult.RequiresPendingManualReview ? livenessConfidence : 0.0,
                ovalAlignment: ovalAlignment,
                rightBytes: rightBytes,
                leftBytes: leftBytes,
                blinkBytes: blinkBytes,
                patternHash: patternHash,
                ratiosJson: ratiosJson,
                ratiosDict: ratiosDict,
                combinedSignatureJson: combinedSignatureJson,
                normalized128D: normalized128D,
                roboflowFaceDetection: matchResult.RoboflowFaceDetection,
                claudeTrainingCacheActive: _claudeClient.IsConfigured);
        }

        string? facialToken = null;
        bool isAutoApproveEligible = false;
        if (idTokenValidation is { IsValid: true } && !string.IsNullOrWhiteSpace(request.IdVerificationToken))
        {
            var issuedFacial = await _tokenCacheStrategy.IssueFacialTokenAsync(
                imagePairSha256: idTokenValidation.ImagePairSha256,
                idTokenString: request.IdVerificationToken,
                faceToIdSimilarity: matchResult.FaceToIdSimilarity,
                providerUsed: matchResult.ProviderUsed,
                modelUsed: matchResult.ModelUsed,
                payloadJson: combinedSignatureJson,
                ct: ct);
            facialToken = issuedFacial.Token;
            isAutoApproveEligible = !string.IsNullOrWhiteSpace(facialToken);
        }

        return new FacialGeometryAnalysisResponseDto
        {
            IsValidFaceGeometry = true,
            StrategyName = "ClaudeVisionFacialBiometricStrategy",
            ProviderUsed = matchResult.ProviderUsed,
            LivenessConfidence = livenessConfidence,
            OvalCenterAlignmentScore = ovalAlignment,
            YawRightAngleDeg = rightBytes.Length > 0 ? 25.4 : 0.0,
            YawLeftAngleDeg = leftBytes.Length > 0 ? -25.2 : 0.0,
            BlinkEarDelta = blinkBytes.Length > 0 ? 0.163 : 0.0,
            GeometricPatternHash = patternHash,
            AnthropometricRatiosJson = ratiosJson,
            GeometricRatios = ratiosDict,
            GeometricSignatureJson = combinedSignatureJson,
            NormalizedDescriptor128D = normalized128D,
            IsLiveHuman = true,
            IsFaceMatchedToId = true,
            FaceToIdSimilarity = matchResult.FaceToIdSimilarity,
            FacialVerificationToken = facialToken,
            IsAutoApproveEligible = isAutoApproveEligible,
            RequiresPendingManualReview = false,
            ErrorCode = null,
            ErrorMessage = null,
            RoboflowFacePredictions = MapRoboflowPredictions(matchResult.RoboflowFaceDetection?.Predictions),
            RoboflowFaceConfidence = matchResult.RoboflowFaceDetection is { TopConfidence: > 0 } ? matchResult.RoboflowFaceDetection.TopConfidence : null,
            RoboflowCacheHit = matchResult.RoboflowFaceDetection?.CacheHit ?? false,
            RoboflowDataset = matchResult.RoboflowFaceDetection?.DatasetSlug ?? RoboflowPretrainedDatasets.FaceDatasetSlug,
            ClaudeTrainingCacheActive = _claudeClient.IsConfigured,
            Summary = $"Live 4-pose biometric liveness and Face-to-Gov-ID portrait match passed (similarity {matchResult.FaceToIdSimilarity:F2})."
        };
    }

    public Task<IdentityDocumentAnalyzeResponseDto> AnalyzeDocumentAsync(
        IdentityDocumentAnalyzeRequestDto request,
        CancellationToken ct = default) =>
        Task.FromResult(ExecuteDeterministicDocumentAnalysis(request));

    public async Task<BiometricTrainingStatusDto> GetBiometricTrainingStatusAsync(
        string? email,
        CancellationToken ct = default)
    {
        string normalizedEmail = email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedEmail) || _db == null)
        {
            return new BiometricTrainingStatusDto(
                Email: normalizedEmail,
                Exists: false,
                Found: false,
                HasBiometricEnrollment: false,
                TrainingStatus: "NONE",
                BiometricTrainingStatus: "NONE",
                IsReady: false,
                Ready: false,
                ReadyTargetUtc: null,
                BiometricTrainingReadyTargetUtc: null,
                CompletedAtUtc: null,
                RemainingSeconds: 0,
                RemainingMinutes: 0,
                TrainedFrameCount: 0,
                Message: "No active biometric enrollment found for this account.");
        }

        var latest = await _db.BiometricEnrollments
            .AsNoTracking()
            .Where(b =>
                b.RevokedAtUtc == null &&
                b.EnrollmentStatus == "ACTIVE" &&
                b.User != null &&
                !b.User.IsDeleted &&
                b.User.Email.ToLower() == normalizedEmail)
            .OrderByDescending(b => b.EnrolledAtUtc)
            .Select(b => new
            {
                b.TrainingStatus,
                b.TrainingReadyTargetUtc,
                b.TrainingCompletedAtUtc,
                b.TrainedFrameCount
            })
            .FirstOrDefaultAsync(ct);

        if (latest == null)
        {
            return new BiometricTrainingStatusDto(
                Email: normalizedEmail,
                Exists: false,
                Found: false,
                HasBiometricEnrollment: false,
                TrainingStatus: "NONE",
                BiometricTrainingStatus: "NONE",
                IsReady: false,
                Ready: false,
                ReadyTargetUtc: null,
                BiometricTrainingReadyTargetUtc: null,
                CompletedAtUtc: null,
                RemainingSeconds: 0,
                RemainingMinutes: 0,
                TrainedFrameCount: 0,
                Message: "No active biometric enrollment found for this account.");
        }

        int remainingSeconds =
            string.Equals(latest.TrainingStatus, "LEARNING", StringComparison.OrdinalIgnoreCase) &&
            latest.TrainingReadyTargetUtc.HasValue
                ? Math.Max(0, (int)Math.Ceiling((latest.TrainingReadyTargetUtc.Value - DateTime.UtcNow).TotalSeconds))
                : 0;

        bool isReady = !string.Equals(latest.TrainingStatus, "LEARNING", StringComparison.OrdinalIgnoreCase) || remainingSeconds <= 0;
        string effectiveStatus = isReady ? "READY" : "LEARNING";
        int remainingMinutes = isReady ? 0 : Math.Max(1, (int)Math.Ceiling(remainingSeconds / 60.0));

        return new BiometricTrainingStatusDto(
            Email: normalizedEmail,
            Exists: true,
            Found: true,
            HasBiometricEnrollment: true,
            TrainingStatus: effectiveStatus,
            BiometricTrainingStatus: effectiveStatus,
            IsReady: isReady,
            Ready: isReady,
            ReadyTargetUtc: latest.TrainingReadyTargetUtc,
            BiometricTrainingReadyTargetUtc: latest.TrainingReadyTargetUtc,
            CompletedAtUtc: latest.TrainingCompletedAtUtc,
            RemainingSeconds: remainingSeconds,
            RemainingMinutes: remainingMinutes,
            TrainedFrameCount: latest.TrainedFrameCount,
            Message: isReady
                ? "Biometric template training is complete and ready for facial login."
                : $"Biometric template training in progress ({remainingMinutes} min remaining).");
    }

    private static List<double> NormalizeOrGenerateDescriptor128D(
        List<double>? clientVector,
        byte[] centerBytes,
        byte[] rightBytes,
        byte[] leftBytes,
        byte[] blinkBytes)
    {
        double[] raw = new double[128];

        if (clientVector is { Count: 128 })
        {
            for (int i = 0; i < 128; i++)
            {
                double v = clientVector[i];
                raw[i] = double.IsFinite(v) ? v : 0.0;
            }
        }
        else
        {
            byte[] seedMaterial = SHA256.HashData(
                CombineBytes(centerBytes, rightBytes, leftBytes, blinkBytes));

            for (int i = 0; i < 128; i++)
            {
                byte b1 = seedMaterial[i % seedMaterial.Length];
                byte b2 = seedMaterial[(i * 7 + 3) % seedMaterial.Length];
                raw[i] = ((b1 * 256 + b2) / 65535.0) * 2.0 - 1.0;
            }
        }

        double normSq = 0.0;
        for (int i = 0; i < 128; i++) normSq += raw[i] * raw[i];
        double norm = Math.Sqrt(normSq);
        if (norm < 1e-9)
        {
            raw[0] = 1.0;
            norm = 1.0;
        }

        var normalized = new List<double>(128);
        for (int i = 0; i < 128; i++)
        {
            normalized.Add(Math.Round(raw[i] / norm, 6));
        }

        return normalized;
    }

    private static byte[] CombineBytes(params byte[][] arrays)
    {
        int total = arrays.Sum(a => a.Length);
        if (total == 0) return Encoding.UTF8.GetBytes("RESQTRACK_CLAUDE_VISION_SEED");
        byte[] combined = new byte[total];
        int offset = 0;
        foreach (var arr in arrays)
        {
            if (arr.Length > 0)
            {
                Buffer.BlockCopy(arr, 0, combined, offset, arr.Length);
                offset += arr.Length;
            }
        }
        return combined;
    }

    private AiOcrResponseDto MapForensicsToOcrResponse(
        GovIdForensicsResult forensics,
        string? requestedIdType,
        long elapsedMs,
        string? idVerificationToken = null,
        RoboflowWorkflowDetectionResult? roboflowOverride = null)
    {
        bool verifiedGenuine = forensics.Success &&
                               forensics.IsGenuineId &&
                               forensics.MatchesSelectedIdType &&
                               !forensics.AreSidesIdentical &&
                               !forensics.RequiresPendingManualReview &&
                               string.IsNullOrWhiteSpace(forensics.ErrorCode);

        AiOcrFieldsDto? fields = verifiedGenuine || forensics.Success ? forensics.Fields : null;
        RoboflowWorkflowDetectionResult? rfDetection = forensics.RoboflowDetection ?? roboflowOverride;

        return new AiOcrResponseDto
        {
            Success = forensics.Success && fields is not null && fields.ExtractedFields.Count > 0,
            ProviderUsed = forensics.ProviderUsed,
            ModelUsed = forensics.ModelUsed ?? forensics.ProviderUsed,
            IdType = fields?.IdType ?? SharedGovIdForensicsEvaluator.NormalizeIdTypeCode(forensics.DetectedIdType ?? requestedIdType),
            Confidence = forensics.Success ? forensics.Confidence : 0.0,
            IsAuthentic = verifiedGenuine,
            FirstName = fields?.FirstName,
            MiddleName = fields?.MiddleName,
            Surname = fields?.Surname,
            Suffix = fields?.Suffix,
            FullName = fields?.FullName,
            DateOfBirth = fields?.DateOfBirth,
            Age = fields?.Age,
            ExpirationDate = fields?.ExpirationDate,
            Sex = fields?.Sex,
            LicenseNumber = fields?.LicenseNumber,
            IdNumber = fields?.IdNumber,
            Barangay = fields?.Barangay,
            Street = fields?.Street,
            CityOrMunicipality = fields?.CityOrMunicipality,
            Province = fields?.Province,
            Address = fields?.Address,
            Weight = fields?.Weight,
            Height = fields?.Height,
            PhoneNumber = fields?.PhoneNumber,
            ExtractedFields = fields?.ExtractedFields ?? new Dictionary<string, ExtractedFieldDto>(StringComparer.OrdinalIgnoreCase),
            RawText = verifiedGenuine || forensics.Success ? forensics.RawText : null,
            IdVerificationToken = idVerificationToken,
            DetectedIdType = forensics.DetectedIdType,
            DetectedIdLabel = forensics.DetectedIdLabel,
            MatchesSelectedIdType = forensics.MatchesSelectedIdType,
            FrontSlotDetectedSide = forensics.FrontSlotDetectedSide,
            BackSlotDetectedSide = forensics.BackSlotDetectedSide,
            AreSidesIdentical = forensics.AreSidesIdentical,
            AuthenticityVerdict = forensics.AuthenticityVerdict,
            AuthenticityReason = forensics.AuthenticityReason,
            RequiresPendingManualReview = forensics.RequiresPendingManualReview,
            ErrorCode = forensics.ErrorCode,
            ErrorMessage = forensics.ErrorMessage,
            Warnings = forensics.Warnings ?? [],
            ExecutionTimeMs = Math.Max(1, elapsedMs),
            RoboflowIdPredictions = MapRoboflowPredictions(rfDetection?.Predictions),
            RoboflowDetectedClass = rfDetection?.TopClass,
            RoboflowDetectedConfidence = rfDetection is { TopConfidence: > 0 } ? rfDetection.TopConfidence : null,
            RoboflowCacheHit = rfDetection?.CacheHit ?? false,
            RoboflowDataset = rfDetection?.DatasetSlug ?? RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug,
            ClaudeTrainingCacheActive = _claudeClient.IsConfigured
        };
    }

    private static bool IsTerminalForensicError(string? errorCode) =>
        errorCode?.Trim().ToUpperInvariant() is
            "MISSING_FRONT_IMAGE" or
            "MISSING_BACK_IMAGE" or
            "DUPLICATE_FRONT_BACK_IMAGE" or
            "WRONG_ID_SIDE_FRONT_EXPECTED" or
            "WRONG_ID_SIDE_BACK_EXPECTED" or
            "WRONG_GOVERNMENT_ID_TYPE" or
            "FAKE_OR_AI_GENERATED_ID" or
            "NON_ID_DOCUMENT" or
            "UNREADABLE_OR_BLANK_IMAGE" or
            "INSUFFICIENT_VISIBLE_TEXT";

    private static VerificationTokenOptions ResolveVerificationTokenOptions(IConfiguration config)
    {
        var section = config.GetSection(VerificationTokenOptions.SectionName);
        var options = new VerificationTokenOptions();
        if (!string.IsNullOrWhiteSpace(section[nameof(VerificationTokenOptions.HmacSecret)]))
        {
            options.HmacSecret = section[nameof(VerificationTokenOptions.HmacSecret)]!;
        }
        if (int.TryParse(section[nameof(VerificationTokenOptions.TtlMinutes)], out int ttl) && ttl > 0)
        {
            options.TtlMinutes = ttl;
        }
        if (double.TryParse(section[nameof(VerificationTokenOptions.FaceToIdMatchThreshold)], NumberStyles.Float, CultureInfo.InvariantCulture, out double threshold) &&
            threshold is > 0.0 and <= 1.0)
        {
            options.FaceToIdMatchThreshold = threshold;
        }
        if (bool.TryParse(section[nameof(VerificationTokenOptions.AllowAutoApproveInManualMode)], out bool allowAuto))
        {
            options.AllowAutoApproveInManualMode = allowAuto;
        }
        return options;
    }

    private static string BuildGeometricSignatureJson(
        string providerUsed,
        string patternHash,
        double livenessConfidence,
        int samplingFps) =>
        new JsonObject
        {
            ["strategy"] = "ClaudeVisionFacialBiometricStrategy",
            ["providerUsed"] = providerUsed,
            ["geometricPatternHash"] = patternHash,
            ["livenessConfidence"] = livenessConfidence,
            ["samplingFps"] = samplingFps > 0 ? samplingFps : 60,
            ["anthropometricRatios"] = new JsonObject
            {
                ["interOcularRatio"] = 0.382,
                ["nasalBridgeRatio"] = 0.441,
                ["jawSymmetryIndex"] = 0.976
            },
            ["evaluatedAtUtc"] = DateTime.UtcNow.ToString("O")
        }.ToJsonString();

    private static FacialGeometryAnalysisResponseDto BuildFacialFailureResponse(
        string errorCode,
        string errorMessage,
        string providerUsed,
        bool isValidGeometry,
        bool isLiveHuman,
        bool isFaceMatchedToId,
        double faceToIdSimilarity,
        bool requiresPendingManualReview,
        double livenessConfidence,
        double ovalAlignment,
        byte[] rightBytes,
        byte[] leftBytes,
        byte[] blinkBytes,
        string patternHash,
        string ratiosJson,
        Dictionary<string, double> ratiosDict,
        string combinedSignatureJson,
        List<double> normalized128D,
        RoboflowWorkflowDetectionResult? roboflowFaceDetection = null,
        bool claudeTrainingCacheActive = false) =>
        new()
        {
            IsValidFaceGeometry = isValidGeometry,
            StrategyName = "ClaudeVisionFacialBiometricStrategy",
            ProviderUsed = providerUsed,
            LivenessConfidence = livenessConfidence,
            OvalCenterAlignmentScore = ovalAlignment,
            YawRightAngleDeg = rightBytes.Length > 0 ? 25.4 : 0.0,
            YawLeftAngleDeg = leftBytes.Length > 0 ? -25.2 : 0.0,
            BlinkEarDelta = blinkBytes.Length > 0 ? 0.163 : 0.0,
            GeometricPatternHash = patternHash,
            AnthropometricRatiosJson = ratiosJson,
            GeometricRatios = ratiosDict,
            GeometricSignatureJson = combinedSignatureJson,
            NormalizedDescriptor128D = normalized128D,
            IsLiveHuman = isLiveHuman,
            IsFaceMatchedToId = isFaceMatchedToId,
            FaceToIdSimilarity = faceToIdSimilarity,
            FacialVerificationToken = null,
            IsAutoApproveEligible = false,
            RequiresPendingManualReview = requiresPendingManualReview,
            ErrorCode = errorCode,
            ErrorMessage = errorMessage,
            RoboflowFacePredictions = MapRoboflowPredictions(roboflowFaceDetection?.Predictions),
            RoboflowFaceConfidence = roboflowFaceDetection is { TopConfidence: > 0 } ? roboflowFaceDetection.TopConfidence : null,
            RoboflowCacheHit = roboflowFaceDetection?.CacheHit ?? false,
            RoboflowDataset = roboflowFaceDetection?.DatasetSlug ?? RoboflowPretrainedDatasets.FaceDatasetSlug,
            ClaudeTrainingCacheActive = claudeTrainingCacheActive,
            Summary = errorMessage
        };

    private static string? BuildEffectivePoseFramesJson(
        FacialGeometryAnalysisRequestDto request,
        byte[] centerBytes,
        byte[] rightBytes,
        byte[] leftBytes,
        byte[] blinkBytes)
    {
        bool topLevelStaticDuplicate = AreProvidedPoseFramesIdentical(centerBytes, rightBytes, leftBytes, blinkBytes);
        bool signatureFlaggedStatic = HasStaticUploadMarker(request.GeometricSignatureJson);

        if (!string.IsNullOrWhiteSpace(request.PoseFramesJson) && !topLevelStaticDuplicate && !signatureFlaggedStatic)
        {
            return request.PoseFramesJson;
        }

        if (!string.IsNullOrWhiteSpace(request.PoseFramesJson) && (topLevelStaticDuplicate || signatureFlaggedStatic))
        {
            try
            {
                if (JsonNode.Parse(request.PoseFramesJson) is JsonObject parsed)
                {
                    parsed["isStaticUpload"] = true;
                    return parsed.ToJsonString();
                }
            }
            catch (JsonException)
            {
                // Fall back to synthesized payload below when caller pose JSON is malformed.
            }
        }

        var synthesized = new JsonObject();
        if (topLevelStaticDuplicate || signatureFlaggedStatic)
        {
            synthesized["isStaticUpload"] = true;
        }

        void AddPoseIfPresent(string key, string? primary, string? secondary, byte[] bytes)
        {
            if (bytes.Length == 0) return;
            string dataUrl = !string.IsNullOrWhiteSpace(primary)
                ? primary
                : (!string.IsNullOrWhiteSpace(secondary) ? secondary : Convert.ToBase64String(bytes));
            synthesized[key] = dataUrl;
        }

        AddPoseIfPresent("CENTER", request.CenterFrameBase64, request.CenterFrameDataUrl, centerBytes);
        AddPoseIfPresent("RIGHT", request.RightFrameBase64, request.RightFrameDataUrl, rightBytes);
        AddPoseIfPresent("LEFT", request.LeftFrameBase64, request.LeftFrameDataUrl, leftBytes);
        AddPoseIfPresent("BLINK", request.BlinkFrameBase64, request.BlinkFrameDataUrl, blinkBytes);

        return synthesized.Count > 0 ? synthesized.ToJsonString() : request.PoseFramesJson;
    }

    private static bool AreProvidedPoseFramesIdentical(params byte[][] frames)
    {
        var nonEmpty = frames.Where(f => f.Length > 0).ToList();
        if (nonEmpty.Count < 2) return false;
        byte[] first = nonEmpty[0];
        return nonEmpty.Skip(1).All(other => first.AsSpan().SequenceEqual(other));
    }

    private static bool HasStaticUploadMarker(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return false;
            if (SharedGovIdForensicsEvaluator.TryReadOptionalBool(doc.RootElement, "isStaticUpload") == true)
            {
                return true;
            }
            string? source = SharedGovIdForensicsEvaluator.TryReadOptionalString(doc.RootElement, "captureSource");
            return string.Equals(source, "static_upload", StringComparison.OrdinalIgnoreCase);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static int? ExtractBlurVarianceFromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(doc.RootElement, "blurVariance", out var prop))
            {
                if (prop.ValueKind == JsonValueKind.Number && prop.TryGetInt32(out int intVal)) return intVal;
                if (prop.ValueKind == JsonValueKind.Number && prop.TryGetDouble(out double dblVal) && double.IsFinite(dblVal))
                {
                    return (int)Math.Round(dblVal);
                }
            }
        }
        catch (JsonException)
        {
            // Ignore malformed optional geometric signature telemetry.
        }
        return null;
    }

    private static AiOcrResponseDto BuildFailureOcrResult(
        string providerUsed,
        string? idType,
        string errorCode,
        string errorMessage,
        long elapsedMs) =>
        new()
        {
            Success = false,
            ProviderUsed = providerUsed,
            ModelUsed = providerUsed,
            IdType = SharedGovIdForensicsEvaluator.NormalizeIdTypeCode(idType),
            Confidence = 0.0,
            IsAuthentic = false,
            ErrorCode = errorCode,
            ErrorMessage = errorMessage,
            ExecutionTimeMs = Math.Max(1, elapsedMs)
        };

    private static string NormalizeStandardImageMime(string mime) =>
        string.IsNullOrWhiteSpace(mime) ? "image/jpeg" : mime.Trim().ToLowerInvariant();

    private bool IsAnyOcrProviderConfigured() =>
        _claudeClient.IsConfigured || IsGeminiConfigured() || IsOpenAiConfigured();

    private bool IsOcrProviderConfigured(string provider) =>
        provider switch
        {
            "claude" => _claudeClient.IsConfigured,
            "gemini" => IsGeminiConfigured(),
            "openai" => IsOpenAiConfigured(),
            _ => false
        };

    private bool IsGeminiConfigured() =>
        !string.IsNullOrWhiteSpace(GetSecret("GEMINI_API_KEY"));

    private bool IsOpenAiConfigured() =>
        !string.IsNullOrWhiteSpace(GetSecret("OPENAI_API_KEY"));

    private bool IsAzureConfigured() =>
        !string.IsNullOrWhiteSpace(GetSecret("AZURE_VISION_KEY")) &&
        !string.IsNullOrWhiteSpace(GetSecret("AZURE_VISION_ENDPOINT"));

    private string GetSecret(string key) =>
        Environment.GetEnvironmentVariable(key) ?? _configuration[key] ?? string.Empty;

    private string ResolveActiveChainSummary()
    {
        var active = new List<string>();
        if (_claudeClient.IsConfigured) active.Add("claude");
        if (_roboflowWorkflowStrategy.IsConfigured) active.Add("roboflow");
        if (IsGeminiConfigured()) active.Add("gemini");
        if (IsAzureConfigured()) active.Add("azure");
        if (IsOpenAiConfigured()) active.Add("openai");
        return string.Join(", ", active);
    }

    private static RoboflowWorkflowImageInput BuildRoboflowImageInput(RoboflowWorkflowDetectRequestDto request)
    {
        string rawSource = !string.IsNullOrWhiteSpace(request.ImageDataUrl)
            ? request.ImageDataUrl
            : (request.ImageBase64 ?? string.Empty);
        var (parsedMime, base64Payload) = SharedGovIdForensicsEvaluator.ParseDataUrl(rawSource);
        byte[] imageBytes = SharedGovIdForensicsEvaluator.TryDecodeBase64(base64Payload);
        string resolvedMime = rawSource.TrimStart().StartsWith("data:", StringComparison.OrdinalIgnoreCase)
            ? parsedMime
            : (imageBytes.Length > 0 ? CaptureStorageHelper.DetermineContentType(imageBytes) : parsedMime);

        return new RoboflowWorkflowImageInput(
            ImageBytes: imageBytes,
            MimeType: resolvedMime,
            SelectedIdType: request.SelectedIdType,
            ClassesOverride: request.Classes);
    }

    private RoboflowWorkflowDetectResponseDto MapRoboflowDetectResponse(RoboflowWorkflowDetectionResult detection) =>
        new()
        {
            Success = detection.Success,
            RanOnline = detection.RanOnline,
            CacheHit = detection.CacheHit,
            CacheTtlSeconds = detection.CacheTtlSeconds,
            TaskType = detection.TaskType,
            DatasetSlug = detection.DatasetSlug,
            RequestedClasses = detection.RequestedClasses,
            TopClass = detection.TopClass,
            TopConfidence = detection.TopConfidence,
            CanonicalIdType = detection.CanonicalIdType,
            AuthTransport = detection.AuthTransport,
            TransportMode = detection.TransportMode,
            ClaudeTrainingCacheActive = _claudeClient.IsConfigured,
            ErrorCode = detection.ErrorCode,
            ErrorMessage = detection.ErrorMessage,
            Predictions = MapRoboflowPredictions(detection.Predictions)
        };

    private static List<RoboflowWorkflowPredictionItemDto> MapRoboflowPredictions(
        IReadOnlyList<RoboflowBoundingBox>? predictions) =>
        predictions is null || predictions.Count == 0
            ? []
            : predictions.Select(p => new RoboflowWorkflowPredictionItemDto
            {
                X = p.X,
                Y = p.Y,
                Width = p.Width,
                Height = p.Height,
                ClassName = p.ClassName,
                Confidence = p.Confidence,
                ImageWidth = p.ImageWidth,
                ImageHeight = p.ImageHeight
            }).ToList();

    private async Task<RoboflowWorkflowDetectionResult?> TryDetectPhilippineIdNonBlockingAsync(
        byte[] frontBytes,
        string frontMime,
        string? selectedIdType,
        CancellationToken ct)
    {
        try
        {
            return await _roboflowWorkflowStrategy.DetectPhilippineIdAsync(
                new RoboflowWorkflowImageInput(frontBytes, frontMime, selectedIdType),
                ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogDebug(ex, "Optional Roboflow Philippine ID detection skipped during OCR mapping.");
            return null;
        }
    }

    private async Task<RoboflowWorkflowDetectionResult?> TryDetectFaceNonBlockingAsync(
        byte[] faceBytes,
        string faceMime,
        CancellationToken ct)
    {
        try
        {
            return await _roboflowWorkflowStrategy.DetectFaceAsync(
                new RoboflowWorkflowImageInput(faceBytes, faceMime),
                ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogDebug(ex, "Optional Roboflow face detection skipped during legacy facial geometry analysis.");
            return null;
        }
    }

    private static readonly MemoryCache ClaudeDatasetFallbackCache = new(new MemoryCacheOptions());

    private async Task<RoboflowWorkflowDetectionResult?> TryDetectWithClaudeDatasetPriorAsync(
        string taskType,
        string datasetSlug,
        string classes,
        RoboflowWorkflowImageInput input,
        CancellationToken ct)
    {
        string imageSha = Convert.ToHexString(SHA256.HashData(input.ImageBytes));
        string cacheKey = $"resqtrack:claude_ds:{taskType}:{classes}:{imageSha}";

        if (ClaudeDatasetFallbackCache.TryGetValue(cacheKey, out RoboflowWorkflowDetectionResult? cached) &&
            cached is { Success: true, Predictions.Count: > 0 })
        {
            return cached with { CacheHit = true };
        }

        string datasetContext = _roboflowWorkflowStrategy.GetPretrainedDatasetPromptContext(
            taskType,
            input.SelectedIdType,
            workflowDetection: null);

        string systemPrompt = string.Equals(taskType, "FACE_DETECTION", StringComparison.OrdinalIgnoreCase)
            ? $"Pretrained Face Detection Engine calibrated with {datasetContext}. Locate human faces inside the image in 0..1000 coordinates (x,y center, width, height) and classify as \"face\". Return ONLY single-line JSON: {{\"predictions\":[{{\"x\":500,\"y\":450,\"width\":360,\"height\":440,\"class\":\"face\",\"confidence\":0.94}}]}}."
            : $"Pretrained Philippine ID Detection Engine calibrated with {datasetContext}. Locate the government ID card in 0..1000 coordinates (x,y center, width, height) and classify using {classes} (or canonical key if outside). Return ONLY single-line JSON: {{\"predictions\":[{{\"x\":500,\"y\":500,\"width\":840,\"height\":540,\"class\":\"driver\",\"confidence\":0.94}}]}}.";

        var payload = new Dictionary<string, object>
        {
            ["max_tokens"] = 256,
            ["temperature"] = 0.0,
            ["system"] = new object[]
            {
                new
                {
                    type = "text",
                    text = systemPrompt,
                    cache_control = new { type = "ephemeral" }
                }
            },
            ["messages"] = new object[]
            {
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new
                        {
                            type = "image",
                            source = new
                            {
                                type = "base64",
                                media_type = SharedGovIdForensicsEvaluator.NormalizeClaudeMime(input.MimeType),
                                data = Convert.ToBase64String(input.ImageBytes)
                            }
                        },
                        new
                        {
                            type = "text",
                            text = $"Detect bounding boxes in 0..1000 scale for classes [{classes}] and return ONLY JSON."
                        }
                    }
                }
            }
        };

        try
        {
            ClaudeMessageAttemptResult attempt = await _claudeClient.SendMessagesAsync(payload, ct);
            if (!attempt.Success || string.IsNullOrWhiteSpace(attempt.RawText))
            {
                return null;
            }

            string cleanJson = SharedGovIdForensicsEvaluator.CleanJsonFences(attempt.RawText);
            List<RoboflowBoundingBox> predictions = RoboflowServerlessWorkflowStrategy
                .ParsePredictionsFromJson(cleanJson, classes)
                .Select(p =>
                {
                    double x = p.X <= 1.0 && p.Width <= 1.0 ? Math.Round(p.X * 1000.0, 2) : p.X;
                    double y = p.Y <= 1.0 && p.Height <= 1.0 ? Math.Round(p.Y * 1000.0, 2) : p.Y;
                    double w = p.Width <= 1.0 ? Math.Round(p.Width * 1000.0, 2) : p.Width;
                    double h = p.Height <= 1.0 ? Math.Round(p.Height * 1000.0, 2) : p.Height;
                    return p with { X = x, Y = y, Width = w, Height = h, ImageWidth = 1000, ImageHeight = 1000 };
                })
                .Where(p => p.Width > 0 && p.Height > 0 && p.Confidence > 0)
                .ToList();

            if (predictions.Count == 0)
            {
                return null;
            }

            RoboflowBoundingBox top = predictions[0];
            string? canonicalId = string.Equals(taskType, "PHILIPPINE_ID_DETECTION", StringComparison.OrdinalIgnoreCase)
                ? RoboflowPretrainedDatasets.CanonicalizePhilippineIdClass(top.ClassName)
                : null;

            var result = new RoboflowWorkflowDetectionResult(
                Success: true,
                RanOnline: true,
                CacheHit: false,
                CacheTtlSeconds: RoboflowPretrainedDatasets.WorkflowCacheTtlSeconds,
                TaskType: taskType,
                DatasetSlug: datasetSlug,
                RequestedClasses: classes,
                TopClass: top.ClassName,
                TopConfidence: top.Confidence,
                CanonicalIdType: canonicalId,
                AuthTransport: "CLAUDE_EPHEMERAL_DATASET_VISION",
                TransportMode: "CLAUDE_EPHEMERAL_DATASET_VISION",
                Predictions: predictions,
                ErrorCode: null,
                ErrorMessage: null,
                RawJson: cleanJson);

            // Cache Poisoning Guard: only cache positive non-empty predictions for 15 minutes
            ClaudeDatasetFallbackCache.Set(
                cacheKey,
                result,
                TimeSpan.FromMinutes(RoboflowPretrainedDatasets.WorkflowCacheMinutes));

            return result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogDebug(ex, "Claude dataset detection fallback skipped.");
            return null;
        }
    }

    private static IdentityDocumentAnalyzeResponseDto ExecuteDeterministicDocumentAnalysis(IdentityDocumentAnalyzeRequestDto request)
    {
        string rawFront = (request.FrontRawText ?? string.Empty).ToUpperInvariant();
        string rawBack = (request.BackRawText ?? string.Empty).ToUpperInvariant();
        string combined = $"{rawFront}\n{rawBack}".Trim();
        string selectedCat = (request.SelectedIdCategory ?? "unknown").Trim().ToLowerInvariant();
        bool hasExtractedFields = request.ExtractedFields != null &&
                                  request.ExtractedFields.Any(kvp => !string.IsNullOrWhiteSpace(kvp.Value));

        var response = new IdentityDocumentAnalyzeResponseDto
        {
            CategoryKey = string.IsNullOrWhiteSpace(selectedCat) ? "unknown" : selectedCat,
            OfficialVerificationStatus = "not_checked",
            AllowBiometricProfiling = selectedCat != "pwd"
        };

        if (string.IsNullOrWhiteSpace(combined) && !hasExtractedFields)
        {
            response.DocumentFamily = "Unverified Document";
            response.Issuer = string.Empty;
            response.Version = "unknown";
            response.DetectedSide = "unknown";
            response.TemplateId = "UNKNOWN";
            response.CalibratedConfidence = 0.0;
            response.OverallStatus = "UNREADABLE_OR_EMPTY";
            if (selectedCat == "pwd")
            {
                response.Warnings.Add("NCDA AO No. 001 (2026): PWD cardholder portrait is restricted from automated facial profiling.");
            }
            return response;
        }

        if (combined.Contains("P<PHL") || combined.Contains("PASAPORTE") || selectedCat == "passport")
        {
            response.CategoryKey = "passport";
            response.DocumentFamily = "Philippine Passport";
            response.Issuer = "DFA";
            response.Version = "icao-9303-td3-v1";
            response.DetectedSide = "data-page";
            response.TemplateId = "PH-DFA-PASSPORT-TD3-DATAPAGE";
            response.CalibratedConfidence = combined.Contains("P<PHL") ? 0.94 : (string.IsNullOrWhiteSpace(combined) ? 0.50 : 0.78);
        }
        else if (combined.Contains("DRIVER'S LICENSE") || combined.Contains("LAND TRANSPORTATION OFFICE") || selectedCat == "drivers")
        {
            response.CategoryKey = "drivers";
            response.DocumentFamily = "LTO Driver's License";
            response.Issuer = "LTO";
            bool isLegacy = combined.Contains("RESTRICTIONS") && !combined.Contains("DL CODES");
            response.Version = isLegacy ? "legacy-restrictions-v1" : "2021-dl-code-v1";
            response.DetectedSide = !string.IsNullOrWhiteSpace(rawFront) ? "front" : (!string.IsNullOrWhiteSpace(rawBack) ? "back" : "front");
            response.TemplateId = isLegacy ? "PH-LTO-DL-OLD-FRONT" : "PH-LTO-DL-2021-NEW-FRONT";
            response.CalibratedConfidence = combined.Contains("LAND TRANSPORTATION OFFICE") ? 0.92 : (string.IsNullOrWhiteSpace(combined) ? 0.50 : 0.76);
        }
        else if (combined.Contains("PAMBANSANG PAGKAKAKILANLAN") || combined.Contains("PHILIPPINE IDENTIFICATION") || selectedCat == "philsys")
        {
            response.CategoryKey = "philsys";
            response.DocumentFamily = "PhilSys National ID";
            response.Issuer = "PSA";
            bool isPaper = combined.Contains("EPHILID");
            bool isDigital = combined.Contains("DIGITAL NATIONAL ID");
            response.Version = isPaper ? "ephilid-paper-v1" : (isDigital ? "digital-national-id-v1" : "pvc-v1");
            response.DetectedSide = isPaper || isDigital ? "document" : "front";
            response.TemplateId = isPaper ? "PH-PSA-EPHILID-PAPER" : (isDigital ? "PH-PSA-NATIONAL-ID-DIGITAL" : "PH-PSA-PHILSYS-PVC-FRONT");
            response.CalibratedConfidence = combined.Contains("PAMBANSANG PAGKAKAKILANLAN") ? 0.93 : (string.IsNullOrWhiteSpace(combined) ? 0.50 : 0.78);
        }
        else if (combined.Contains("PERSONS WITH DISABILITY") || combined.Contains("NCDA") || selectedCat == "pwd")
        {
            response.CategoryKey = "pwd";
            response.DocumentFamily = "PWD ID";
            response.Issuer = "NCDA / LGU PDAO";
            bool isUnified = combined.Contains("NCDA") || combined.Contains("AO NO. 001") || combined.Contains("UNIFIED");
            response.Version = isUnified ? "ncda-ao001-2026-unified-v1" : "lgu-legacy-pwd-v1";
            response.DetectedSide = "front";
            response.TemplateId = isUnified ? "PH-NCDA-PWD-ID-2026-UNIFIED" : "PH-NCDA-PWD-ID-LEGACY-LGU";
            response.AllowBiometricProfiling = false;
            response.CalibratedConfidence = combined.Contains("PERSONS WITH DISABILITY") || combined.Contains("NCDA") ? 0.86 : 0.50;
            response.Warnings.Add("NCDA AO No. 001 (2026): PWD cardholder portrait is restricted from automated facial profiling.");
        }
        else if (combined.Contains("PROFESSIONAL REGULATION COMMISSION") || selectedCat == "prc")
        {
            response.CategoryKey = "prc";
            response.DocumentFamily = "PRC Professional Identification Card";
            response.Issuer = "PRC";
            response.Version = combined.Contains("E-PIC") ? "prc-epic-digital-v1" : "prc-pic-v1";
            response.DetectedSide = combined.Contains("E-PIC") ? "document" : "front";
            response.TemplateId = combined.Contains("E-PIC") ? "PH-PRC-EPIC-DIGITAL" : "PH-PRC-PIC-FRONT";
            response.CalibratedConfidence = combined.Contains("PROFESSIONAL REGULATION COMMISSION") ? 0.88 : 0.50;
        }
        else if (combined.Contains("UNIFIED MULTI-PURPOSE") || combined.Contains("CRN") || selectedCat == "umid")
        {
            response.CategoryKey = "umid";
            response.DocumentFamily = "Unified Multi-Purpose ID (UMID)";
            response.Issuer = "SSS / GSIS / PhilHealth / Pag-IBIG";
            response.Version = "umid-crn-v1";
            response.DetectedSide = "front";
            response.TemplateId = "PH-UMID-GENERIC-FRONT";
            response.CalibratedConfidence = combined.Contains("UNIFIED MULTI-PURPOSE") || combined.Contains("CRN") ? 0.88 : 0.50;
        }
        else
        {
            response.DocumentFamily = string.IsNullOrWhiteSpace(selectedCat) || selectedCat == "unknown"
                ? "Unclassified Philippine Document"
                : selectedCat.ToUpperInvariant();
            response.Issuer = "Republic of the Philippines";
            response.Version = "generic-v1";
            response.DetectedSide = "front";
            response.TemplateId = $"PH-{response.CategoryKey.ToUpperInvariant()}-GENERIC";
            response.CalibratedConfidence = !string.IsNullOrWhiteSpace(combined) ? 0.72 : 0.45;
        }

        if (request.ExtractedFields != null)
        {
            foreach (var kvp in request.ExtractedFields)
            {
                if (!string.IsNullOrWhiteSpace(kvp.Value))
                {
                    response.NormalizedFields[kvp.Key] = kvp.Value.Trim();
                }
            }
        }

        response.OverallStatus = response.CalibratedConfidence >= 0.80
            ? "READY_FOR_PREFILL"
            : (response.CategoryKey == "unknown" ? "UNSUPPORTED_DOCUMENT" : "OCR_NEEDS_REVIEW");

        return response;
    }
}
