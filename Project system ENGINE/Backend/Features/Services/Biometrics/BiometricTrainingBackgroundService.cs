// [Layer: Backend/Services/Biometrics]
// Responsibility: Asynchronous Channel-backed background worker that processes persisted multi-pose biometric frames and Gov ID references into refined enrollment templates.
// Complies with Katipuneros Architecture: Universal Lambdas (=>), Zero Emojis, Open/Closed Principle (OCP), Pure ASCII.

using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using Backend.Features.Data;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ResQTrack.Backend.Features.Services.Biometrics;

public interface IBiometricTrainingQueue
{
    ValueTask QueueAsync(Guid enrollmentId, CancellationToken ct = default);
}

public sealed class BiometricTrainingChannelQueue : IBiometricTrainingQueue
{
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });

    public ChannelReader<Guid> Reader => _channel.Reader;

    public ValueTask QueueAsync(Guid enrollmentId, CancellationToken ct = default) =>
        enrollmentId == Guid.Empty
            ? ValueTask.CompletedTask
            : _channel.Writer.WriteAsync(enrollmentId, ct);
}

public sealed class BiometricTrainingBackgroundService(
    IServiceScopeFactory scopeFactory,
    IBiometricTrainingQueue queue,
    ILogger<BiometricTrainingBackgroundService>? logger = null) : BackgroundService
{
    private const int MaxExtractedTrainingFrames = 12;
    private static readonly string[] OrderedPoseKeys = ["CENTER", "RIGHT", "LEFT", "BLINK", "UP"];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverPendingLearningEnrollmentsAsync(stoppingToken);

        if (queue is not BiometricTrainingChannelQueue channelQueue)
        {
            return;
        }

        try
        {
            await foreach (Guid enrollmentId in channelQueue.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
                    AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    IClaudeMessagesClient? claudeClient = scope.ServiceProvider.GetService<IClaudeMessagesClient>();
                    IConfiguration? configuration = scope.ServiceProvider.GetService<IConfiguration>();

                    await ProcessEnrollmentCoreAsync(db, enrollmentId, claudeClient, configuration, logger, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    logger?.LogWarning(
                        ex,
                        "[BiometricTrainingBackgroundService] Unhandled error processing enrollment {EnrollmentId}.",
                        enrollmentId);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Graceful host shutdown.
        }
    }

    public static Task ProcessEnrollmentAsync(
        AppDbContext db,
        Guid enrollmentId,
        CancellationToken ct = default) =>
        ProcessEnrollmentCoreAsync(db, enrollmentId, claudeClient: null, configuration: null, logger: null, ct);

    private async Task RecoverPendingLearningEnrollmentsAsync(CancellationToken ct)
    {
        try
        {
            await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            IClaudeMessagesClient? claudeClient = scope.ServiceProvider.GetService<IClaudeMessagesClient>();
            IConfiguration? configuration = scope.ServiceProvider.GetService<IConfiguration>();

            List<Guid> pendingIds = await db.BiometricEnrollments
                .AsNoTracking()
                .Where(b => b.RevokedAtUtc == null && b.EnrollmentStatus == "ACTIVE" && b.TrainingStatus == "LEARNING")
                .OrderBy(b => b.EnrolledAtUtc)
                .Select(b => b.Id)
                .ToListAsync(ct);

            foreach (Guid enrollmentId in pendingIds)
            {
                if (ct.IsCancellationRequested)
                {
                    break;
                }

                await ProcessEnrollmentCoreAsync(db, enrollmentId, claudeClient, configuration, logger, ct);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Shutdown during recovery sweep.
        }
        catch (Exception ex)
        {
            logger?.LogDebug(ex, "[BiometricTrainingBackgroundService] Startup recovery sweep skipped.");
        }
    }

    private static async Task ProcessEnrollmentCoreAsync(
        AppDbContext db,
        Guid enrollmentId,
        IClaudeMessagesClient? claudeClient,
        IConfiguration? configuration,
        ILogger? logger,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(db);

        BiometricEnrollment? enrollment = await db.BiometricEnrollments
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == enrollmentId, ct);

        if (enrollment == null)
        {
            return;
        }

        User? user = enrollment.User ?? await db.Users.FirstOrDefaultAsync(u => u.Id == enrollment.UserId, ct);
        List<ExtractedTrainingFrame> frames = ExtractPoseFrames(enrollment.PoseFramesJson);

        bool hasVector = TryExtractNormalizedVector(enrollment.EncryptedTemplateData, out float[]? normalizedVector, out double l2Norm);
        if (hasVector && normalizedVector != null)
        {
            byte[] normalizedBytes = new byte[normalizedVector.Length * sizeof(float)];
            Buffer.BlockCopy(normalizedVector, 0, normalizedBytes, 0, normalizedBytes.Length);
            enrollment.EncryptedTemplateData = normalizedBytes;
        }

        if (frames.Count == 0 && !hasVector)
        {
            DateTime failedAt = DateTime.UtcNow;
            enrollment.TrainingStatus = "FAILED";
            enrollment.TrainingCompletedAtUtc = failedAt;
            enrollment.TrainedFrameCount = 0;
            enrollment.TrainingNotes = "No usable pose frames or 128-D facial descriptor vector found for training.";
            await db.SaveChangesAsync(ct);
            return;
        }

        int distinctPoses = frames
            .Select(f => f.PoseKey)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        int trainedFrameCount = frames.Count > 0 ? frames.Count : Math.Max(1, enrollment.TrainedFrameCount);

        (byte[] Bytes, string MimeType)? govIdReference = await TryLoadGovIdReferenceAsync(user, ct);
        (double? ClaudeQuality, string? ClaudeNotes) claudeOutcome = await TryRunClaudeReinforcementAsync(
            claudeClient,
            configuration,
            frames,
            govIdReference,
            logger,
            ct);

        double deterministicQuality = ComputeDeterministicQualityScore(distinctPoses, trainedFrameCount, hasVector, l2Norm, govIdReference.HasValue);
        double finalQuality = claudeOutcome.ClaudeQuality.HasValue
            ? Math.Round(Math.Clamp((deterministicQuality * 0.45) + (claudeOutcome.ClaudeQuality.Value * 0.55), 0.50, 0.99), 4)
            : deterministicQuality;

        DateTime completedAt = DateTime.UtcNow;
        enrollment.TrainedFrameCount = trainedFrameCount;
        enrollment.EnrollmentQualityScore = finalQuality;
        enrollment.GeometricSignatureJson = EnrichGeometricSignatureJson(
            enrollment.GeometricSignatureJson,
            frames,
            distinctPoses,
            trainedFrameCount,
            hasVector,
            l2Norm,
            govIdReference.HasValue,
            finalQuality,
            completedAt);
        enrollment.TrainingStatus = "READY";
        enrollment.TrainingCompletedAtUtc = completedAt;

        string rawNotes = !string.IsNullOrWhiteSpace(claudeOutcome.ClaudeNotes)
            ? claudeOutcome.ClaudeNotes!
            : $"Geometric & multi-pose reinforcement complete ({trainedFrameCount} frame(s), {distinctPoses} pose(s), quality {finalQuality:F2}).";
        enrollment.TrainingNotes = TruncateNote(rawNotes, 500);

        await AppendTrainingAuditLogAsync(db, enrollment, user, trainedFrameCount, finalQuality, completedAt, ct);
        await db.SaveChangesAsync(ct);
    }

    internal static int CountPoseFrames(string? poseFramesJson) =>
        ExtractPoseFrames(poseFramesJson).Count;

    internal static List<ExtractedTrainingFrame> ExtractPoseFrames(string? poseFramesJson)
    {
        var collected = new List<ExtractedTrainingFrame>(MaxExtractedTrainingFrames);
        if (string.IsNullOrWhiteSpace(poseFramesJson))
        {
            return collected;
        }

        try
        {
            using var doc = JsonDocument.Parse(poseFramesJson);
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return collected;
            }

            var seenHashes = new HashSet<string>(StringComparer.Ordinal);

            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "frameBundles", out JsonElement bundlesEl) &&
                bundlesEl.ValueKind == JsonValueKind.Object)
            {
                CollectFromContainer(bundlesEl, collected, seenHashes);
            }

            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "poses", out JsonElement posesEl) &&
                posesEl.ValueKind == JsonValueKind.Object)
            {
                CollectFromContainer(posesEl, collected, seenHashes);
            }

            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "bestFrames", out JsonElement bestEl) &&
                bestEl.ValueKind == JsonValueKind.Object)
            {
                CollectFromContainer(bestEl, collected, seenHashes);
            }

            if (collected.Count == 0)
            {
                CollectFromContainer(root, collected, seenHashes);
            }
        }
        catch (JsonException)
        {
            return [];
        }

        return collected;
    }

    private static void CollectFromContainer(
        JsonElement container,
        List<ExtractedTrainingFrame> collected,
        HashSet<string> seenHashes)
    {
        foreach (string poseKey in OrderedPoseKeys)
        {
            if (collected.Count >= MaxExtractedTrainingFrames)
            {
                break;
            }

            if (!SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(container, poseKey, out JsonElement poseEl))
            {
                continue;
            }

            AppendPoseElementFrames(poseKey, poseEl, collected, seenHashes);
        }
    }

    private static void AppendPoseElementFrames(
        string poseKey,
        JsonElement poseEl,
        List<ExtractedTrainingFrame> collected,
        HashSet<string> seenHashes)
    {
        if (poseEl.ValueKind == JsonValueKind.Array)
        {
            foreach (JsonElement item in poseEl.EnumerateArray())
            {
                if (collected.Count >= MaxExtractedTrainingFrames)
                {
                    break;
                }

                TryAddImageFromElement(poseKey, item, collected, seenHashes);
            }
            return;
        }

        if (poseEl.ValueKind == JsonValueKind.Object &&
            SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(poseEl, "frames", out JsonElement nestedFrames) &&
            nestedFrames.ValueKind == JsonValueKind.Array)
        {
            foreach (JsonElement item in nestedFrames.EnumerateArray())
            {
                if (collected.Count >= MaxExtractedTrainingFrames)
                {
                    break;
                }

                TryAddImageFromElement(poseKey, item, collected, seenHashes);
            }
        }

        TryAddImageFromElement(poseKey, poseEl, collected, seenHashes);
    }

    private static void TryAddImageFromElement(
        string poseKey,
        JsonElement element,
        List<ExtractedTrainingFrame> collected,
        HashSet<string> seenHashes)
    {
        if (collected.Count >= MaxExtractedTrainingFrames)
        {
            return;
        }

        string? raw = element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Object =>
                SharedGovIdForensicsEvaluator.TryReadOptionalString(element, "bestFrameDataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(element, "frameDataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(element, "dataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(element, "base64"),
            _ => null
        };

        if (string.IsNullOrWhiteSpace(raw))
        {
            return;
        }

        string trimmed = raw.Trim();
        bool hasDataPrefix = trimmed.StartsWith("data:", StringComparison.OrdinalIgnoreCase);
        var (parsedMime, base64Payload) = SharedGovIdForensicsEvaluator.ParseDataUrl(trimmed);
        byte[] decoded = SharedGovIdForensicsEvaluator.TryDecodeBase64(base64Payload);
        if (decoded.Length == 0 || !CaptureStorageHelper.IsValidImageHeader(decoded))
        {
            return;
        }

        string hash = Convert.ToHexString(SHA256.HashData(decoded));
        if (!seenHashes.Add(hash))
        {
            return;
        }

        string mime = hasDataPrefix
            ? SharedGovIdForensicsEvaluator.NormalizeClaudeMime(parsedMime)
            : CaptureStorageHelper.DetermineContentType(decoded);

        collected.Add(new ExtractedTrainingFrame(poseKey, decoded, mime));
    }

    private static bool TryExtractNormalizedVector(
        byte[]? encryptedTemplateData,
        out float[]? normalizedVector,
        out double originalNorm)
    {
        normalizedVector = null;
        originalNorm = 0.0;

        if (encryptedTemplateData == null || encryptedTemplateData.Length < sizeof(float))
        {
            return false;
        }

        int count = encryptedTemplateData.Length / sizeof(float);
        var floats = new float[count];
        Buffer.BlockCopy(encryptedTemplateData, 0, floats, 0, count * sizeof(float));

        double sumSq = 0.0;
        for (int i = 0; i < floats.Length; i++)
        {
            if (!float.IsFinite(floats[i]))
            {
                return false;
            }
            sumSq += floats[i] * floats[i];
        }

        originalNorm = Math.Sqrt(sumSq);
        if (originalNorm <= 1e-6)
        {
            return false;
        }

        var normalized = new float[floats.Length];
        for (int i = 0; i < floats.Length; i++)
        {
            normalized[i] = (float)(floats[i] / originalNorm);
        }

        normalizedVector = normalized;
        return true;
    }

    private static async Task<(byte[] Bytes, string MimeType)?> TryLoadGovIdReferenceAsync(
        User? user,
        CancellationToken ct)
    {
        if (user == null || string.IsNullOrWhiteSpace(user.IdCapturePath) || !File.Exists(user.IdCapturePath))
        {
            return null;
        }

        try
        {
            var (bytes, mimeType) = await CaptureStorageHelper.ReadCaptureFileAsync(user.IdCapturePath, ct);
            return bytes is { Length: > 0 } && CaptureStorageHelper.IsValidImageHeader(bytes)
                ? (bytes, SharedGovIdForensicsEvaluator.NormalizeClaudeMime(mimeType))
                : null;
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            return null;
        }
    }

    private static async Task<(double? ClaudeQuality, string? ClaudeNotes)> TryRunClaudeReinforcementAsync(
        IClaudeMessagesClient? claudeClient,
        IConfiguration? configuration,
        IReadOnlyList<ExtractedTrainingFrame> frames,
        (byte[] Bytes, string MimeType)? govIdReference,
        ILogger? logger,
        CancellationToken ct)
    {
        if (claudeClient is not { IsConfigured: true } || frames.Count == 0)
        {
            return (null, null);
        }

        bool trainingAiEnabled = !string.Equals(
            configuration?["Biometrics:EnableAsyncClaudeTraining"],
            "false",
            StringComparison.OrdinalIgnoreCase);

        if (!trainingAiEnabled)
        {
            return (null, null);
        }

        try
        {
            List<ExtractedTrainingFrame> sampleFrames = frames
                .GroupBy(f => f.PoseKey, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .Take(4)
                .ToList();

            var contentBlocks = new List<object>(sampleFrames.Count + 2);
            foreach (ExtractedTrainingFrame frame in sampleFrames)
            {
                contentBlocks.Add(new
                {
                    type = "image",
                    source = new
                    {
                        type = "base64",
                        media_type = SharedGovIdForensicsEvaluator.NormalizeClaudeMime(frame.MimeType),
                        data = Convert.ToBase64String(frame.Bytes)
                    }
                });
            }

            if (govIdReference.HasValue)
            {
                contentBlocks.Add(new
                {
                    type = "image",
                    source = new
                    {
                        type = "base64",
                        media_type = govIdReference.Value.MimeType,
                        data = Convert.ToBase64String(govIdReference.Value.Bytes)
                    }
                });
            }

            string poseList = string.Join(", ", sampleFrames.Select(f => f.PoseKey));
            contentBlocks.Add(new
            {
                type = "text",
                text = $"Evaluate these enrolled biometric training poses ({poseList})" +
                       (govIdReference.HasValue ? " and the final Government ID reference image" : string.Empty) +
                       ". Return ONLY JSON: {\"qualityScore\":0.0,\"poseDiversityOk\":true,\"summary\":\"...\"}."
            });

            var payload = new Dictionary<string, object>
            {
                ["max_tokens"] = 192,
                ["temperature"] = 0.0,
                ["messages"] = new object[]
                {
                    new
                    {
                        role = "user",
                        content = contentBlocks.ToArray()
                    }
                }
            };

            ClaudeMessageAttemptResult attempt = await claudeClient.SendMessagesAsync(payload, ct);
            if (!attempt.Success || string.IsNullOrWhiteSpace(attempt.RawText))
            {
                logger?.LogDebug(
                    "[BiometricTrainingBackgroundService] Claude reinforcement skipped ({ErrorCode}); using deterministic fallback.",
                    attempt.ErrorCode ?? "PROVIDER_UNAVAILABLE");
                return (null, null);
            }

            string cleanJson = SharedGovIdForensicsEvaluator.CleanJsonFences(attempt.RawText);
            using var doc = JsonDocument.Parse(cleanJson);
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return (null, null);
            }

            double? quality = null;
            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "qualityScore", out JsonElement qProp) &&
                qProp.ValueKind == JsonValueKind.Number &&
                qProp.TryGetDouble(out double parsedQ) &&
                double.IsFinite(parsedQ))
            {
                quality = Math.Clamp(parsedQ, 0.50, 0.99);
            }

            string? summary = SharedGovIdForensicsEvaluator.TryReadOptionalString(root, "summary");
            return (quality, summary);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger?.LogDebug(ex, "[BiometricTrainingBackgroundService] Claude reinforcement fallback triggered.");
            return (null, null);
        }
    }

    private static double ComputeDeterministicQualityScore(
        int distinctPoses,
        int trainedFrameCount,
        bool hasVector,
        double l2Norm,
        bool hasGovIdReference)
    {
        double poseScore = Math.Min(4, distinctPoses) / 4.0 * 0.25;
        double frameDensityScore = Math.Min(8, trainedFrameCount) / 8.0 * 0.12;
        double vectorScore = hasVector && l2Norm > 1e-4 ? 0.10 : 0.0;
        double idBonus = hasGovIdReference ? 0.03 : 0.0;
        return Math.Round(Math.Clamp(0.48 + poseScore + frameDensityScore + vectorScore + idBonus, 0.50, 0.98), 4);
    }

    private static string EnrichGeometricSignatureJson(
        string? existingJson,
        IReadOnlyList<ExtractedTrainingFrame> frames,
        int distinctPoses,
        int trainedFrameCount,
        bool hasVector,
        double l2Norm,
        bool hasGovIdReference,
        double qualityScore,
        DateTime completedAt)
    {
        JsonObject rootObj;
        if (!string.IsNullOrWhiteSpace(existingJson))
        {
            try
            {
                rootObj = JsonNode.Parse(existingJson) as JsonObject ?? new JsonObject();
            }
            catch (JsonException)
            {
                rootObj = new JsonObject();
            }
        }
        else
        {
            rootObj = new JsonObject();
        }

        var poseSummary = new JsonArray();
        foreach (string pose in frames.Select(f => f.PoseKey).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            poseSummary.Add(pose);
        }

        rootObj["trainingPipeline"] = "AsyncChannelMultiFrameGeometricV2";
        rootObj["trainingCompletedAtUtc"] = completedAt.ToString("O", CultureInfo.InvariantCulture);
        rootObj["trainedFrameCount"] = trainedFrameCount;
        rootObj["distinctPoseCount"] = distinctPoses;
        rootObj["trainedPoses"] = poseSummary;
        rootObj["descriptor128DVerified"] = hasVector;
        rootObj["descriptorL2Norm"] = Math.Round(l2Norm, 4);
        rootObj["govIdReferenceAttached"] = hasGovIdReference;
        rootObj["enrollmentQualityScore"] = qualityScore;

        return rootObj.ToJsonString();
    }

    private static async Task AppendTrainingAuditLogAsync(
        AppDbContext db,
        BiometricEnrollment enrollment,
        User? user,
        int trainedFrameCount,
        double qualityScore,
        DateTime timestamp,
        CancellationToken ct)
    {
        string prevHash = await db.AuditLogs
            .OrderByDescending(a => a.Timestamp)
            .Select(a => a.CurrentHash)
            .FirstOrDefaultAsync(ct)
            ?? "0000000000000000000000000000000000000000000000000000000000000000";

        string email = user?.Email ?? "UNKNOWN";
        string payload =
            $"EnrollmentId: {enrollment.Id}, UserId: {enrollment.UserId}, Email: {email}, " +
            $"TrainedFrameCount: {trainedFrameCount}, QualityScore: {qualityScore:F4}, Status: READY";
        string currentHash = AuditHelper.ComputeChainedHash(
            prevHash,
            timestamp,
            enrollment.UserId,
            "BIOMETRIC_AI_TRAINING_COMPLETED",
            payload);

        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = enrollment.UserId,
            Action = "BIOMETRIC_AI_TRAINING_COMPLETED",
            TargetEntity = nameof(BiometricEnrollment),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = currentHash,
            Timestamp = timestamp
        });
    }

    private static string TruncateNote(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    internal sealed record ExtractedTrainingFrame(string PoseKey, byte[] Bytes, string MimeType);
}
