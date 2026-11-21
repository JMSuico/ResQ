// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes multi-provider AI vision OCR extraction, forensic ID gating, and 4-pose Face-to-Gov-ID biometrics endpoints via IIdentityAiService.
// Universal Lambda Expressions (=>). Injects Services ONLY. Zero emojis.

using Microsoft.AspNetCore.Http;
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
    public async Task<IActionResult> AiExtractAsync([FromBody] AiExtractRequestDto? request, CancellationToken ct) =>
        request == null || (string.IsNullOrWhiteSpace(request.ImageDataUrl) && string.IsNullOrWhiteSpace(request.FrontImageBase64))
            ? BadRequest(BuildFailureDto<AiExtractResponseDto>(
                "MISSING_FRONT_IMAGE",
                "Front Government ID image is required before running OCR."))
            : MapOcrActionResult(await aiService.ExtractIdentityAsync(NormalizeExtractRequest(request), ct));

    [HttpPost("ocr/extract")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ExtractOcrMultipartAsync(
        IFormFile? frontImage,
        IFormFile? backImage,
        [FromForm] string? idType,
        [FromForm] string? preferredProvider,
        [FromForm] string? requireDualSide = null,
        [FromForm] string? model = null,
        [FromForm] string? preferredModel = null,
        CancellationToken ct = default)
    {
        bool dualSideRequired = IsTruthyFlag(requireDualSide);
        string normalizedIdType = idType?.Trim() ?? string.Empty;

        // Fail closed before reading upload streams or invoking OCR services when dual-side mode lacks an ID type.
        if (dualSideRequired && string.IsNullOrWhiteSpace(normalizedIdType))
        {
            return BadRequest(BuildFailureDto<AiOcrResponseDto>(
                "MISSING_ID_TYPE",
                "Please select a Government ID document type before uploading Front and Back ID photos."));
        }

        if (frontImage == null || frontImage.Length == 0)
        {
            return BadRequest(BuildFailureDto<AiOcrResponseDto>(
                "MISSING_FRONT_IMAGE",
                "Front Government ID image is required before running OCR."));
        }

        byte[] frontBytes = await ReadFormFileBytesAsync(frontImage, ct);
        if (frontBytes.Length == 0)
        {
            return BadRequest(BuildFailureDto<AiOcrResponseDto>(
                "MISSING_FRONT_IMAGE",
                "Front Government ID image is required before running OCR."));
        }

        byte[]? backBytes = backImage is { Length: > 0 } ? await ReadFormFileBytesAsync(backImage, ct) : null;
        if (dualSideRequired && (backBytes == null || backBytes.Length == 0))
        {
            return BadRequest(BuildFailureDto<AiOcrResponseDto>(
                "MISSING_BACK_IMAGE",
                "Back Government ID image is required for dual-side verification."));
        }

        string? effectivePreferred = !string.IsNullOrWhiteSpace(preferredModel)
            ? preferredModel.Trim()
            : !string.IsNullOrWhiteSpace(model)
                ? model.Trim()
                : preferredProvider?.Trim();

        AiOcrResponseDto result = await aiService.ExtractIdOcrAsync(
            frontBytes,
            ResolveImageMimeType(frontImage),
            backBytes,
            backBytes is { Length: > 0 } ? ResolveImageMimeType(backImage) : null,
            normalizedIdType,
            preferredProvider: effectivePreferred,
            ct: ct);
        return MapOcrActionResult(result);
    }

    [HttpPost("/api/identity-documents/analyze")]
    public async Task<IActionResult> AnalyzeDocumentAsync([FromBody] IdentityDocumentAnalyzeRequestDto request, CancellationToken ct) =>
        Ok(await aiService.AnalyzeDocumentAsync(request, ct));

    [HttpPost("biometrics/analyze-geometry")]
    public async Task<IActionResult> AnalyzeFacialGeometryAsync([FromBody] FacialGeometryAnalysisRequestDto? request, CancellationToken ct) =>
        request == null
            ? BadRequest(new FacialGeometryAnalysisResponseDto
            {
                IsValidFaceGeometry = false,
                ErrorCode = "MISSING_FACIAL_REQUEST",
                ErrorMessage = "Facial geometry analysis payload is required."
            })
            : MapBiometricActionResult(await aiService.AnalyzeFacialGeometryAsync(request, ct));

    [HttpGet("biometrics/training-status")]
    public async Task<IActionResult> GetBiometricTrainingStatusAsync([FromQuery] string? email, CancellationToken ct) =>
        Ok(await aiService.GetBiometricTrainingStatusAsync(email, ct));

    private IActionResult MapOcrActionResult(AiExtractResponseDto result) =>
        result.Success && string.IsNullOrWhiteSpace(result.ErrorCode)
            ? Ok(result)
            : (result.ErrorCode ?? string.Empty).Trim().ToUpperInvariant() switch
            {
                "MISSING_FRONT_IMAGE"
                    or "MISSING_BACK_IMAGE"
                    or "MISSING_ID_TYPE"
                    or "INVALID_FORMAT"
                    or "INVALID_REQUEST" => BadRequest(result),
                "DUPLICATE_FRONT_BACK_IMAGE"
                    or "WRONG_ID_SIDE_FRONT_EXPECTED"
                    or "WRONG_ID_SIDE_BACK_EXPECTED"
                    or "WRONG_GOVERNMENT_ID_TYPE"
                    or "FAKE_OR_AI_GENERATED_ID"
                    or "NON_ID_DOCUMENT"
                    or "UNREADABLE_OR_BLANK_IMAGE"
                    or "INSUFFICIENT_VISIBLE_TEXT" => UnprocessableEntity(result),
                "PROVIDER_UNAVAILABLE" or "REQUEST_FAILED" => StatusCode(StatusCodes.Status503ServiceUnavailable, result),
                _ when result.RequiresPendingManualReview => StatusCode(StatusCodes.Status503ServiceUnavailable, result),
                _ when result.Success => Ok(result),
                _ => UnprocessableEntity(result)
            };

    private IActionResult MapBiometricActionResult(FacialGeometryAnalysisResponseDto result) =>
        string.IsNullOrWhiteSpace(result.ErrorCode)
            ? Ok(result)
            : result.ErrorCode.Trim().ToUpperInvariant() switch
            {
                "MISSING_FRONT_IMAGE"
                    or "MISSING_BACK_IMAGE"
                    or "INVALID_VERIFICATION_TOKEN"
                    or "VERIFICATION_TOKEN_REPLAYED" => BadRequest(result),
                "LIVENESS_SPOOF_REJECTED" or "FACE_TO_ID_MISMATCH" => UnprocessableEntity(result),
                "PROVIDER_UNAVAILABLE" => StatusCode(StatusCodes.Status503ServiceUnavailable, result),
                _ when result.RequiresPendingManualReview => StatusCode(StatusCodes.Status503ServiceUnavailable, result),
                _ => UnprocessableEntity(result)
            };

    private static bool IsTruthyFlag(string? value) =>
        !string.IsNullOrWhiteSpace(value) &&
        (value.Trim().Equals("true", StringComparison.OrdinalIgnoreCase) ||
         value.Trim().Equals("1", StringComparison.Ordinal) ||
         value.Trim().Equals("yes", StringComparison.OrdinalIgnoreCase));

    private static AiExtractRequestDto NormalizeExtractRequest(AiExtractRequestDto request) =>
        new()
        {
            ImageDataUrl = request.ImageDataUrl,
            FrontImageBase64 = request.FrontImageBase64,
            BackImageBase64 = request.BackImageBase64,
            HintType = request.HintType?.Trim(),
            IdType = request.IdType?.Trim(),
            PreferredProvider = request.PreferredProvider?.Trim()
        };

    private static TDto BuildFailureDto<TDto>(string errorCode, string errorMessage)
        where TDto : AiExtractResponseDto, new() =>
        new()
        {
            Success = false,
            ProviderUsed = string.Empty,
            Confidence = 0.0,
            IsAuthentic = false,
            RequiresPendingManualReview = false,
            ErrorCode = errorCode,
            ErrorMessage = errorMessage
        };

    private static string ResolveImageMimeType(IFormFile? file) =>
        string.IsNullOrWhiteSpace(file?.ContentType) ? "image/jpeg" : file.ContentType;

    private static async Task<byte[]> ReadFormFileBytesAsync(IFormFile? file, CancellationToken ct)
    {
        if (file == null || file.Length == 0) return [];
        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return ms.ToArray();
    }
}
