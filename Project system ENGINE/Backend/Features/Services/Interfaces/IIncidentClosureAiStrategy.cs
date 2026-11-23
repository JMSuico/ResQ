// [Layer: Backend/Services/Interfaces]
// Responsibility: Strategy contract for multimodal AI verification of responder field-closure & investigation evidence photos.
// Strategy Pattern (OCP), Universal Lambda Expressions (=>), Zero Emojis.

namespace Backend.Features.Services.Interfaces;

public sealed record IncidentClosureAiInput(
    string ImageDataUrl,
    string? Notes,
    string? RequestedOutcome,
    string? IncidentTitle,
    string? IncidentCategory,
    string? ResponderUnit
);

public sealed record IncidentClosureAiEvaluation(
    string Verdict,
    string EvidenceCategory,
    bool AutoApproved,
    double Confidence,
    string Reasoning,
    string ModelUsed,
    bool RanOnline
);

public interface IIncidentClosureAiStrategy
{
    Task<IncidentClosureAiEvaluation> EvaluateClosureEvidenceAsync(
        IncidentClosureAiInput input,
        CancellationToken ct = default);
}
