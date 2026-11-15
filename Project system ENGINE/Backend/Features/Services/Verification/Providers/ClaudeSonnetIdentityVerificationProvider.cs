// [Layer: Backend/Services/Verification/Providers]
// Responsibility: Claude Sonnet Strategy Pattern implementation for Front & Back Philippine Government ID verification and OCR provenance.
// Universal lambda expressions (=>). Zero emojis.

using System.Diagnostics;
using System.Text.Json;
using Backend.Features.Api.DTOs;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Verification.Providers;

public class ClaudeSonnetIdentityVerificationProvider(
    IIdentityAiService? identityAiService = null) : IIdentityVerificationProvider
{
    public string ProviderName => "ClaudeSonnet";
    public string ProviderMode => "ClaudeSonnet";

    public async Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var manualProvider = new ManualIdentityVerificationProvider();
        var baseResult = await manualProvider.SubmitIdentityDocumentAsync(context, ct);

        if (!baseResult.Success)
        {
            return baseResult with
            {
                ProviderName = ProviderName,
                ProviderMode = ProviderMode
            };
        }

        double confidence = 0.0;
        string normalizedJson = "{}";
        string documentCheckStatus = "MANUAL_PENDING_ADMIN_REVIEW";

        if (identityAiService == null)
        {
            documentCheckStatus = "CLAUDE_OCR_UNAVAILABLE_PENDING_ADMIN_REVIEW";
        }
        else if (!string.IsNullOrWhiteSpace(context.FrontImageDataUrl))
        {
            var ocrResult = await identityAiService.ExtractIdentityAsync(
                new AiExtractRequestDto
                {
                    ImageDataUrl = context.FrontImageDataUrl,
                    FrontImageBase64 = context.FrontImageDataUrl,
                    BackImageBase64 = context.BackImageDataUrl,
                    HintType = context.GovernmentIdType,
                    IdType = context.GovernmentIdType,
                    PreferredProvider = "claude"
                },
                ct);

            if (ocrResult.Success)
            {
                confidence = ocrResult.Confidence > 0.0 ? ocrResult.Confidence : 0.0;
                documentCheckStatus = "CLAUDE_VISION_OCR_EXTRACTED_PENDING_ADMIN_REVIEW";
                var normalizedMap = ocrResult.ExtractedFields.ToDictionary(
                    k => k.Key,
                    v => v.Value.Value,
                    StringComparer.OrdinalIgnoreCase);
                normalizedJson = JsonSerializer.Serialize(normalizedMap);
            }
            else
            {
                confidence = 0.0;
                documentCheckStatus = string.Equals(ocrResult.ErrorCode, "PROVIDER_UNAVAILABLE", StringComparison.Ordinal)
                    ? "CLAUDE_OCR_UNAVAILABLE_PENDING_ADMIN_REVIEW"
                    : "MANUAL_PENDING_ADMIN_REVIEW";
            }
        }

        sw.Stop();
        return baseResult with
        {
            ProviderName = ProviderName,
            ProviderMode = ProviderMode,
            VerificationStatus = "PendingReview",
            DocumentCheckStatus = documentCheckStatus,
            IsAuthenticityVerified = false,
            ConfidenceScore = confidence,
            NormalizedFieldsJson = normalizedJson,
            ExecutionTimeMs = Math.Max(1, sw.ElapsedMilliseconds)
        };
    }
}
