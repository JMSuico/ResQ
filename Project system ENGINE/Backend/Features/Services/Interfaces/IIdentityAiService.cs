// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines contract for multi-provider AI vision OCR extraction, facial geometry analysis, and standby health checks.
// Invariant: Universal lambda expressions (=>), zero leaked secrets, strict DTO return shapes.

using Backend.Features.Api.DTOs;

namespace Backend.Features.Services.Interfaces;

public interface IIdentityAiService
{
    AiProviderStatusDto GetAiStatus();
    Task<AiExtractResponseDto> ExtractIdentityAsync(AiExtractRequestDto request, CancellationToken ct = default);
    Task<AiOcrResponseDto> ExtractIdOcrAsync(
        byte[] frontBytes,
        string frontMime,
        byte[]? backBytes,
        string? backMime,
        string? idType,
        string? preferredProvider = null,
        CancellationToken ct = default);
    Task<IdentityDocumentAnalyzeResponseDto> AnalyzeDocumentAsync(IdentityDocumentAnalyzeRequestDto request, CancellationToken ct = default);
    Task<FacialGeometryAnalysisResponseDto> AnalyzeFacialGeometryAsync(FacialGeometryAnalysisRequestDto request, CancellationToken ct = default);
    Task<BiometricTrainingStatusDto> GetBiometricTrainingStatusAsync(string? email, CancellationToken ct = default) =>
        Task.FromResult(new BiometricTrainingStatusDto(
            Email: email?.Trim().ToLowerInvariant() ?? string.Empty,
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
            Message: "No active biometric enrollment found for this account."));
}
