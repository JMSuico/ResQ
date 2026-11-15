// [Layer: Backend/Services/Biometrics]
// Responsibility: Implements Claude Vision cached 4-pose enrollment gallery identity & anti-spoofing liveness strategy.
// Open/Closed Principle (OCP), Universal Lambda Expressions (=>), Fail-Closed AI Verification, Zero Emojis.

using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace ResQTrack.Backend.Features.Services.Biometrics;

public sealed record ClaudeBiometricIdentityInput(
    string LiveCaptureBase64,
    string? PoseFramesJson,
    string? PreferredModel = null,
    string[]? LiveCaptureFramesBase64 = null);

public sealed record ClaudeBiometricIdentityResult(
    bool SamePerson,
    bool IsLiveHuman,
    double Similarity,
    string? ModelUsed = null,
    bool UsedFallbackModel = false,
    string? Reason = null,
    string? ErrorCode = null);

public interface IClaudeBiometricIdentityStrategy
{
    bool IsConfigured { get; }

    Task<ClaudeBiometricIdentityResult> VerifyLiveAgainstCachedPosesAsync(
        ClaudeBiometricIdentityInput input,
        CancellationToken ct = default);
}

public class ClaudeCachedPoseIdentityStrategy(
    IClaudeMessagesClient? claudeClient = null,
    IConfiguration? configuration = null,
    ILogger<ClaudeCachedPoseIdentityStrategy>? logger = null) : IClaudeBiometricIdentityStrategy
{
    public const double DefaultClaudeSimilarityThreshold = 0.78;
    private const int MaxLiveFrames = 3;
    private const int MaxCachedPoseFrames = 4;

    private static readonly string[] OrderedPoseKeys = ["CENTER", "RIGHT", "LEFT", "BLINK", "UP"];

    private readonly IClaudeMessagesClient _claudeClient =
        claudeClient ?? new ClaudeMessagesClient(null, configuration, NullLogger<ClaudeMessagesClient>.Instance);

    private readonly ILogger<ClaudeCachedPoseIdentityStrategy> _logger =
        logger ?? NullLogger<ClaudeCachedPoseIdentityStrategy>.Instance;

    public bool IsConfigured => _claudeClient.IsConfigured;

    internal static bool HasUsablePoseFrames(string? poseFramesJson) =>
        ExtractCachedPoseFrames(poseFramesJson).Count > 0;

    public async Task<ClaudeBiometricIdentityResult> VerifyLiveAgainstCachedPosesAsync(
        ClaudeBiometricIdentityInput input,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);

        List<(byte[] Bytes, string MimeType)> liveFrames =
            ExtractDistinctLiveFrames(input.LiveCaptureBase64, input.LiveCaptureFramesBase64);

        if (liveFrames.Count == 0)
        {
            return BuildFailure(
                isLiveHuman: false,
                similarity: 0.0,
                modelUsed: null,
                usedFallbackModel: false,
                reason: "No valid live capture frame provided for biometric comparison.",
                errorCode: "MISSING_LIVE_IMAGE");
        }

        List<(string PoseKey, byte[] Bytes, string MimeType)> cachedPoses =
            ExtractCachedPoseFrames(input.PoseFramesJson);

        if (cachedPoses.Count == 0)
        {
            return BuildFailure(
                isLiveHuman: false,
                similarity: 0.0,
                modelUsed: null,
                usedFallbackModel: false,
                reason: "No valid cached enrollment pose images available in PoseFramesJson.",
                errorCode: "MISSING_POSE_FRAMES");
        }

        if (!IsConfigured)
        {
            return BuildFailure(
                isLiveHuman: false,
                similarity: 0.0,
                modelUsed: _claudeClient.PrimaryModel,
                usedFallbackModel: false,
                reason: "Claude Vision biometric service is not configured.",
                errorCode: "PROVIDER_UNAVAILABLE");
        }

        Dictionary<string, object> payload = BuildAnthropicPayload(liveFrames, cachedPoses);

        ClaudeMessageAttemptResult attempt;
        try
        {
            attempt = await _claudeClient.SendMessagesAsync(payload, ct, input.PreferredModel);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning("Claude cached-pose biometric request failed ({Message}).", ex.Message);
            return BuildFailure(
                isLiveHuman: false,
                similarity: 0.0,
                modelUsed: _claudeClient.PrimaryModel,
                usedFallbackModel: false,
                reason: "Claude Vision biometric verification request failed.",
                errorCode: "PROVIDER_UNAVAILABLE");
        }

        if (!attempt.Success || string.IsNullOrWhiteSpace(attempt.RawText))
        {
            return BuildFailure(
                isLiveHuman: false,
                similarity: 0.0,
                modelUsed: attempt.ModelUsed,
                usedFallbackModel: attempt.UsedFallbackModel,
                reason: attempt.ErrorMessage ?? "Claude Vision biometric verification service returned an error.",
                errorCode: attempt.ErrorCode ?? "PROVIDER_UNAVAILABLE");
        }

        double threshold = ResolveClaudeSimilarityThreshold();
        return ParseVerdict(attempt, threshold);
    }

    private double ResolveClaudeSimilarityThreshold() =>
        double.TryParse(
            configuration?["Biometrics:ClaudeSimilarityThreshold"],
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out double configured) && configured is > 0.1 and <= 0.99
            ? configured
            : DefaultClaudeSimilarityThreshold;

    private static Dictionary<string, object> BuildAnthropicPayload(
        IReadOnlyList<(byte[] Bytes, string MimeType)> liveFrames,
        IReadOnlyList<(string PoseKey, byte[] Bytes, string MimeType)> cachedPoses)
    {
        var contentBlocks = new List<object>(liveFrames.Count + cachedPoses.Count + 1);

        foreach ((byte[] bytes, string mimeType) in liveFrames)
        {
            contentBlocks.Add(BuildImageBlock(bytes, mimeType));
        }

        foreach ((_, byte[] bytes, string mimeType) in cachedPoses)
        {
            contentBlocks.Add(BuildImageBlock(bytes, mimeType));
        }

        string liveRange = liveFrames.Count == 1 ? "Image 1" : $"Images 1-{liveFrames.Count}";
        string poseLabels = string.Join(
            ", ",
            cachedPoses.Select((pose, idx) => $"Image {liveFrames.Count + 1 + idx}={pose.PoseKey}"));

        contentBlocks.Add(new
        {
            type = "text",
            text = $"{liveRange} represent(s) the live login capture frame(s). " +
                   $"The subsequent images ({poseLabels}) are the user's cached enrollment pose gallery " +
                   $"(BIOMETRIC_GALLERY_MATCH). Judge liveness (reject printed photo, screen replay, mask, or flat frame) " +
                   $"and whether the live person matches the enrolled identity across all cached enrollment poses. " +
                   $"Return ONLY JSON with isLiveHuman, samePerson, similarity (0.0-1.0), bestMatchingPose, and reason."
        });

        return new Dictionary<string, object>
        {
            ["max_tokens"] = 256,
            ["temperature"] = 0.0,
            ["system"] = new object[]
            {
                new
                {
                    type = "text",
                    text = BuildSystemPrompt(),
                    cache_control = new { type = "ephemeral" }
                }
            },
            ["messages"] = new object[]
            {
                new
                {
                    role = "user",
                    content = contentBlocks.ToArray()
                }
            }
        };
    }

    private static object BuildImageBlock(byte[] bytes, string mimeType) =>
        new
        {
            type = "image",
            source = new
            {
                type = "base64",
                media_type = SharedGovIdForensicsEvaluator.NormalizeClaudeMime(mimeType),
                data = Convert.ToBase64String(bytes)
            }
        };

    private static string BuildSystemPrompt() =>
        "You are a forensic facial liveness and biometric identity verification engine (BIOMETRIC_GALLERY_MATCH).\n" +
        "Compare the live login capture frame(s) against the user's cached enrollment pose gallery (CENTER, RIGHT, LEFT, BLINK).\n" +
        "1. isLiveHuman: true only for a genuine live human face; false for printed photo, screen replay, bezel, moire, mask, or flat spoof frame.\n" +
        "2. samePerson: true only if facial bone structure, eye/brow spacing, nose bridge, and jawline clearly match the cached enrollment pose gallery even under dim or uneven lighting.\n" +
        "3. similarity: 0.0 to 1.0 identity similarity score.\n" +
        "4. bestMatchingPose: \"CENTER\"|\"RIGHT\"|\"LEFT\"|\"BLINK\"|\"UNKNOWN\".\n" +
        "5. reason: concise 1-sentence reason.\n" +
        "Respond with ONLY valid JSON (no markdown):\n" +
        "{\"isLiveHuman\":true|false,\"samePerson\":true|false,\"similarity\":0.0,\"bestMatchingPose\":\"CENTER\",\"reason\":\"...\"}";

    private static ClaudeBiometricIdentityResult ParseVerdict(
        ClaudeMessageAttemptResult attempt,
        double threshold)
    {
        string cleanJson = SharedGovIdForensicsEvaluator.CleanJsonFences(attempt.RawText ?? string.Empty);

        try
        {
            using var doc = JsonDocument.Parse(cleanJson);
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return BuildFailure(
                    isLiveHuman: false,
                    similarity: 0.0,
                    modelUsed: attempt.ModelUsed,
                    usedFallbackModel: attempt.UsedFallbackModel,
                    reason: "Claude biometric response was not a structured JSON object.",
                    errorCode: "INVALID_AI_RESPONSE");
            }

            bool isLiveHuman = SharedGovIdForensicsEvaluator.TryReadOptionalBool(root, "isLiveHuman") ?? false;
            bool claudeSamePerson = SharedGovIdForensicsEvaluator.TryReadOptionalBool(root, "samePerson") ?? false;
            string? reason = SharedGovIdForensicsEvaluator.TryReadOptionalString(root, "reason");
            string? bestPose = SharedGovIdForensicsEvaluator.TryReadOptionalString(root, "bestMatchingPose");

            double similarity = 0.0;
            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "similarity", out JsonElement simProp) &&
                simProp.ValueKind == JsonValueKind.Number &&
                simProp.TryGetDouble(out double parsedSim) &&
                double.IsFinite(parsedSim))
            {
                similarity = Math.Clamp(Math.Round(parsedSim, 4), 0.0, 1.0);
            }

            bool verified = claudeSamePerson && isLiveHuman && similarity >= threshold;
            string? errorCode = verified
                ? null
                : !isLiveHuman
                    ? "LIVENESS_SPOOF_REJECTED"
                    : !claudeSamePerson
                        ? "IDENTITY_MISMATCH"
                        : "SIMILARITY_BELOW_THRESHOLD";

            string resolvedReason = !string.IsNullOrWhiteSpace(reason)
                ? reason!
                : verified
                    ? $"Live face matched cached enrollment pose gallery (best pose: {bestPose ?? "CENTER"}, similarity: {similarity:F2})."
                    : $"Live face rejected against cached enrollment pose gallery (similarity: {similarity:F2}, threshold: {threshold:F2}).";

            return new ClaudeBiometricIdentityResult(
                SamePerson: verified,
                IsLiveHuman: isLiveHuman,
                Similarity: similarity,
                ModelUsed: attempt.ModelUsed,
                UsedFallbackModel: attempt.UsedFallbackModel,
                Reason: resolvedReason,
                ErrorCode: errorCode);
        }
        catch (JsonException)
        {
            return BuildFailure(
                isLiveHuman: false,
                similarity: 0.0,
                modelUsed: attempt.ModelUsed,
                usedFallbackModel: attempt.UsedFallbackModel,
                reason: "Claude biometric verification engine returned malformed JSON.",
                errorCode: "INVALID_AI_RESPONSE");
        }
    }

    private static List<(byte[] Bytes, string MimeType)> ExtractDistinctLiveFrames(
        string? primaryBase64,
        string[]? extraFramesBase64)
    {
        var frames = new List<(byte[] Bytes, string MimeType)>(MaxLiveFrames);
        var seenHashes = new HashSet<string>(StringComparer.Ordinal);

        void TryAddFrame(string? raw)
        {
            if (frames.Count >= MaxLiveFrames ||
                !TryDecodeImageDataUrlOrBase64(raw, out byte[] bytes, out string mime))
            {
                return;
            }

            string hash = Convert.ToHexString(SHA256.HashData(bytes));
            if (seenHashes.Add(hash))
            {
                frames.Add((bytes, mime));
            }
        }

        TryAddFrame(primaryBase64);
        if (extraFramesBase64 != null)
        {
            foreach (string frame in extraFramesBase64)
            {
                TryAddFrame(frame);
                if (frames.Count >= MaxLiveFrames)
                {
                    break;
                }
            }
        }

        return frames;
    }

    private static List<(string PoseKey, byte[] Bytes, string MimeType)> ExtractCachedPoseFrames(string? poseFramesJson)
    {
        if (string.IsNullOrWhiteSpace(poseFramesJson))
        {
            return [];
        }

        try
        {
            using var doc = JsonDocument.Parse(poseFramesJson);
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return [];
            }

            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "bestFrames", out JsonElement bestObj) &&
                bestObj.ValueKind == JsonValueKind.Object)
            {
                List<(string PoseKey, byte[] Bytes, string MimeType)> fromBest = ExtractPosesFromContainer(bestObj);
                if (fromBest.Count > 0)
                {
                    return fromBest;
                }
            }

            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "poses", out JsonElement posesObj) &&
                posesObj.ValueKind == JsonValueKind.Object)
            {
                List<(string PoseKey, byte[] Bytes, string MimeType)> fromPoses = ExtractPosesFromContainer(posesObj);
                if (fromPoses.Count > 0)
                {
                    return fromPoses;
                }
            }

            return ExtractPosesFromContainer(root);
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static List<(string PoseKey, byte[] Bytes, string MimeType)> ExtractPosesFromContainer(JsonElement container)
    {
        var poses = new List<(string PoseKey, byte[] Bytes, string MimeType)>(MaxCachedPoseFrames);

        foreach (string poseKey in OrderedPoseKeys)
        {
            if (poses.Count >= MaxCachedPoseFrames)
            {
                break;
            }

            if (!SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(container, poseKey, out JsonElement poseEl))
            {
                continue;
            }

            string? rawImage = ExtractPoseImageString(poseEl);
            if (TryDecodeImageDataUrlOrBase64(rawImage, out byte[] bytes, out string mime))
            {
                poses.Add((poseKey, bytes, mime));
            }
        }

        return poses;
    }

    private static string? ExtractPoseImageString(JsonElement poseEl) =>
        poseEl.ValueKind switch
        {
            JsonValueKind.String => poseEl.GetString(),
            JsonValueKind.Object =>
                SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "bestFrameDataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "frameDataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "dataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "base64"),
            _ => null
        };

    private static bool TryDecodeImageDataUrlOrBase64(
        string? raw,
        out byte[] bytes,
        out string mimeType)
    {
        bytes = [];
        mimeType = "image/jpeg";
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        string trimmed = raw.Trim();
        bool hasDataUrlPrefix = trimmed.StartsWith("data:", StringComparison.OrdinalIgnoreCase);
        var (parsedMime, b64) = SharedGovIdForensicsEvaluator.ParseDataUrl(trimmed);
        byte[] decoded = SharedGovIdForensicsEvaluator.TryDecodeBase64(b64);
        if (decoded.Length == 0)
        {
            return false;
        }

        bytes = decoded;
        mimeType = hasDataUrlPrefix
            ? SharedGovIdForensicsEvaluator.NormalizeClaudeMime(parsedMime)
            : DetectImageMimeFromBytes(decoded);
        return true;
    }

    private static string DetectImageMimeFromBytes(byte[] bytes)
    {
        if (bytes.Length >= 4 &&
            bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
        {
            return "image/png";
        }

        if (bytes.Length >= 3 &&
            bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (bytes.Length >= 4 &&
            bytes[0] == (byte)'G' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'8')
        {
            return "image/gif";
        }

        if (bytes.Length >= 12 &&
            bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F' &&
            bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P')
        {
            return "image/webp";
        }

        return "image/jpeg";
    }

    private static ClaudeBiometricIdentityResult BuildFailure(
        bool isLiveHuman,
        double similarity,
        string? modelUsed,
        bool usedFallbackModel,
        string reason,
        string errorCode) =>
        new(
            SamePerson: false,
            IsLiveHuman: isLiveHuman,
            Similarity: similarity,
            ModelUsed: modelUsed,
            UsedFallbackModel: usedFallbackModel,
            Reason: reason,
            ErrorCode: errorCode);
}

// Note: Backend.Features.Services.Biometrics compatibility bridge and global using are declared in IBiometricLoginValidationStrategy.cs.
