// [Layer: Backend/Services/Verification/Providers]
// Responsibility: Isolated Strategy Pattern implementations for automated OCR, Government Registry API, and Third-Party KYC identity verification.
// Kept decoupled from the active manual registration path so future verification providers can be enabled via configuration without modifying AuthService.
// Universal lambda expressions (=>). Zero emojis.

using System.Diagnostics;
using System.Text.Json;
using Backend.Features.Api.DTOs;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Verification.Providers;

public class OcrIdentityVerificationProvider(IIdentityAiService? identityAiService = null) : IIdentityVerificationProvider
{
    public string ProviderName => "OcrIdentityVerificationProvider";
    public string ProviderMode => "AutomatedOcr";

    public async Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var manualFallback = new ManualIdentityVerificationProvider();
        var baseResult = await manualFallback.SubmitIdentityDocumentAsync(context, ct);
        if (!baseResult.Success)
            return baseResult with { ProviderName = ProviderName, ProviderMode = ProviderMode };

        if (identityAiService == null || string.IsNullOrWhiteSpace(context.FrontImageDataUrl))
        {
            return baseResult with
            {
                ProviderName = ProviderName,
                ProviderMode = ProviderMode,
                DocumentCheckStatus = "OCR_STANDBY_PENDING_ADMIN_REVIEW"
            };
        }

        var analysis = await identityAiService.AnalyzeDocumentAsync(
            new IdentityDocumentAnalyzeRequestDto
            {
                SelectedIdCategory = context.GovernmentIdType,
                ManualTemplateOverride = null,
                FrontRawText = null,
                BackRawText = null,
                FrontImageDataUrl = context.FrontImageDataUrl,
                BackImageDataUrl = context.BackImageDataUrl,
                ExtractedFields = null
            },
            ct);

        sw.Stop();
        return baseResult with
        {
            ProviderName = ProviderName,
            ProviderMode = ProviderMode,
            VerificationStatus = "PendingReview",
            DocumentCheckStatus = $"{analysis.OverallStatus}|OFFICIAL:{analysis.OfficialVerificationStatus}",
            IsAuthenticityVerified = false,
            ConfidenceScore = analysis.CalibratedConfidence,
            NormalizedFieldsJson = JsonSerializer.Serialize(analysis.NormalizedFields),
            ExecutionTimeMs = sw.ElapsedMilliseconds
        };
    }
}

public class GovernmentApiIdentityVerificationProvider : IIdentityVerificationProvider
{
    public string ProviderName => "GovernmentApiIdentityVerificationProvider";
    public string ProviderMode => "GovernmentApi";

    public async Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default)
    {
        var manualProvider = new ManualIdentityVerificationProvider();
        var result = await manualProvider.SubmitIdentityDocumentAsync(context, ct);
        return result with
        {
            ProviderName = ProviderName,
            ProviderMode = ProviderMode,
            DocumentCheckStatus = result.Success ? "GOV_REGISTRY_STANDBY_PENDING_REVIEW" : result.DocumentCheckStatus,
            IsAuthenticityVerified = false
        };
    }
}

public class ThirdPartyIdentityVerificationProvider : IIdentityVerificationProvider
{
    public string ProviderName => "ThirdPartyIdentityVerificationProvider";
    public string ProviderMode => "ThirdPartyApi";

    public async Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default)
    {
        var manualProvider = new ManualIdentityVerificationProvider();
        var result = await manualProvider.SubmitIdentityDocumentAsync(context, ct);
        return result with
        {
            ProviderName = ProviderName,
            ProviderMode = ProviderMode,
            DocumentCheckStatus = result.Success ? "THIRD_PARTY_STANDBY_PENDING_REVIEW" : result.DocumentCheckStatus,
            IsAuthenticityVerified = false
        };
    }
}
