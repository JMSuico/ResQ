// [Layer: Backend/Services/Verification/Decorators]
// Responsibility: Implements the Decorator Pattern wrapping IIdentityVerificationProvider and IFacialVerificationProvider with cross-cutting structured telemetry logging and fault resilience.
// Universal lambda expressions (=>). Zero emojis.

using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Backend.Features.Services.Verification.Decorators;

public class LoggingIdentityVerificationDecorator(
    IIdentityVerificationProvider inner,
    ILogger? logger = null) : IIdentityVerificationProvider
{
    public string ProviderName => inner.ProviderName;
    public string ProviderMode => inner.ProviderMode;

    public async Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        logger?.LogInformation(
            "[IdentityVerificationDecorator] Starting ID submission via {Provider} ({Mode}) for {Email} [IdType={IdType}, HasFront={HasFront}, HasBack={HasBack}]",
            ProviderName,
            ProviderMode,
            context.Email,
            context.GovernmentIdType ?? "none",
            !string.IsNullOrWhiteSpace(context.FrontImageDataUrl),
            !string.IsNullOrWhiteSpace(context.BackImageDataUrl));

        var result = await inner.SubmitIdentityDocumentAsync(context, ct);
        sw.Stop();

        if (result.Success)
        {
            logger?.LogInformation(
                "[IdentityVerificationDecorator] Completed ID submission via {Provider} in {ElapsedMs}ms -> Status={Status}, CheckStatus={CheckStatus}",
                ProviderName,
                sw.ElapsedMilliseconds,
                result.VerificationStatus,
                result.DocumentCheckStatus);
        }
        else
        {
            logger?.LogWarning(
                "[IdentityVerificationDecorator] Rejected ID submission via {Provider} in {ElapsedMs}ms -> ErrorType={ErrorType}, Message={Error}",
                ProviderName,
                sw.ElapsedMilliseconds,
                result.ErrorType,
                result.ErrorMessage);
        }

        return result with { ExecutionTimeMs = Math.Max(result.ExecutionTimeMs, sw.ElapsedMilliseconds) };
    }
}

public class ResilienceIdentityVerificationDecorator(
    IIdentityVerificationProvider inner,
    ILogger? logger = null) : IIdentityVerificationProvider
{
    public string ProviderName => inner.ProviderName;
    public string ProviderMode => inner.ProviderMode;

    public async Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default)
    {
        try
        {
            return await inner.SubmitIdentityDocumentAsync(context, ct);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger?.LogError(ex, "[ResilienceIdentityVerificationDecorator] Unhandled fault in provider {Provider}", ProviderName);
            return new IdentityVerificationSubmissionResult(
                Success: false,
                ProviderName: ProviderName,
                ProviderMode: ProviderMode,
                VerificationStatus: "Rejected",
                DocumentCheckStatus: "PROVIDER_FAULT",
                IsAuthenticityVerified: false,
                FrontEncryptedFilePath: null,
                BackEncryptedFilePath: null,
                ConfidenceScore: 0.0,
                NormalizedFieldsJson: "{}",
                ErrorType: VerificationErrorType.InternalError,
                ErrorMessage: "Identity verification provider encountered an internal storage or processing error.",
                ExecutionTimeMs: 0);
        }
    }
}

public class LoggingFacialVerificationDecorator(
    IFacialVerificationProvider inner,
    ILogger? logger = null) : IFacialVerificationProvider
{
    public string ProviderName => inner.ProviderName;
    public string ProviderMode => inner.ProviderMode;

    public async Task<FacialVerificationSubmissionResult> SubmitFacialRecordAsync(
        FacialRecordSubmissionContext context,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        logger?.LogInformation(
            "[FacialVerificationDecorator] Starting facial record submission via {Provider} ({Mode}) for {Email} [HasFaceCapture={HasFace}, Consent={Consent}]",
            ProviderName,
            ProviderMode,
            context.Email,
            !string.IsNullOrWhiteSpace(context.FaceCaptureDataUrl),
            context.ConsentAccepted);

        var result = await inner.SubmitFacialRecordAsync(context, ct);
        sw.Stop();

        if (result.Success)
        {
            logger?.LogInformation(
                "[FacialVerificationDecorator] Completed facial record submission via {Provider} in {ElapsedMs}ms -> Status={Status}, MatchStatus={MatchStatus}",
                ProviderName,
                sw.ElapsedMilliseconds,
                result.VerificationStatus,
                result.FaceMatchStatus);
        }
        else
        {
            logger?.LogWarning(
                "[FacialVerificationDecorator] Rejected facial record submission via {Provider} in {ElapsedMs}ms -> ErrorType={ErrorType}, Message={Error}",
                ProviderName,
                sw.ElapsedMilliseconds,
                result.ErrorType,
                result.ErrorMessage);
        }

        return result with { ExecutionTimeMs = Math.Max(result.ExecutionTimeMs, sw.ElapsedMilliseconds) };
    }
}

public class ResilienceFacialVerificationDecorator(
    IFacialVerificationProvider inner,
    ILogger? logger = null) : IFacialVerificationProvider
{
    public string ProviderName => inner.ProviderName;
    public string ProviderMode => inner.ProviderMode;

    public async Task<FacialVerificationSubmissionResult> SubmitFacialRecordAsync(
        FacialRecordSubmissionContext context,
        CancellationToken ct = default)
    {
        try
        {
            return await inner.SubmitFacialRecordAsync(context, ct);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger?.LogError(ex, "[ResilienceFacialVerificationDecorator] Unhandled fault in provider {Provider}", ProviderName);
            return new FacialVerificationSubmissionResult(
                Success: false,
                ProviderName: ProviderName,
                ProviderMode: ProviderMode,
                VerificationStatus: "Rejected",
                FaceMatchStatus: "PROVIDER_FAULT",
                LivenessStatus: "PROVIDER_FAULT",
                IsFaceMatched: false,
                IsIdentityVerified: false,
                FaceEncryptedFilePath: null,
                EnrolledTemplateBytes: null,
                EnrolledModelIdentifier: null,
                ErrorType: VerificationErrorType.InternalError,
                ErrorMessage: "Facial verification provider encountered an internal storage or processing error.",
                ExecutionTimeMs: 0);
        }
    }
}
