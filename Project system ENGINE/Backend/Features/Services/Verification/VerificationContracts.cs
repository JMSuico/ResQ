// [Layer: Backend/Services/Verification]
// Responsibility: Defines Strategy Pattern and Decorator Pattern contracts, submission contexts, and structured verification results for Government ID and Facial Record verification.
// Compliance: Universal lambda expressions (=>). Zero emojis.

namespace Backend.Features.Services.Verification;

public enum VerificationErrorType
{
    None = 0,
    ValidationError = 400,
    ForbiddenRole = 403,
    DuplicateEmail = 409,
    PayloadTooLarge = 413,
    UnsupportedMediaType = 415,
    UnprocessableEntity = 422,
    InternalError = 500
}

public class VerificationProviderOptions
{
    public const string SectionName = "VerificationProviders";

    public string IdentityProvider { get; set; } = "Manual";
    public string FacialProvider { get; set; } = "Manual";
    public int MaxUploadSizeBytes { get; set; } = 5 * 1024 * 1024;
    public int MinImageWidth { get; set; } = 1;
    public int MinImageHeight { get; set; } = 1;
    public int MaxImageWidth { get; set; } = 8192;
    public int MaxImageHeight { get; set; } = 8192;
    public bool RequireBothIdSides { get; set; } = false;
    public bool RequireFacialCapture { get; set; } = false;
}

public record IdentityDocumentSubmissionContext(
    string Email,
    string? GovernmentIdType,
    string? GovernmentIdNumber,
    string? FrontImageDataUrl,
    string? BackImageDataUrl,
    string CapturesRootPath,
    int MinWidth = 1,
    int MinHeight = 1,
    int MaxWidth = 8192,
    int MaxHeight = 8192,
    int MaxUploadSizeBytes = 5 * 1024 * 1024,
    bool RequireFront = false,
    bool RequireBothSides = false
);

public record IdentityVerificationSubmissionResult(
    bool Success,
    string ProviderName,
    string ProviderMode,
    string VerificationStatus,
    string DocumentCheckStatus,
    bool IsAuthenticityVerified,
    string? FrontEncryptedFilePath,
    string? BackEncryptedFilePath,
    double ConfidenceScore = 0.0,
    string NormalizedFieldsJson = "{}",
    VerificationErrorType ErrorType = VerificationErrorType.None,
    string? ErrorMessage = null,
    long ExecutionTimeMs = 0
);

public record FacialRecordSubmissionContext(
    string Email,
    string? FaceCaptureDataUrl,
    bool ConsentAccepted,
    string? ConsentNoticeVersion,
    float[]? OptionalDescriptorVector,
    string CapturesRootPath,
    int MinWidth = 1,
    int MinHeight = 1,
    int MaxWidth = 8192,
    int MaxHeight = 8192,
    int MaxUploadSizeBytes = 5 * 1024 * 1024,
    bool RequireFacialCapture = false
);

public record FacialVerificationSubmissionResult(
    bool Success,
    string ProviderName,
    string ProviderMode,
    string VerificationStatus,
    string FaceMatchStatus,
    string LivenessStatus,
    bool IsFaceMatched,
    bool IsIdentityVerified,
    string? FaceEncryptedFilePath,
    byte[]? EnrolledTemplateBytes = null,
    string? EnrolledModelIdentifier = null,
    VerificationErrorType ErrorType = VerificationErrorType.None,
    string? ErrorMessage = null,
    long ExecutionTimeMs = 0
);

public interface IIdentityVerificationProvider
{
    string ProviderName { get; }
    string ProviderMode { get; }
    Task<IdentityVerificationSubmissionResult> SubmitIdentityDocumentAsync(
        IdentityDocumentSubmissionContext context,
        CancellationToken ct = default);
}

public interface IFacialVerificationProvider
{
    string ProviderName { get; }
    string ProviderMode { get; }
    Task<FacialVerificationSubmissionResult> SubmitFacialRecordAsync(
        FacialRecordSubmissionContext context,
        CancellationToken ct = default);
}

public interface IVerificationProviderResolver
{
    IIdentityVerificationProvider ResolveIdentityProvider(string? providerKey = null);
    IFacialVerificationProvider ResolveFacialProvider(string? providerKey = null);
    IReadOnlyList<string> GetAvailableIdentityProviders();
    IReadOnlyList<string> GetAvailableFacialProviders();
}
