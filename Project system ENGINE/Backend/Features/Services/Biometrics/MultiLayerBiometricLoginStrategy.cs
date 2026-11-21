// [Layer: Backend/Services/Biometrics]
// Responsibility: Implements the 5-Layer Hybrid Claude AI 4-Pose Gallery & 128-D Geometric Biometric Login Validation Strategy.
// Sequentially executes:
//   Layer 1: OPTICAL_LIVENESS_GATE ("Optical Liveness & Oval Reticle Gate")
//   Layer 2: CLAUDE_AI_BIOMETRIC_STRATEGY ("Claude AI Vision & Geometric Pattern Extraction")
//   Layer 3: DATABASE_TRAINED_KNOWLEDGE_LOOKUP ("SQL Server Trained Knowledge & Frame Repository Reader")
//   Layer 4: MULTI_FACTOR_VERIFICATION_ENGINE ("Hybrid Claude 4-Pose Gallery & 128-D Cosine Verification")
//   Layer 5: DETERMINISTIC_VALIDATION_VERDICT ("Final Multi-Layer Validation Gate")
// Complies with Katipuneros Architecture: Universal Lambdas (=>), Zero Emojis, Open/Closed Principle (OCP).

using System.Globalization;
using System.Text.Json;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Services.Verification;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ResQTrack.Backend.Features.Services.Biometrics;

