// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes multi-provider AI vision OCR extraction endpoints via IIdentityAiService.
// Universal Lambda Expressions (=>). Injects Services ONLY. Under 35 lines. Zero emojis.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/identity")]
public class IdentityController(IIdentityAiService aiService) : ControllerBase
{
    [HttpGet("ai-status")]
    public IActionResult GetAiStatus() =>
        Ok(aiService.GetAiStatus());

    [HttpPost("ai-extract")]
    public async Task<IActionResult> AiExtractAsync([FromBody] AiExtractRequestDto request, CancellationToken ct) =>
        Ok(await aiService.ExtractIdentityAsync(request, ct));
}
