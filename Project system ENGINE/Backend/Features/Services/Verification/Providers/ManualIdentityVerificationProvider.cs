// [Layer: Backend/Services/Verification/Providers]
// Responsibility: Active default Strategy Pattern implementation for manual government ID submission.
// Strictly validates file size, magic bytes, and image dimensions, stores AES-256-GCM encrypted files, never executes OCR or auto-detection, and records status as PendingReview.
// Universal lambda expressions (=>). Zero emojis.

using System.Diagnostics;
using Backend.Features.Helpers.Infrastructure;

namespace Backend.Features.Services.Verification.Providers;

public class ManualIdentityVerificationProvider : IIdentityVerificationProvider
{
    public string ProviderName => "ManualIdentityVerificationProvider";
    public string ProviderMode => "Manual";

    public async Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        bool hasFront = !string.IsNullOrWhiteSpace(context.FrontImageDataUrl);
        bool hasBack = !string.IsNullOrWhiteSpace(context.BackImageDataUrl);

        if (context.RequireFront && !hasFront)
        {
            return Fail(
                VerificationErrorType.ValidationError,
                "A Front Government ID image is required.",
                sw.ElapsedMilliseconds);
        }

        if (context.RequireBothSides && (!hasFront || !hasBack))
        {
            return Fail(
                VerificationErrorType.ValidationError,
                "Both Front and Back government ID images are required for registration.",
                sw.ElapsedMilliseconds);
        }

        if ((hasFront || hasBack) && string.IsNullOrWhiteSpace(context.GovernmentIdType))
        {
            return Fail(
                VerificationErrorType.ValidationError,
                "Please select a Government ID type before uploading ID images.",
                sw.ElapsedMilliseconds);
        }

        string? frontEncryptedPath = null;
        string? backEncryptedPath = null;

        if (hasFront)
        {
            var frontCheck = CaptureStorageHelper.InspectAndValidateImage(
                context.FrontImageDataUrl,
                "Front Government ID image",
                context.MaxUploadSizeBytes,
                context.MinWidth,
                context.MinHeight,
                context.MaxWidth,
                context.MaxHeight);

            if (!frontCheck.IsValid)
                return Fail(MapHttpStatusToErrorType(frontCheck.HttpStatusCode), frontCheck.ErrorMessage ?? "Invalid Front ID image.", sw.ElapsedMilliseconds);

            frontEncryptedPath = await CaptureStorageHelper.SaveCaptureDataUrlAsync(
                context.FrontImageDataUrl,
                context.CapturesRootPath,
                "ID_FRONT",
                ct);

            if (string.IsNullOrWhiteSpace(frontEncryptedPath))
                return Fail(VerificationErrorType.UnprocessableEntity, "Unable to persist encrypted Front Government ID image.", sw.ElapsedMilliseconds);
        }

        if (hasBack)
        {
            var backCheck = CaptureStorageHelper.InspectAndValidateImage(
                context.BackImageDataUrl,
                "Back Government ID image",
                context.MaxUploadSizeBytes,
                context.MinWidth,
                context.MinHeight,
                context.MaxWidth,
                context.MaxHeight);

            if (!backCheck.IsValid)
                return Fail(MapHttpStatusToErrorType(backCheck.HttpStatusCode), backCheck.ErrorMessage ?? "Invalid Back ID image.", sw.ElapsedMilliseconds);

            backEncryptedPath = await CaptureStorageHelper.SaveCaptureDataUrlAsync(
                context.BackImageDataUrl,
                context.CapturesRootPath,
                "ID_BACK",
                ct);

            if (string.IsNullOrWhiteSpace(backEncryptedPath))
                return Fail(VerificationErrorType.UnprocessableEntity, "Unable to persist encrypted Back Government ID image.", sw.ElapsedMilliseconds);
        }

        sw.Stop();
        return new IdentityVerificationSubmissionResult(
            Success: true,
            ProviderName: ProviderName,
            ProviderMode: ProviderMode,
            VerificationStatus: "PendingReview",
            DocumentCheckStatus: "SUBMITTED_PENDING_ADMIN_REVIEW",
            IsAuthenticityVerified: false,
            FrontEncryptedFilePath: frontEncryptedPath,
            BackEncryptedFilePath: backEncryptedPath,
            ConfidenceScore: 0.0,
            NormalizedFieldsJson: "{}",
            ErrorType: VerificationErrorType.None,
            ErrorMessage: null,
            ExecutionTimeMs: sw.ElapsedMilliseconds);
    }

    private IdentityVerificationSubmissionResult Fail(VerificationErrorType errorType, string message, long elapsedMs) =>
        new(
            Success: false,
            ProviderName: ProviderName,
            ProviderMode: ProviderMode,
            VerificationStatus: "Rejected",
            DocumentCheckStatus: "VALIDATION_FAILED",
            IsAuthenticityVerified: false,
            FrontEncryptedFilePath: null,
            BackEncryptedFilePath: null,
            ConfidenceScore: 0.0,
            NormalizedFieldsJson: "{}",
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