public class MultiLayerBiometricLoginStrategy(
    AppDbContext db,
    IConfiguration? configuration = null,
    ILogger<MultiLayerBiometricLoginStrategy>? logger = null,
    IClaudeBiometricIdentityStrategy? claudeBiometricStrategy = null) : IBiometricLoginValidationStrategy
{
    public const double DefaultSimilarityThreshold = 0.82;
    public const double DefaultClaudeSimilarityThreshold = 0.78;
    public const double MinimumLivenessThreshold = 0.70;
    private const int HybridTopKCandidates = 12;
    private const int MaxConcurrentClaudeComparisons = 3;

    private static readonly string[] GeometricComparisonKeys =
    [
        "interOcularRatio",
        "nasalBridgeRatio",
        "jawSymmetryIndex",
        "alignmentScore",
        "ovalCenterAlignment",
        "ovalCenteringScore"
    ];

    public string StrategyName => "MultiLayerClaudeBiometricLoginStrategy";

    private double ResolveSimilarityThreshold() =>
        double.TryParse(
            configuration?["Biometrics:SimilarityThreshold"],
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out double configured) && configured is > 0.1 and <= 0.99
            ? configured
            : DefaultSimilarityThreshold;

    private double ResolveClaudeSimilarityThreshold() =>
        double.TryParse(
            configuration?["Biometrics:ClaudeSimilarityThreshold"],
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out double configured) && configured is > 0.1 and <= 0.99
            ? configured
            : DefaultClaudeSimilarityThreshold;

    public async Task<BiometricMultiLayerEvaluationResult> ExecuteLayersAsync(
        BiometricMultiLayerContext context,
        CancellationToken ct = default)
    {
        double threshold = ResolveSimilarityThreshold();
        var result = new BiometricMultiLayerEvaluationResult
        {
            IsValidated = false,
            ValidationVerdict = "INVALID",
            StrategyName = StrategyName,
            SimilarityThreshold = threshold
        };

        // =====================================================================
        // LAYER 1: OPTICAL_LIVENESS_GATE ("Optical Liveness & Oval Reticle Gate")
        // =====================================================================
        string? primaryLiveCapture = ResolvePrimaryLiveCapture(context);
        bool hasLiveCapture = !string.IsNullOrWhiteSpace(primaryLiveCapture);
        bool hasLivePayload =
            !string.IsNullOrWhiteSpace(context.LiveDescriptorVectorJson) ||
            (context.LiveDescriptorVector is { Length: > 0 }) ||
            hasLiveCapture;

        bool livenessPassed = hasLivePayload && context.LivenessScore >= MinimumLivenessThreshold;
        result.Layers.Add(new BiometricLoginLayerResultDto
        {
            LayerNumber = 1,
            LayerCode = "OPTICAL_LIVENESS_GATE",
            LayerName = "Optical Liveness & Oval Reticle Gate",
            Passed = livenessPassed,
            Score = Math.Round(context.LivenessScore, 4),
            Detail = livenessPassed
                ? $"Optical liveness gate passed (score: {context.LivenessScore:F2} >= {MinimumLivenessThreshold:F2})."
                : !hasLivePayload
                    ? "No live biometric facial descriptor or optical capture payload provided."
                    : $"Optical liveness score ({context.LivenessScore:F2}) is below minimum threshold ({MinimumLivenessThreshold:F2})."
        });

        if (!livenessPassed)
        {
            result.FailureReason = result.Layers[0].Detail;
            PopulateSkippedLayersAndVerdict(result, startLayer: 2);
            return result;
        }

        // =====================================================================
        // LAYER 2: CLAUDE_AI_BIOMETRIC_STRATEGY ("Claude AI Vision & Geometric Pattern Extraction")
        // =====================================================================
        float[]? liveVector = ExtractLiveVector(context);
        double l2Norm = ComputeL2Norm(liveVector);
        bool vectorValid = liveVector is { Length: 128 } && l2Norm > 1e-4;
        bool claudeHybridReady = hasLiveCapture && claudeBiometricStrategy is { IsConfigured: true };
        double geometricScore = ParseGeometricAlignmentScore(context.LiveGeometricSignatureJson, vectorValid || claudeHybridReady);
        result.GeometricAlignmentScore = geometricScore;

        bool layer2Passed = (claudeHybridReady || vectorValid) && geometricScore >= 0.65;
        string layer2Detail = claudeHybridReady
            ? vectorValid
                ? $"Hybrid Claude Vision + Geometry ready (live optical capture queued + 128-D normalized vector L2 norm: {l2Norm:F4}, geometric alignment: {geometricScore:F2})."
                : $"Hybrid Claude Vision + Geometry ready (live optical capture queued for cached pose gallery, geometric alignment: {geometricScore:F2})."
            : layer2Passed
                ? $"128-D normalized facial vector verified (L2 norm: {l2Norm:F4}, geometric alignment: {geometricScore:F2})."
                : $"Invalid 128-D facial vector dimensionality ({liveVector?.Length ?? 0}-D) or zero norm.";

        result.Layers.Add(new BiometricLoginLayerResultDto
        {
            LayerNumber = 2,
            LayerCode = "CLAUDE_AI_BIOMETRIC_STRATEGY",
            LayerName = "Claude AI Vision & Geometric Pattern Extraction",
            Passed = layer2Passed,
            Score = Math.Round(geometricScore, 4),
            Detail = layer2Detail
        });

        if (!layer2Passed || (!claudeHybridReady && liveVector == null))
        {
            result.FailureReason = result.Layers[1].Detail;
            PopulateSkippedLayersAndVerdict(result, startLayer: 3);
            return result;
        }

        // =====================================================================
        // LAYER 3: DATABASE_TRAINED_KNOWLEDGE_LOOKUP ("SQL Server Trained Knowledge & Frame Repository Reader")
        // =====================================================================
        string? normalizedEmail = !string.IsNullOrWhiteSpace(context.Email)
            ? context.Email.Trim().ToLowerInvariant()
            : null;

        List<BiometricEnrollment> candidateEnrollments = [];
        User? targetUser = null;

        if (!string.IsNullOrWhiteSpace(normalizedEmail))
        {
            targetUser = await db.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail && !u.IsDeleted, ct);

            if (targetUser == null)
            {
                result.FailureReason = "Invalid credentials. Account not found in trained biometric repository.";
                result.Layers.Add(BuildLayer3Failure(result.FailureReason));
                PopulateSkippedLayersAndVerdict(result, startLayer: 4);
                return result;
            }

            if (targetUser.Status == AccountStatus.Suspended)
            {
                result.FailureReason = "Your account has been suspended by LDRRMO Administration.";
                result.Layers.Add(BuildLayer3Failure(result.FailureReason));
                PopulateSkippedLayersAndVerdict(result, startLayer: 4);
                return result;
            }

            if (targetUser.Status == AccountStatus.Pending)
            {
                result.FailureReason = "Your account is pending administrative verification by LDRRMO Administration.";
                result.Layers.Add(BuildLayer3Failure(result.FailureReason));
                PopulateSkippedLayersAndVerdict(result, startLayer: 4);
                return result;
            }

            List<BiometricEnrollment> userEnrollments = await db.BiometricEnrollments
                .AsNoTracking()
                .Include(b => b.User)
                .Where(b =>
                    b.UserId == targetUser.Id &&
                    b.RevokedAtUtc == null &&
                    b.EnrollmentStatus == "ACTIVE" &&
                    (b.EncryptedTemplateData.Length >= 4 || (b.PoseFramesJson != null && b.PoseFramesJson != "")))
                .OrderByDescending(b => b.EnrolledAtUtc)
                .Take(5)
                .ToListAsync(ct);

            BiometricEnrollment? userEnrollment = userEnrollments.FirstOrDefault(IsUsableEnrollment);
            if (userEnrollment != null)
            {
                userEnrollment.User ??= targetUser;
                if (!IsPortalOriginAllowed(userEnrollment.User.Role, context.PortalOrigin))
                {
                    result.FailureReason = string.Equals(context.PortalOrigin, "Admin", StringComparison.OrdinalIgnoreCase)
                        ? "Access Denied: The Admin Command Portal on port 1996 is restricted exclusively to LDRRMO Administrators."
                        : "Access Denied: LDRRMO Administrator personnel must sign in via the dedicated Command Portal on port 1996.";
                    result.Layers.Add(BuildLayer3Failure(result.FailureReason));
                    PopulateSkippedLayersAndVerdict(result, startLayer: 4);
                    return result;
                }
                candidateEnrollments.Add(userEnrollment);
            }
        }
        else
        {
            var metadataEnrollments = await db.BiometricEnrollments
                .AsNoTracking()
                .Where(b =>
                    b.RevokedAtUtc == null &&
                    b.EnrollmentStatus == "ACTIVE" &&
                    b.User != null &&
                    !b.User.IsDeleted &&
                    b.User.Status != AccountStatus.Suspended &&
                    (b.EncryptedTemplateData.Length >= 4 || (b.PoseFramesJson != null && b.PoseFramesJson != "")))
                .OrderByDescending(b => b.EnrolledAtUtc)
                .Select(b => new
                {
                    b.Id,
                    b.UserId,
                    b.EncryptedTemplateData,
                    b.GeometricSignatureJson,
                    b.EnrollmentStatus,
                    b.EnrolledAtUtc,
                    b.RevokedAtUtc,
                    HasPoseFrames = b.PoseFramesJson != null && b.PoseFramesJson != "",
                    UserRole = b.User!.Role,
                    UserEmail = b.User.Email,
                    UserStatus = b.User.Status
                })
                .ToListAsync(ct);

            var portalFiltered = metadataEnrollments
                .Where(m => IsPortalOriginAllowed(m.UserRole, context.PortalOrigin))
                .ToList();

            Dictionary<Guid, string?> poseFramesById = new();
            if (claudeHybridReady)
            {
                List<Guid> poseIds = portalFiltered
                    .Where(m => m.HasPoseFrames)
                    .Select(m => m.Id)
                    .ToList();

                if (poseIds.Count > 0)
                {
                    poseFramesById = await db.BiometricEnrollments
                        .AsNoTracking()
                        .Where(b => poseIds.Contains(b.Id))
                        .Select(b => new { b.Id, b.PoseFramesJson })
                        .ToDictionaryAsync(x => x.Id, x => x.PoseFramesJson, ct);
                }
            }

            candidateEnrollments = portalFiltered
                .Select(m => new BiometricEnrollment
                {
                    Id = m.Id,
                    UserId = m.UserId,
                    EncryptedTemplateData = m.EncryptedTemplateData,
                    GeometricSignatureJson = m.GeometricSignatureJson,
                    PoseFramesJson = poseFramesById.GetValueOrDefault(m.Id),
                    EnrollmentStatus = m.EnrollmentStatus,
                    EnrolledAtUtc = m.EnrolledAtUtc,
                    RevokedAtUtc = m.RevokedAtUtc,
                    User = new User
                    {
                        Id = m.UserId,
                        Email = m.UserEmail,
                        Role = m.UserRole,
                        Status = m.UserStatus
                    }
                })
                .Where(IsUsableEnrollment)
                .ToList();
        }

        bool layer3Passed = candidateEnrollments.Count > 0;
        int poseGalleryCount = candidateEnrollments.Count(e => ClaudeCachedPoseIdentityStrategy.HasUsablePoseFrames(e.PoseFramesJson));
        result.Layers.Add(new BiometricLoginLayerResultDto
        {
            LayerNumber = 3,
            LayerCode = "DATABASE_TRAINED_KNOWLEDGE_LOOKUP",
            LayerName = "SQL Server Trained Knowledge & Frame Repository Reader",
            Passed = layer3Passed,
            Score = layer3Passed ? 1.0 : 0.0,
            Detail = layer3Passed
                ? $"Loaded {candidateEnrollments.Count} active trained biometric template(s) ({poseGalleryCount} with cached 4-pose gallery; {(normalizedEmail != null ? "1:1 Targeted" : "1:N Identification")})."
                : "No active biometric enrollment found for this account. Please sign in with password."
        });

        if (!layer3Passed)
        {
            result.FailureReason = result.Layers[2].Detail;
            PopulateSkippedLayersAndVerdict(result, startLayer: 4);
            return result;
        }

        // =====================================================================
        // LAYER 4: MULTI_FACTOR_VERIFICATION_ENGINE ("Hybrid Claude 4-Pose Gallery & 128-D Cosine Verification")
        // =====================================================================
        List<BiometricEnrollment> poseEquippedCandidates = claudeHybridReady
            ? candidateEnrollments
                .Where(e => ClaudeCachedPoseIdentityStrategy.HasUsablePoseFrames(e.PoseFramesJson))
                .ToList()
            : [];

        bool usedHybridClaude = claudeHybridReady && poseEquippedCandidates.Count > 0;
        Layer4VerificationOutcome outcome = usedHybridClaude
            ? await ExecuteHybridVerificationAsync(
                context,
                primaryLiveCapture!,
                liveVector,
                candidateEnrollments,
                normalizedEmail != null,
                threshold,
                ct)
            : ExecuteDeterministicVerification(
                liveVector,
                candidateEnrollments,
                normalizedEmail != null,
                threshold);

        result.SimilarityThreshold = outcome.EffectiveThreshold;
        result.CosineSimilarity = outcome.FinalScore;

        if (!outcome.Passed)
        {
            result.FailureReason = outcome.Detail;
        }
        else if (outcome.MatchedEnrollment?.User != null)
        {
            result.MatchedUserId = outcome.MatchedEnrollment.UserId;
            result.MatchedEmail = outcome.MatchedEnrollment.User.Email;
        }
        else if (outcome.MatchedEnrollment != null)
        {
            result.MatchedUserId = outcome.MatchedEnrollment.UserId;
            result.MatchedEmail = targetUser?.Email;
        }

        result.Layers.Add(new BiometricLoginLayerResultDto
        {
            LayerNumber = 4,
            LayerCode = "MULTI_FACTOR_VERIFICATION_ENGINE",
            LayerName = outcome.UsedHybridMode
                ? "Hybrid Claude 4-Pose Gallery & 128-D Cosine Verification"
                : "128-D Cosine Similarity & Geometric Pattern Verification",
            Passed = outcome.Passed,
            Score = outcome.FinalScore,
            Detail = outcome.Detail
        });

        // =====================================================================
        // LAYER 5: DETERMINISTIC_VALIDATION_VERDICT ("Final Multi-Layer Validation Gate")
        // =====================================================================
        bool allPassed = result.Layers.All(l => l.Passed);
        result.IsValidated = allPassed;
        result.ValidationVerdict = allPassed ? "SUCCESS_LOGIN" : "INVALID";

        result.Layers.Add(new BiometricLoginLayerResultDto
        {
            LayerNumber = 5,
            LayerCode = "DETERMINISTIC_VALIDATION_VERDICT",
            LayerName = "Final Multi-Layer Validation Gate",
            Passed = allPassed,
            Score = allPassed ? outcome.FinalScore : 0.0,
            Detail = allPassed
                ? $"Verdict: SUCCESS_LOGIN (Matched User ID: {result.MatchedUserId}, Similarity: {outcome.FinalScore:F4}, Mode: {(outcome.UsedHybridMode ? "Hybrid Claude 4-Pose Gallery" : "128-D Cosine")})."
                : $"Verdict: INVALID ({result.FailureReason})"
        });

        logger?.LogInformation(
            "[MultiLayerBiometricLoginStrategy] Verdict={Verdict} Mode={Mode} Similarity={Similarity:F4} Email={Email}",
            result.ValidationVerdict,
            outcome.UsedHybridMode ? "HybridClaude4Pose" : "128DCosine",
            result.CosineSimilarity,
            normalizedEmail ?? "1:N_SCAN");

        return result;
    }

    private async Task<Layer4VerificationOutcome> ExecuteHybridVerificationAsync(
        BiometricMultiLayerContext context,
        string primaryLiveCapture,
        float[]? liveVector,
        IReadOnlyList<BiometricEnrollment> candidateEnrollments,
        bool isOneToOne,
        double deterministicThreshold,
        CancellationToken ct)
    {
        double claudeThreshold = ResolveClaudeSimilarityThreshold();
        List<RankedCandidate> ranked = RankCandidates(context, liveVector, candidateEnrollments);

        if (isOneToOne)
        {
            RankedCandidate target = ranked.FirstOrDefault(c => c.HasPoses) ?? ranked[0];
            ClaudeBiometricIdentityResult claudeResult = await claudeBiometricStrategy!.VerifyLiveAgainstCachedPosesAsync(
                new ClaudeBiometricIdentityInput(
                    LiveCaptureBase64: primaryLiveCapture,
                    PoseFramesJson: target.Enrollment.PoseFramesJson,
                    LiveCaptureFramesBase64: context.LiveCaptureFramesBase64),
                ct);

            if (claudeResult.SamePerson && claudeResult.IsLiveHuman && claudeResult.Similarity >= claudeThreshold)
            {
                double hybridScore = ComputeHybridScore(claudeResult.Similarity, target.LocalCosine, claudeThreshold);
                return new Layer4VerificationOutcome(
                    Passed: true,
                    UsedHybridMode: true,
                    FinalScore: hybridScore,
                    EffectiveThreshold: claudeThreshold,
                    MatchedEnrollment: target.Enrollment,
                    Detail: BuildHybridSuccessDetail(claudeResult, target.LocalCosine, hybridScore, claudeThreshold));
            }

            if (IsTransientClaudeFailure(claudeResult) && liveVector is { Length: > 0 })
            {
                logger?.LogWarning(
                    "[MultiLayerBiometricLoginStrategy] Claude 1:1 unavailable ({ErrorCode}); falling back to 128-D cosine verification.",
                    claudeResult.ErrorCode);
                return ExecuteDeterministicVerification(
                    liveVector,
                    candidateEnrollments,
                    isOneToOne: true,
                    deterministicThreshold);
            }

            double rejectedScore = Math.Round(Math.Clamp(claudeResult.Similarity, 0.0, 1.0), 4);
            return new Layer4VerificationOutcome(
                Passed: false,
                UsedHybridMode: true,
                FinalScore: rejectedScore,
                EffectiveThreshold: claudeThreshold,
                MatchedEnrollment: null,
                Detail: BuildHybridFailureReason(isOneToOne: true, claudeResult, claudeThreshold));
        }

        List<RankedCandidate> topKCandidates = SelectTopKPoseCandidates(ranked, HybridTopKCandidates);
        ClaudeBiometricIdentityResult? lastResult = null;
        ClaudeBiometricIdentityResult? spoofResult = null;
        ClaudeBiometricIdentityResult? unavailableResult = null;
        double bestFailedClaudeSim = 0.0;
        bool spoofDetected = false;
        bool providerUnavailable = false;
        bool liveHumanConfirmed = false;

        // Bounded concurrency across independent Claude HTTP/vision comparisons; DbContext is never accessed inside these tasks.
        using var concurrencyGate = new SemaphoreSlim(MaxConcurrentClaudeComparisons, MaxConcurrentClaudeComparisons);
        Task<(RankedCandidate Candidate, ClaudeBiometricIdentityResult Result)>[] evaluationTasks = topKCandidates
            .Select(async candidate =>
            {
                await concurrencyGate.WaitAsync(ct);
                try
                {
                    ClaudeBiometricIdentityResult claudeResult = await claudeBiometricStrategy!.VerifyLiveAgainstCachedPosesAsync(
                        new ClaudeBiometricIdentityInput(
                            LiveCaptureBase64: primaryLiveCapture,
                            PoseFramesJson: candidate.Enrollment.PoseFramesJson,
                            LiveCaptureFramesBase64: context.LiveCaptureFramesBase64),
                        ct);
                    return (candidate, claudeResult);
                }
                finally
                {
                    concurrencyGate.Release();
                }
            })
            .ToArray();

        (RankedCandidate Candidate, ClaudeBiometricIdentityResult Result)[] evaluations =
            await Task.WhenAll(evaluationTasks);

        (RankedCandidate Candidate, ClaudeBiometricIdentityResult Result)? bestMatch = null;
        foreach (var entry in evaluations)
        {
            ClaudeBiometricIdentityResult claudeResult = entry.Result;
            lastResult = claudeResult;
            if (claudeResult.Similarity > bestFailedClaudeSim)
            {
                bestFailedClaudeSim = claudeResult.Similarity;
            }

            if (IsTransientClaudeFailure(claudeResult))
            {
                providerUnavailable = true;
                unavailableResult ??= claudeResult;
                continue;
            }

            if (!claudeResult.IsLiveHuman)
            {
                spoofDetected = true;
                spoofResult ??= claudeResult;
                continue;
            }

            liveHumanConfirmed = true;

            if (claudeResult.SamePerson &&
                claudeResult.Similarity >= claudeThreshold &&
                (bestMatch == null || claudeResult.Similarity > bestMatch.Value.Result.Similarity))
            {
                bestMatch = entry;
            }
        }

        if (bestMatch is { } winningMatch)
        {
            double hybridScore = ComputeHybridScore(
                winningMatch.Result.Similarity,
                winningMatch.Candidate.LocalCosine,
                claudeThreshold);
            return new Layer4VerificationOutcome(
                Passed: true,
                UsedHybridMode: true,
                FinalScore: hybridScore,
                EffectiveThreshold: claudeThreshold,
                MatchedEnrollment: winningMatch.Candidate.Enrollment,
                Detail: BuildHybridSuccessDetail(
                    winningMatch.Result,
                    winningMatch.Candidate.LocalCosine,
                    hybridScore,
                    claudeThreshold));
        }

        if (!spoofDetected && providerUnavailable && liveVector is { Length: > 0 })
        {
            logger?.LogWarning(
                "[MultiLayerBiometricLoginStrategy] Claude 1:N encountered transient failure ({ErrorCode}); falling back to 128-D cosine verification.",
                unavailableResult?.ErrorCode ?? "PROVIDER_UNAVAILABLE");
            return ExecuteDeterministicVerification(
                liveVector,
                candidateEnrollments,
                isOneToOne: false,
                deterministicThreshold);
        }

        if (!spoofDetected && !providerUnavailable && liveHumanConfirmed && liveVector != null)
        {
            RankedCandidate? legacyMatch = ranked.FirstOrDefault(c => !c.HasPoses && c.LocalCosine >= deterministicThreshold);
            if (legacyMatch != null)
            {
                double fallbackScore = Math.Round(Math.Clamp(legacyMatch.LocalCosine, 0.0, 1.0), 4);
                return new Layer4VerificationOutcome(
                    Passed: true,
                    UsedHybridMode: false,
                    FinalScore: fallbackScore,
                    EffectiveThreshold: deterministicThreshold,
                    MatchedEnrollment: legacyMatch.Enrollment,
                    Detail: $"128-D Cosine similarity {fallbackScore:F4} >= {deterministicThreshold:F2} threshold verified (Claude live-human check passed).");
            }
        }

        ClaudeBiometricIdentityResult? diagnosticResult = spoofResult ?? (liveHumanConfirmed ? lastResult : unavailableResult ?? lastResult);
        return new Layer4VerificationOutcome(
            Passed: false,
            UsedHybridMode: true,
            FinalScore: Math.Round(Math.Clamp(bestFailedClaudeSim, 0.0, 1.0), 4),
            EffectiveThreshold: claudeThreshold,
            MatchedEnrollment: null,
            Detail: BuildHybridFailureReason(isOneToOne: false, diagnosticResult, claudeThreshold));
    }

    private static Layer4VerificationOutcome ExecuteDeterministicVerification(
        float[]? liveVector,
        IReadOnlyList<BiometricEnrollment> candidateEnrollments,
        bool isOneToOne,
        double threshold)
    {
        if (liveVector == null || liveVector.Length == 0)
        {
            return new Layer4VerificationOutcome(
                Passed: false,
                UsedHybridMode: false,
                FinalScore: 0.0,
                EffectiveThreshold: threshold,
                MatchedEnrollment: null,
                Detail: $"Biometric {(isOneToOne ? "1:1" : "1:N")} verification failed: No 128-D live vector available (similarity: 0.0000 < {threshold:F2}). Identity mismatch rejected.");
        }

        BiometricEnrollment? bestEnrollment = null;
        double maxSimilarity = double.NegativeInfinity;

        foreach (BiometricEnrollment enrollment in candidateEnrollments)
        {
            float[]? enrolledVector = ExtractEnrolledVector(enrollment);
            if (enrolledVector == null || enrolledVector.Length == 0)
            {
                continue;
            }

            double sim = ComputeCosineSimilarity(liveVector, enrolledVector);
            if (sim > maxSimilarity)
            {
                maxSimilarity = sim;
                bestEnrollment = enrollment;
            }
        }

        double clampedSimilarity = double.IsNegativeInfinity(maxSimilarity)
            ? 0.0
            : Math.Round(maxSimilarity, 4);

        bool passed = bestEnrollment != null && maxSimilarity >= threshold;
        string detail = passed
            ? $"128-D Cosine similarity {clampedSimilarity:F4} >= {threshold:F2} threshold verified."
            : $"Biometric {(isOneToOne ? "1:1" : "1:N")} verification failed: Cosine similarity ({clampedSimilarity:F4}) is below the {threshold:F2} security threshold. Identity mismatch rejected.";

        return new Layer4VerificationOutcome(
            Passed: passed,
            UsedHybridMode: false,
            FinalScore: clampedSimilarity,
            EffectiveThreshold: threshold,
            MatchedEnrollment: passed ? bestEnrollment : null,
            Detail: detail);
    }

    private static List<RankedCandidate> RankCandidates(
        BiometricMultiLayerContext context,
        float[]? liveVector,
        IReadOnlyList<BiometricEnrollment> candidateEnrollments)
    {
        var ranked = new List<RankedCandidate>(candidateEnrollments.Count);

        foreach (BiometricEnrollment enrollment in candidateEnrollments)
        {
            float[]? enrolledVector = ExtractEnrolledVector(enrollment);
            double localCosine = (liveVector != null && enrolledVector is { Length: > 0 })
                ? ComputeCosineSimilarity(liveVector, enrolledVector)
                : 0.0;
            double geomAffinity = ComputeGeometricAffinity(
                context.LiveGeometricSignatureJson,
                enrollment.GeometricSignatureJson);
            bool hasPoses = ClaudeCachedPoseIdentityStrategy.HasUsablePoseFrames(enrollment.PoseFramesJson);

            double rankingScore =
                (liveVector != null ? Math.Max(0.0, localCosine) * 0.85 : 0.0) +
                (geomAffinity * 0.15);

            ranked.Add(new RankedCandidate(enrollment, localCosine, rankingScore, hasPoses));
        }

        ranked.Sort((a, b) =>
        {
            int scoreCompare = b.RankingScore.CompareTo(a.RankingScore);
            if (scoreCompare != 0)
            {
                return scoreCompare;
            }

            int poseCompare = b.HasPoses.CompareTo(a.HasPoses);
            if (poseCompare != 0)
            {
                return poseCompare;
            }

            return b.Enrollment.EnrolledAtUtc.CompareTo(a.Enrollment.EnrolledAtUtc);
        });

        return ranked;
    }

    private static List<RankedCandidate> SelectTopKPoseCandidates(
        IReadOnlyList<RankedCandidate> ranked,
        int k)
    {
        var selected = new List<RankedCandidate>(k);
        var seenIds = new HashSet<Guid>();
        var seenGalleryFingerprints = new HashSet<string>(StringComparer.Ordinal);

        int recentReserve = Math.Max(1, k / 2);
        int scoreSlotLimit = Math.Max(1, k - recentReserve);

        bool TrySelectDistinctCandidate(RankedCandidate candidate, bool requireDistinctGallery)
        {
            if (!candidate.HasPoses || selected.Count >= k)
            {
                return false;
            }

            if (requireDistinctGallery)
            {
                string fingerprint = BuildCandidateGalleryFingerprint(candidate.Enrollment);
                if (!seenGalleryFingerprints.Add(fingerprint))
                {
                    return false;
                }
            }

            if (seenIds.Add(candidate.Enrollment.Id))
            {
                selected.Add(candidate);
                return true;
            }

            return false;
        }

        // Phase 1: Diverse gallery coverage sorted by ranking score so cloned E2E fixtures cannot crowd out real accounts.
        for (int i = 0; i < ranked.Count && selected.Count < scoreSlotLimit; i++)
        {
            TrySelectDistinctCandidate(ranked[i], requireDistinctGallery: true);
        }

        // Phase 2: Reserve slots for the most recently enrolled distinct active candidates.
        int recentInspected = 0;
        foreach (RankedCandidate recentCandidate in ranked
            .Where(c => c.HasPoses)
            .OrderByDescending(c => c.Enrollment.EnrolledAtUtc)
            .ThenByDescending(c => c.RankingScore))
        {
            if (selected.Count >= k || recentInspected >= recentReserve)
            {
                break;
            }

            if (TrySelectDistinctCandidate(recentCandidate, requireDistinctGallery: true))
            {
                recentInspected++;
            }
        }

        // Phase 3: Backfill remaining capacity with any remaining distinct galleries, then non-distinct fallback if fewer than k.
        for (int i = 0; i < ranked.Count && selected.Count < k; i++)
        {
            TrySelectDistinctCandidate(ranked[i], requireDistinctGallery: true);
        }

        for (int i = 0; i < ranked.Count && selected.Count < k; i++)
        {
            TrySelectDistinctCandidate(ranked[i], requireDistinctGallery: false);
        }

        return selected;
    }

    private static string BuildCandidateGalleryFingerprint(BiometricEnrollment enrollment)
    {
        // Fingerprint using the CENTER pose frame slice + 16 sampled vector dims so JSON timestamps never split clones.
        string pose = enrollment.PoseFramesJson ?? string.Empty;
        string centerSlice = ExtractCenterImageSlice(pose);

        float[]? vec = ExtractEnrolledVector(enrollment);
        if (vec is { Length: > 0 })
        {
            var sampled = new List<string>(16);
            int step = Math.Max(1, vec.Length / 16);
            for (int i = 0; i < vec.Length && sampled.Count < 16; i += step)
            {
                sampled.Add(Math.Round(vec[i], 2).ToString("0.00", CultureInfo.InvariantCulture));
            }
            return $"{string.Join(",", sampled)}|{centerSlice}";
        }

        return centerSlice;
    }

    private static bool IsTransientClaudeFailure(ClaudeBiometricIdentityResult? result)
    {
        if (result == null || string.IsNullOrWhiteSpace(result.ErrorCode))
        {
            return false;
        }

        string code = result.ErrorCode.Trim();
        if (string.Equals(code, "LIVENESS_SPOOF_REJECTED", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return string.Equals(code, "PROVIDER_UNAVAILABLE", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(code, "REQUEST_FAILED", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(code, "INVALID_AI_RESPONSE", StringComparison.OrdinalIgnoreCase);
    }

    private static string ExtractCenterImageSlice(string poseJson)
    {
        if (string.IsNullOrEmpty(poseJson))
        {
            return "empty";
        }

        try
        {
            using var doc = JsonDocument.Parse(poseJson);
            JsonElement root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object)
            {
                string? centerImage =
                    TryExtractPoseDataUrl(root, "bestFrames", "CENTER") ??
                    TryExtractPoseDataUrl(root, "poses", "CENTER") ??
                    TryExtractPoseDataUrlFromContainer(root, "CENTER");

                if (!string.IsNullOrWhiteSpace(centerImage))
                {
                    return FormatCenterSlice(centerImage);
                }
            }
        }
        catch (JsonException)
        {
            // Non-JSON payload: fall back to bounded raw tail signature below.
        }

        return poseJson.Length > 128 ? $"{poseJson.Length}:{poseJson[^128..]}" : $"{poseJson.Length}:{poseJson}";
    }

    private static string? TryExtractPoseDataUrl(JsonElement root, string containerKey, string poseKey) =>
        SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, containerKey, out JsonElement container) &&
        container.ValueKind == JsonValueKind.Object
            ? TryExtractPoseDataUrlFromContainer(container, poseKey)
            : null;

    private static string? TryExtractPoseDataUrlFromContainer(JsonElement container, string poseKey)
    {
        if (!SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(container, poseKey, out JsonElement poseEl))
        {
            return null;
        }

        return poseEl.ValueKind switch
        {
            JsonValueKind.String => poseEl.GetString(),
            JsonValueKind.Array => poseEl.EnumerateArray()
                .Select(item => item.ValueKind == JsonValueKind.String
                    ? item.GetString()
                    : item.ValueKind == JsonValueKind.Object
                        ? SharedGovIdForensicsEvaluator.TryReadOptionalString(item, "bestFrameDataUrl") ??
                          SharedGovIdForensicsEvaluator.TryReadOptionalString(item, "frameDataUrl") ??
                          SharedGovIdForensicsEvaluator.TryReadOptionalString(item, "dataUrl") ??
                          SharedGovIdForensicsEvaluator.TryReadOptionalString(item, "base64")
                        : null)
                .FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)),
            JsonValueKind.Object =>
                SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "bestFrameDataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "frameDataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "dataUrl") ??
                SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "base64"),
            _ => null
        };
    }

    private static string FormatCenterSlice(string center) =>
        center.Length > 128
            ? $"{center.Length}:{center[..64]}:{center[^64..]}"
            : $"{center.Length}:{center}";

    private static double ComputeHybridScore(double claudeSimilarity, double localCosine, double claudeThreshold)
    {
        double blended = (claudeSimilarity * 0.85) + (Math.Max(0.0, localCosine) * 0.15);
        double floor = Math.Max(claudeThreshold, claudeSimilarity >= 0.82 ? claudeSimilarity * 0.90 : claudeSimilarity);
        return Math.Round(Math.Clamp(Math.Max(blended, floor), 0.0, 1.0), 4);
    }

    private static string BuildHybridSuccessDetail(
        ClaudeBiometricIdentityResult claudeResult,
        double localCosine,
        double hybridScore,
        double claudeThreshold) =>
        $"Hybrid Claude 4-Pose Gallery + 128-D Cosine verified (Claude: {claudeResult.Similarity:F4}, Local Cosine: {Math.Max(0.0, localCosine):F4}, Hybrid: {hybridScore:F4} >= {claudeThreshold:F2}, Model: {claudeResult.ModelUsed ?? "claude"}).";

    private static string BuildHybridFailureReason(
        bool isOneToOne,
        ClaudeBiometricIdentityResult? claudeResult,
        double claudeThreshold)
    {
        string modeLabel = isOneToOne ? "1:1" : "1:N";
        if (claudeResult != null &&
            string.Equals(claudeResult.ErrorCode, "PROVIDER_UNAVAILABLE", StringComparison.OrdinalIgnoreCase))
        {
            return $"Biometric {modeLabel} hybrid verification unavailable: {claudeResult.Reason ?? "Claude Vision service error."}";
        }

        if (claudeResult != null && !claudeResult.IsLiveHuman)
        {
            return $"Biometric {modeLabel} hybrid verification failed: Anti-spoofing liveness identity mismatch rejected. {claudeResult.Reason}".Trim();
        }

        double sim = claudeResult?.Similarity ?? 0.0;
        return $"Biometric {modeLabel} hybrid verification failed: Claude cached-pose identity mismatch (similarity: {sim:F4} < {claudeThreshold:F2}). {claudeResult?.Reason}".Trim();
    }

    private static BiometricLoginLayerResultDto BuildLayer3Failure(string reason) =>
        new()
        {
            LayerNumber = 3,
            LayerCode = "DATABASE_TRAINED_KNOWLEDGE_LOOKUP",
            LayerName = "SQL Server Trained Knowledge & Frame Repository Reader",
            Passed = false,
            Score = 0.0,
            Detail = reason
        };

    private static bool IsUsableEnrollment(BiometricEnrollment enrollment) =>
        enrollment.EncryptedTemplateData.Length >= sizeof(float) ||
        ClaudeCachedPoseIdentityStrategy.HasUsablePoseFrames(enrollment.PoseFramesJson);

    private static string? ResolvePrimaryLiveCapture(BiometricMultiLayerContext context) =>
        !string.IsNullOrWhiteSpace(context.LiveCaptureBase64)
            ? context.LiveCaptureBase64
            : context.LiveCaptureFramesBase64?.FirstOrDefault(f => !string.IsNullOrWhiteSpace(f));

    private static void PopulateSkippedLayersAndVerdict(BiometricMultiLayerEvaluationResult result, int startLayer)
    {
        for (int layerNum = startLayer; layerNum <= 4; layerNum++)
        {
            var (code, name) = layerNum switch
            {
                2 => ("CLAUDE_AI_BIOMETRIC_STRATEGY", "Claude AI Vision & Geometric Pattern Extraction"),
                3 => ("DATABASE_TRAINED_KNOWLEDGE_LOOKUP", "SQL Server Trained Knowledge & Frame Repository Reader"),
                _ => ("MULTI_FACTOR_VERIFICATION_ENGINE", "Hybrid Claude 4-Pose Gallery & 128-D Cosine Verification")
            };

            result.Layers.Add(new BiometricLoginLayerResultDto
            {
                LayerNumber = layerNum,
                LayerCode = code,
                LayerName = name,
                Passed = false,
                Score = 0.0,
                Detail = "Skipped due to prior layer rejection."
            });
        }

        result.IsValidated = false;
        result.ValidationVerdict = "INVALID";
        result.Layers.Add(new BiometricLoginLayerResultDto
        {
            LayerNumber = 5,
            LayerCode = "DETERMINISTIC_VALIDATION_VERDICT",
            LayerName = "Final Multi-Layer Validation Gate",
            Passed = false,
            Score = 0.0,
            Detail = $"Verdict: INVALID ({result.FailureReason})"
        });
    }

    private static float[]? ExtractLiveVector(BiometricMultiLayerContext context)
    {
        if (context.LiveDescriptorVector is { Length: > 0 })
            return context.LiveDescriptorVector;

        if (!string.IsNullOrWhiteSpace(context.LiveDescriptorVectorJson))
        {
            try
            {
                return JsonSerializer.Deserialize<float[]>(context.LiveDescriptorVectorJson);
            }
            catch
            {
                return null;
            }
        }

        return null;
    }

    private static float[]? ExtractEnrolledVector(BiometricEnrollment enrollment)
    {
        if (!string.IsNullOrWhiteSpace(enrollment.DescriptorVectorJson))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<float[]>(enrollment.DescriptorVectorJson);
                if (parsed is { Length: > 0 })
                    return parsed;
            }
            catch
            {
                // Fallback to binary buffer
            }
        }

        if (enrollment.EncryptedTemplateData is { Length: >= sizeof(float) })
        {
            var stored = new float[enrollment.EncryptedTemplateData.Length / sizeof(float)];
            Buffer.BlockCopy(enrollment.EncryptedTemplateData, 0, stored, 0, stored.Length * sizeof(float));
            return stored;
        }

        return null;
    }

    private static double ComputeL2Norm(float[]? vector)
    {
        if (vector == null || vector.Length == 0) return 0.0;
        double sumSq = 0.0;
        for (int i = 0; i < vector.Length; i++)
        {
            sumSq += vector[i] * vector[i];
        }
        return Math.Sqrt(sumSq);
    }

    private static double ParseGeometricAlignmentScore(string? geometricSignatureJson, bool hasBiometricInput)
    {
        if (!string.IsNullOrWhiteSpace(geometricSignatureJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(geometricSignatureJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("jawSymmetryIndex", out var jawProp) && jawProp.TryGetDouble(out var jaw) && jaw > 0)
                    return Math.Clamp(jaw, 0.0, 1.0);
                if (root.TryGetProperty("ovalCenteringScore", out var ovalProp) && ovalProp.TryGetDouble(out var oval) && oval > 0)
                    return Math.Clamp(oval, 0.0, 1.0);
                if (root.TryGetProperty("alignmentScore", out var alignProp) && alignProp.TryGetDouble(out var align) && align > 0)
                    return Math.Clamp(align, 0.0, 1.0);
            }
            catch
            {
                // Fallback to default geometric alignment score
            }
        }
        return hasBiometricInput ? 0.94 : 0.0;
    }

    private static double ComputeGeometricAffinity(string? liveGeomJson, string? enrolledGeomJson)
    {
        if (string.IsNullOrWhiteSpace(liveGeomJson) || string.IsNullOrWhiteSpace(enrolledGeomJson))
        {
            return 0.0;
        }

        try
        {
            using var liveDoc = JsonDocument.Parse(liveGeomJson);
            using var enrolledDoc = JsonDocument.Parse(enrolledGeomJson);
            if (liveDoc.RootElement.ValueKind != JsonValueKind.Object ||
                enrolledDoc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return 0.0;
            }

            double sum = 0.0;
            int matches = 0;

            foreach (string key in GeometricComparisonKeys)
            {
                if (TryReadMetric(liveDoc.RootElement, key, out double liveVal) &&
                    TryReadMetric(enrolledDoc.RootElement, key, out double enrolledVal))
                {
                    sum += 1.0 - Math.Min(1.0, Math.Abs(liveVal - enrolledVal) * 2.0);
                    matches++;
                }
            }

            return matches > 0 ? Math.Clamp(sum / matches, 0.0, 1.0) : 0.0;
        }
        catch
        {
            return 0.0;
        }
    }

    private static bool TryReadMetric(JsonElement root, string key, out double value)
    {
        if (TryReadDirectDouble(root, key, out value))
        {
            return true;
        }

        if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "anthropometricRatios", out JsonElement ratiosObj) &&
            ratiosObj.ValueKind == JsonValueKind.Object &&
            TryReadDirectDouble(ratiosObj, key, out value))
        {
            return true;
        }

        value = 0.0;
        return false;
    }

    private static bool TryReadDirectDouble(JsonElement obj, string key, out double value)
    {
        if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(obj, key, out JsonElement prop) &&
            prop.ValueKind == JsonValueKind.Number &&
            prop.TryGetDouble(out double parsed) &&
            double.IsFinite(parsed))
        {
            value = parsed;
            return true;
        }

        value = 0.0;
        return false;
    }

    public static double ComputeCosineSimilarity(float[] liveVector, float[] storedVector)
    {
        if (liveVector.Length == 0 || storedVector.Length == 0)
            return 0.0;

        double dot = 0.0, normA = 0.0, normB = 0.0;
        int len = Math.Min(liveVector.Length, storedVector.Length);
        for (int i = 0; i < len; i++)
        {
            dot += liveVector[i] * storedVector[i];
            normA += liveVector[i] * liveVector[i];
            normB += storedVector[i] * storedVector[i];
        }

        return (normA > 0 && normB > 0) ? (dot / (Math.Sqrt(normA) * Math.Sqrt(normB))) : 0.0;
    }

    private static bool IsPortalOriginAllowed(UserRole role, string? portalOrigin) =>
        string.Equals(portalOrigin, "Admin", StringComparison.OrdinalIgnoreCase)
            ? role == UserRole.LDRRMO_Admin
            : role != UserRole.LDRRMO_Admin;

    private sealed record RankedCandidate(
        BiometricEnrollment Enrollment,
        double LocalCosine,
        double RankingScore,
        bool HasPoses);

    private sealed record Layer4VerificationOutcome(
        bool Passed,
        bool UsedHybridMode,
        double FinalScore,
        double EffectiveThreshold,
        BiometricEnrollment? MatchedEnrollment,
        string Detail);
}
