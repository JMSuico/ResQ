// [Layer: Backend/Api/DTOs]
// Responsibility: Data Transfer Objects for AI standby ID document extraction, Claude Sonnet hybrid OCR, and facial geometry analysis.
// Invariant: C# .NET 10 Web API standards, nullable reference types enabled, universal lambda expressions (=>).

namespace Backend.Features.Api.DTOs;

/// <summary>
/// Payload submitted for AI-assisted optical character recognition and identity classification.
/// </summary>
public class AiExtractRequestDto
{
    public string ImageDataUrl { get; set; } = string.Empty;
    public string? FrontImageBase64 { get; set; }
    public string? BackImageBase64 { get; set; }
    public string? HintType { get; set; }
    public string? IdType { get; set; }
    public string? PreferredProvider { get; set; }
}

/// <summary>
/// Individual identity field holding textual value and normalized confidence score (0.0 to 1.0).
/// </summary>
public class ExtractedFieldDto
{
    public string Value { get; set; } = string.Empty;
    public double Confidence { get; set; } = 1.0;

    public ExtractedFieldDto() { }

    public ExtractedFieldDto(string value, double confidence = 1.0) =>
        (Value, Confidence) = (value, confidence);
}

/// <summary>
/// Standard response envelope returning extracted fields, provider diagnostics, and performance telemetry.
/// </summary>
public class AiExtractResponseDto
{
    public bool Success { get; set; } = false;
    public string ProviderUsed { get; set; } = string.Empty;
    public string? IdType { get; set; }
    public double Confidence { get; set; } = 0.0;
    public bool IsAuthentic { get; set; } = false;
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string? Surname { get; set; }
    public string? Suffix { get; set; }
    public string? FullName { get; set; }
    public string? DateOfBirth { get; set; }
    public string? Age { get; set; }
    public string? Sex { get; set; }
    public string? LicenseNumber { get; set; }
    public string? IdNumber { get; set; }
    public string? ExpirationDate { get; set; }
    public string? Barangay { get; set; }
    public string? Street { get; set; }
    public string? CityOrMunicipality { get; set; }
    public string? Province { get; set; }
    public string? Address { get; set; }
    public string? Weight { get; set; }
    public string? Height { get; set; }
    public string? PhoneNumber { get; set; }
    public Dictionary<string, ExtractedFieldDto> ExtractedFields { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, ExtractedFieldDto> Fields => ExtractedFields;
    public string? RawText { get; set; }
    public string? ModelUsed { get; set; }
    public string? IdVerificationToken { get; set; }
    public string? DetectedIdType { get; set; }
    public string? DetectedIdLabel { get; set; }
    public bool MatchesSelectedIdType { get; set; } = true;
    public string? FrontSlotDetectedSide { get; set; }
    public string? BackSlotDetectedSide { get; set; }
    public bool AreSidesIdentical { get; set; } = false;
    public string? AuthenticityVerdict { get; set; }
    public string? AuthenticityReason { get; set; }
    public bool RequiresPendingManualReview { get; set; } = false;
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public List<string> Warnings { get; set; } = [];
    public long ExecutionTimeMs { get; set; }
    public List<RoboflowWorkflowPredictionItemDto> RoboflowIdPredictions { get; set; } = [];
    public string? RoboflowDetectedClass { get; set; }
    public double? RoboflowDetectedConfidence { get; set; }
    public bool RoboflowCacheHit { get; set; }
    public string? RoboflowDataset { get; set; }
    public bool ClaudeTrainingCacheActive { get; set; }
}

/// <summary>
/// Extracted visible-only Philippine Government ID fields container used by shared forensics evaluators.
/// </summary>
public class AiOcrFieldsDto
{
    public string? IdType { get; set; }
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string? Surname { get; set; }
    public string? Suffix { get; set; }
    public string? FullName { get; set; }
    public string? DateOfBirth { get; set; }
    public string? Age { get; set; }
    public string? Sex { get; set; }
    public string? LicenseNumber { get; set; }
    public string? IdNumber { get; set; }
    public string? ExpirationDate { get; set; }
    public string? Barangay { get; set; }
    public string? Street { get; set; }
    public string? CityOrMunicipality { get; set; }
    public string? Province { get; set; }
    public string? Address { get; set; }
    public string? Weight { get; set; }
    public string? Height { get; set; }
    public string? PhoneNumber { get; set; }
    public string? RawText { get; set; }
    public Dictionary<string, ExtractedFieldDto> ExtractedFields { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

/// <summary>
/// Dedicated response DTO for Claude Sonnet Hybrid Structural OCR extraction.
/// </summary>
public class AiOcrResponseDto : AiExtractResponseDto
{
}

/// <summary>
/// Telemetry DTO communicating availability of configured cloud vision providers without exposing secret keys.
/// </summary>
public class AiProviderStatusDto
{
    public bool ClaudeConfigured { get; set; }
    public bool GeminiConfigured { get; set; }
    public bool OpenAiConfigured { get; set; }
    public bool AzureConfigured { get; set; }
    public bool RoboflowConfigured { get; set; }
    public bool RoboflowFaceWorkflowConfigured { get; set; }
    public bool RoboflowIdWorkflowConfigured { get; set; }
    public bool HasAnyProvider => ClaudeConfigured || GeminiConfigured || OpenAiConfigured || AzureConfigured || RoboflowConfigured;
    public string ActiveChain { get; set; } = string.Empty;
}

/// <summary>
/// Bounding box prediction item returned by Roboflow Serverless Workflow / Pretrained Dataset inference.
/// </summary>
public class RoboflowWorkflowPredictionItemDto
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public int? ImageWidth { get; set; }
    public int? ImageHeight { get; set; }
}

/// <summary>
/// Request payload for Roboflow Serverless Workflow face ("face") or Philippine ID ("driver, postal, umid") detection.
/// </summary>
public class RoboflowWorkflowDetectRequestDto
{
    public string? ImageDataUrl { get; set; }
    public string? ImageBase64 { get; set; }
    public string? SelectedIdType { get; set; }
    public string? Classes { get; set; }
}

/// <summary>
/// Response envelope for Roboflow Serverless Workflow detection paired with Claude pretrained dataset cache state.
/// </summary>
public class RoboflowWorkflowDetectResponseDto
{
    public bool Success { get; set; }
    public bool RanOnline { get; set; }
    public bool CacheHit { get; set; }
    public int CacheTtlSeconds { get; set; } = 900;
    public string TaskType { get; set; } = string.Empty;
    public string DatasetSlug { get; set; } = string.Empty;
    public string RequestedClasses { get; set; } = string.Empty;
    public string? TopClass { get; set; }
    public double TopConfidence { get; set; }
    public string? CanonicalIdType { get; set; }
    public string AuthTransport { get; set; } = string.Empty;
    public string TransportMode { get; set; } = string.Empty;
    public bool ClaudeTrainingCacheActive { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public List<RoboflowWorkflowPredictionItemDto> Predictions { get; set; } = [];
}

/// <summary>
/// Request payload for template-aware Philippine Government ID recognition and provenance analysis.
/// </summary>
public class IdentityDocumentAnalyzeRequestDto
{
    public string? SelectedIdCategory { get; set; }
    public string? ManualTemplateOverride { get; set; }
    public string? FrontRawText { get; set; }
    public string? BackRawText { get; set; }
    public string? FrontImageDataUrl { get; set; }
    public string? BackImageDataUrl { get; set; }
    public Dictionary<string, string?>? ExtractedFields { get; set; }
}

/// <summary>
/// Structured response returning Philippine ID classification, version/side detection, and calibrated provenance.
/// </summary>
public class IdentityDocumentAnalyzeResponseDto
{
    public string DocumentFamily { get; set; } = string.Empty;
    public string CategoryKey { get; set; } = "unknown";
    public string Issuer { get; set; } = string.Empty;
    public string Version { get; set; } = "unknown";
    public string DetectedSide { get; set; } = "unknown";
    public string TemplateId { get; set; } = "UNKNOWN";
    public double CalibratedConfidence { get; set; }
    public string OverallStatus { get; set; } = "OCR_NEEDS_REVIEW";
    public string OfficialVerificationStatus { get; set; } = "not_checked";
    public bool AllowBiometricProfiling { get; set; } = true;
    public List<string> Warnings { get; set; } = [];
    public Dictionary<string, string> NormalizedFields { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

/// <summary>
/// Request payload for Claude Vision 4-Pose Facial Geometry & Pattern Analysis.
/// </summary>
public class FacialGeometryAnalysisRequestDto
{
    public string? CenterFrameBase64 { get; set; }
    public string? RightFrameBase64 { get; set; }
    public string? LeftFrameBase64 { get; set; }
    public string? BlinkFrameBase64 { get; set; }
    public string? CenterFrameDataUrl { get; set; }
    public string? RightFrameDataUrl { get; set; }
    public string? LeftFrameDataUrl { get; set; }
    public string? BlinkFrameDataUrl { get; set; }
    public int TotalCachedFrames { get; set; }
    public int SamplingFps { get; set; }
    public int? BlurVariance { get; set; }
    public List<double>? ClientDescriptorVector { get; set; }
    public List<double>? DescriptorVector { get; set; }
    public string? GeometricSignatureJson { get; set; }
    public string? PoseFramesJson { get; set; }
    public string? FrontIdImageBase64 { get; set; }
    public string? FrontIdDataUrl { get; set; }
    public string? IdVerificationToken { get; set; }
}

/// <summary>
/// Response payload for Claude Vision 4-Pose Facial Geometry & Pattern Analysis.
/// </summary>
public class FacialGeometryAnalysisResponseDto
{
    public bool IsValidFaceGeometry { get; set; }
    public string StrategyName { get; set; } = "ClaudeVisionFacialBiometricStrategy";
    public string ProviderUsed { get; set; } = "claude-sonnet-4-6";
    public double LivenessConfidence { get; set; }
    public double OvalCenterAlignmentScore { get; set; }
    public double YawRightAngleDeg { get; set; }
    public double YawLeftAngleDeg { get; set; }
    public double BlinkEarDelta { get; set; }
    public string GeometricPatternHash { get; set; } = string.Empty;
    public string AnthropometricRatiosJson { get; set; } = "{}";
    public Dictionary<string, double> GeometricRatios { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string GeometricSignatureJson { get; set; } = "{}";
    public List<double> NormalizedDescriptor128D { get; set; } = new();
    public string Summary { get; set; } = string.Empty;
    public bool IsLiveHuman { get; set; }
    public bool IsFaceMatchedToId { get; set; }
    public double FaceToIdSimilarity { get; set; }
    public string? FacialVerificationToken { get; set; }
    public bool IsAutoApproveEligible { get; set; }
    public bool RequiresPendingManualReview { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public List<RoboflowWorkflowPredictionItemDto> RoboflowFacePredictions { get; set; } = [];
    public double? RoboflowFaceConfidence { get; set; }
    public bool RoboflowCacheHit { get; set; }
    public string? RoboflowDataset { get; set; }
    public bool ClaudeTrainingCacheActive { get; set; }
}
