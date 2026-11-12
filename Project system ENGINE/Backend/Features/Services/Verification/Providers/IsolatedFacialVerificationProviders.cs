// [Layer: Backend/Services/Verification/Providers]
// Responsibility: Isolated Strategy Pattern implementations for internal 128-D biometric descriptor enrollment and external facial verification APIs.
// Disconnected from the default manual registration flow so automatic facial recognition is never executed unless explicitly configured.
// Universal lambda expressions (=>). Zero emojis.

namespace Backend.Features.Services.Verification.Providers;

public class InternalFacialVerificationProvider : IFacialVerificationProvider
{
    public string ProviderName => "InternalFacialVerificationProvider";
    public string ProviderMode => "InternalBiometric";

    public async Task<FacialVerificationSubmissionResult> SubmitFacialRecordAsync(
        FacialRecordSubmissionContext context,
        CancellationToken ct = default)
    {
        var manualProvider = new ManualFacialReviewProvider();
        var baseResult = await manualProvider.SubmitFacialRecordAsync(context, ct);
        if (!baseResult.Success)
            return baseResult with { ProviderName = ProviderName, ProviderMode = ProviderMode };

        byte[]? templateBytes = null;
        string? modelId = null;

        if (context.OptionalDescriptorVector is { Length: > 0 } vector)
        {
            templateBytes = new byte[vector.Length * sizeof(float)];
            Buffer.BlockCopy(vector, 0, templateBytes, 0, templateBytes.Length);
            modelId = "ResQTrack_Hybrid_CSLBP_Gabor_Haar";
        }

        return baseResult with
        {
            ProviderName = ProviderName,
            ProviderMode = ProviderMode,
            VerificationStatus = "PendingReview",
            FaceMatchStatus = "TEMPLATE_ENROLLED_PENDING_ADMIN_REVIEW",
            LivenessStatus = baseResult.FaceEncryptedFilePath != null ? "CAPTURED_PENDING_ADMIN_REVIEW" : "NOT_SUBMITTED",
            IsFaceMatched = false,
            IsIdentityVerified = false,
            EnrolledTemplateBytes = templateBytes,
            EnrolledModelIdentifier = modelId
        };
    }
}

public class ExternalFacialApiProvider : IFacialVerificationProvider
{
    public string ProviderName => "ExternalFacialApiProvider";
    public string ProviderMode => "ExternalFacialApi";

    public async Task<FacialVerificationSubmissionResult> SubmitFacialRecordAsync(
        FacialRecordSubmissionContext context,
        CancellationToken ct = default)
    {
        var manualProvider = new ManualFacialReviewProvider();
        var baseResult = await manualProvider.SubmitFacialRecordAsync(context, ct);
        return baseResult with
        {
            ProviderName = ProviderName,
            ProviderMode = ProviderMode,
            FaceMatchStatus = baseResult.Success ? "EXTERNAL_API_STANDBY_PENDING_REVIEW" : baseResult.FaceMatchStatus,
            IsFaceMatched = false,
            IsIdentityVerified = false
        };
    }
}
