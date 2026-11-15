// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines shared Anthropic Claude Messages API client contract with primary-to-fallback model failover.
// Invariant: C# .NET 10, nullable reference types, zero leaked secrets.

namespace Backend.Features.Services.Interfaces;

public sealed record ClaudeMessageAttemptResult(
    bool Success,
    string? RawText,
    string ModelUsed,
    string? ErrorCode,
    string? ErrorMessage,
    int HttpStatusCode,
    bool UsedFallbackModel);

public interface IClaudeMessagesClient
{
    bool IsConfigured { get; }
    string PrimaryModel { get; }
    string FallbackModel { get; }
    Task<ClaudeMessageAttemptResult> SendMessagesAsync(
        IReadOnlyDictionary<string, object> payloadWithoutModel,
        CancellationToken ct = default,
        string? modelOverride = null);
}
