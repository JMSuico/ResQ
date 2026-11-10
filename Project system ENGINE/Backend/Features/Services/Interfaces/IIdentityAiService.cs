// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines contract for multi-provider AI vision OCR extraction and standby health checks.
// Invariant: Universal lambda expressions (=>), zero leaked secrets, strict DTO return shapes.

using Backend.Features.Api.DTOs;

namespace Backend.Features.Services.Interfaces;

public interface IIdentityAiService
{
    AiProviderStatusDto GetAiStatus();
    Task<AiExtractResponseDto> ExtractIdentityAsync(AiExtractRequestDto request, CancellationToken ct = default);
}
