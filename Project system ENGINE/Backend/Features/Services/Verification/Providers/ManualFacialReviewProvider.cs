// [Layer: Backend/Services/Verification/Providers]
// Responsibility: Active default Strategy Pattern implementation for manual facial photograph capture and review.
// Validates file size, magic bytes, image dimensions, and privacy consent, stores AES-256-GCM encrypted image, performs zero automatic facial recognition or matching, and records status as PendingReview.
// Universal lambda expressions (=>). Zero emojis.

using System.Diagnostics;
using Backend.Features.Helpers.Infrastructure;

namespace Backend.Features.Services.Verification.Providers;

public class ManualFacialReviewProvider : IFacialVerificationProvider
{
    public string ProviderName => "ManualFacialReviewProvider";
    public string ProviderMode => "Manual";

    public async Task<FacialVerificationSubmissionResult> SubmitFacialRecordAsync(
        FacialRecordSubmissionContext context,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        if (!context.ConsentAccepted)
        {
            return Fail(
                VerificationErrorType.ValidationError,
                "Explicit privacy and registration consent must be accepted before submitting your facial record.",
                sw.ElapsedMilliseconds);
        }

        bool hasFaceCapture = !string.IsNullOrWhiteSpace(context.FaceCaptureDataUrl);
        if (context.RequireFacialCapture && !hasFaceCapture)
        {
            return Fail(
                VerificationErrorType.ValidationError,
                "A captured facial photograph is required to complete registration.",
                sw.ElapsedMilliseconds);
        }

        string? faceEncryptedPath = null;
        if (hasFaceCapture)
        {
            var faceCheck = CaptureStorageHelper.InspectAndValidateImage(
                context.FaceCaptureDataUrl,
                "Facial capture photograph",
                context.MaxUploadSizeBytes,
                context.MinWidth,
                context.MinHeight,
                context.MaxWidth,
                context.MaxHeight);

            if (!faceCheck.IsValid)
                return Fail(MapHttpStatusToErrorType(faceCheck.HttpStatusCode), faceCheck.ErrorMessage ?? "Invalid facial capture image.", sw.ElapsedMilliseconds);

            faceEncryptedPath = await CaptureStorageHelper.SaveCaptureDataUrlAsync(
                context.FaceCaptureDataUrl,
                context.CapturesRootPath,
                "FACE",
                ct);

            if (string.IsNullOrWhiteSpace(faceEncryptedPath))
                return Fail(VerificationErrorType.UnprocessableEntity, "Unable to persist encrypted facial photograph.", sw.ElapsedMilliseconds);
        }

        sw.Stop();
        return new FacialVerificationSubmissionResult(
            Success: true,
            ProviderName: ProviderName,
            ProviderMode: ProviderMode,
            VerificationStatus: "PendingReview",
            FaceMatchStatus: "NOT_PERFORMED_MANUAL_REVIEW",
            LivenessStatus: hasFaceCapture ? "CAPTURED_PENDING_ADMIN_REVIEW" : "NOT_SUBMITTED",
            IsFaceMatched: false,
            IsIdentityVerified: false,
            FaceEncryptedFilePath: faceEncryptedPath,
            EnrolledTemplateBytes: null,
            EnrolledModelIdentifier: null,
            ErrorType: VerificationErrorType.None,
            ErrorMessage: null,
            ExecutionTimeMs: sw.ElapsedMilliseconds);
    }

    private FacialVerificationSubmissionResult Fail(VerificationErrorType errorType, string message, long elapsedMs) =>
        new(
            Success: false,
            ProviderName: ProviderName,
            ProviderMode: ProviderMode,
            VerificationStatus: "Rejected",
            FaceMatchStatus: "VALIDATION_FAILED",
            LivenessStatus: "REJECTED",
            IsFaceMatched: false,
            IsIdentityVerified: false,
            FaceEncryptedFilePath: null,
            EnrolledTemplateBytes: null,
            EnrolledModelIdentifier: null,
            ErrorType: errorType,
            ErrorMessage: message,
            ExecutionTimeMs: elapsedMs);

    private static VerificationErrorType MapHttpStatusToErrorType(int httpStatus) =>
        httpStatus switch
        {
            413 => VerificationErrorType.PayloadTooLarge,
            415 => VerificationErrorType.UnsupportedMediaType,
            422 => VerificationErrorType.UnprocessableEntity,
            _ => VerificationErrorType.ValidationError
        };
}
