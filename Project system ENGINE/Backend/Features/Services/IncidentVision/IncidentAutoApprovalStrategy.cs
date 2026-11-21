// [Layer: Backend/Services/IncidentVision]
// Responsibility: Evaluates dual-stage incident AI vision telemetry to determine fail-closed automatic report verification eligibility.
// Strategy Pattern (OCP), Universal Lambda Expressions (=>), Fail-Closed AI Verification (No Blind Offline Auto-Approval), Zero Emojis.

namespace Backend.Features.Services.IncidentVision;

public sealed record IncidentAutoApprovalContext(
    bool HasImage,
    bool IsBlurry,
    bool IsGenuineIncident,
    string? DetectedCategory,
    string? RoboflowAuthTransport,
    string? RoboflowPrediction,
    double? RoboflowConfidence,
    bool RoboflowNeedsReview,
    bool ClaudeRanOnline,
    string? ClaudeModelUsed,
    string? ClaudeSituationSummary,
    string? ClaudeUncertaintyNotes
);

public sealed record IncidentAutoApprovalDecision(
    bool AutoApproved,
    string AiVerificationStatus,
    string Reason
);

public interface IIncidentAutoApprovalStrategy
{
    IncidentAutoApprovalDecision Evaluate(IncidentAutoApprovalContext context);
}

public class ClaudeIncidentAutoApprovalStrategy : IIncidentAutoApprovalStrategy
{
    public const string StatusAutoApproved = "AI_AUTO_APPROVED";
    public const string StatusNonIncidentFlagged = "AI_NON_INCIDENT_FLAGGED";
    public const string StatusPendingManualReview = "PENDING_MANUAL_REVIEW";

    private static readonly string[] SevereAmbiguityMarkers =
    [
        "cannot confirm",
        "unable to confirm",
        "unable to verify",
        "cannot verify",
        "cannot determine",
        "unclear whether",
        "unclear if",
        "no visible emergency",
        "not a genuine",
        "not an emergency",
        "too blurry",
        "severely obscured",
        "unrecognizable",
        "blank frame",
        "black frame",
        "false alarm"
    ];

    public IncidentAutoApprovalDecision Evaluate(IncidentAutoApprovalContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (!context.HasImage)
        {
            return new IncidentAutoApprovalDecision(
                AutoApproved: false,
                AiVerificationStatus: StatusPendingManualReview,
                Reason: "Incident image capture is missing; manual verification required.");
        }

        if (context.IsBlurry)
        {
            return new IncidentAutoApprovalDecision(
                AutoApproved: false,
                AiVerificationStatus: StatusPendingManualReview,
                Reason: "Image failed Laplacian clarity check (blurry); manual verification required.");
        }

        bool roboflowOnline = IsOnlineRoboflowTransport(context.RoboflowAuthTransport);
        bool claudeOnline = context.ClaudeRanOnline && !string.IsNullOrWhiteSpace(context.ClaudeModelUsed);

        if (!claudeOnline && !roboflowOnline)
        {
            return new IncidentAutoApprovalDecision(
                AutoApproved: false,
                AiVerificationStatus: StatusPendingManualReview,
                Reason: "Neither Claude Haiku 4.5 nor live Roboflow ran online; failing closed to manual review.");
        }

        bool isNonIncident = !context.IsGenuineIncident ||
                             string.IsNullOrWhiteSpace(context.DetectedCategory) ||
                             string.Equals(context.DetectedCategory.Trim(), "NonIncident", StringComparison.OrdinalIgnoreCase);

        if (isNonIncident)
        {
            return new IncidentAutoApprovalDecision(
                AutoApproved: false,
                AiVerificationStatus: StatusNonIncidentFlagged,
                Reason: "AI vision classified image as NonIncident or no genuine emergency detected.");
        }

        bool roboflowPredictedAccident = roboflowOnline &&
                                         string.Equals(context.RoboflowPrediction?.Trim(), "Accident", StringComparison.OrdinalIgnoreCase);

        bool claudeExplicitlyVerified = claudeOnline &&
                                        !string.IsNullOrWhiteSpace(context.ClaudeSituationSummary) &&
                                        context.ClaudeSituationSummary.Trim().Length >= 12 &&
                                        !HasSevereAmbiguity(context.ClaudeUncertaintyNotes);

        if (roboflowOnline && !roboflowPredictedAccident && !claudeExplicitlyVerified)
        {
            return new IncidentAutoApprovalDecision(
                AutoApproved: false,
                AiVerificationStatus: StatusPendingManualReview,
                Reason: "Live Roboflow did not predict an accident and Claude Haiku 4.5 did not provide unambiguous emergency confirmation.");
        }

        if (!roboflowOnline && !claudeExplicitlyVerified)
        {
            return new IncidentAutoApprovalDecision(
                AutoApproved: false,
                AiVerificationStatus: StatusPendingManualReview,
                Reason: "Claude Haiku 4.5 summary lacked sufficient clarity for standalone auto-approval.");
        }

        if (roboflowOnline && roboflowPredictedAccident && !claudeOnline && context.RoboflowNeedsReview)
        {
            return new IncidentAutoApprovalDecision(
                AutoApproved: false,
                AiVerificationStatus: StatusPendingManualReview,
                Reason: "Roboflow confidence is below auto-approval threshold without online Claude verification.");
        }

        return new IncidentAutoApprovalDecision(
            AutoApproved: true,
            AiVerificationStatus: StatusAutoApproved,
            Reason: claudeExplicitlyVerified
                ? $"Claude Haiku 4.5 online vision confirmed genuine {context.DetectedCategory} incident."
                : $"Live Roboflow vision confirmed {context.RoboflowPrediction} ({(context.RoboflowConfidence ?? 0.0) * 100:F0}% confidence).");
    }

    private static bool IsOnlineRoboflowTransport(string? authTransport) =>
        !string.IsNullOrWhiteSpace(authTransport) &&
        !authTransport.StartsWith("LOCAL_FALLBACK", StringComparison.OrdinalIgnoreCase);

    private static bool HasSevereAmbiguity(string? uncertaintyNotes)
    {
        if (string.IsNullOrWhiteSpace(uncertaintyNotes))
        {
            return false;
        }

        string lower = uncertaintyNotes.ToLowerInvariant();
        return SevereAmbiguityMarkers.Any(marker => lower.Contains(marker, StringComparison.Ordinal));
    }
}
