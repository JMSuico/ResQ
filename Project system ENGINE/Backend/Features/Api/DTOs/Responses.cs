// [Layer: Backend/Api/DTOs]
// Responsibility: Encapsulates outgoing JSON response contracts for frontend consumption.
// DO NOT expose password hashes or sensitive internal salt strings.

using Backend.Features.Data.Enums;

namespace Backend.Features.Api.DTOs;

public record RegistrationResponse(
    string Message,
    Guid UserId,
    string Email,
    string DisplayName,
    string FullName,
    UserRole Role,
    ResponderUnitType Unit,
    string Status,
    bool FaceVerified,
    string IdentityVerificationStatus,
    string FacialVerificationStatus,
    string IdentityVerificationProvider,
    string FacialVerificationProvider,
    bool HasIdFrontCapture,
    bool HasIdBackCapture,
    bool HasFaceCapture,
    DateTime CreatedAt,
    bool AutoApprovedByAi = false,
    string? AutoApprovalReason = null,
    string? BiometricTrainingStatus = null,
    DateTime? BiometricTrainingReadyTargetUtc = null,
    int TrainedFrameCount = 0
);

public record SessionResponse(
    Guid UserId,
    string FullName,
    string Email,
    string EmployeeOrResidentId,
    UserRole Role,
    ResponderUnitType Unit,
    AccountStatus Status,
    bool FaceVerified,
    string? DepartmentOrBarangay,
    string? RankOrTitle,
    string TargetDashboardUrl,
    string DisplayName = "",
    string IdentityVerificationStatus = "PendingReview",
    string FacialVerificationStatus = "PendingReview",
    string ValidationVerdict = "SUCCESS_LOGIN",
    string? BiometricStrategyUsed = null,
    object? ValidationLayers = null
)
{
    public string ValidationVerdict { get; set; } = ValidationVerdict;
    public string? BiometricStrategyUsed { get; set; } = BiometricStrategyUsed;
    public object? ValidationLayers { get; set; } = ValidationLayers;
}

public record LoginResponse(
    Guid UserId,
    string FullName,
    string Email,
    string EmployeeOrResidentId,
    UserRole Role,
    ResponderUnitType Unit,
    AccountStatus Status,
    bool FaceVerified,
    string? DepartmentOrBarangay,
    string? RankOrTitle,
    string TargetDashboardUrl,
    string DisplayName = "",
    string IdentityVerificationStatus = "PendingReview",
    string FacialVerificationStatus = "PendingReview",
    string ValidationVerdict = "SUCCESS_LOGIN",
    string? BiometricStrategyUsed = null,
    object? ValidationLayers = null
) : SessionResponse(
    UserId,
    FullName,
    Email,
    EmployeeOrResidentId,
    Role,
    Unit,
    Status,
    FaceVerified,
    DepartmentOrBarangay,
    RankOrTitle,
    TargetDashboardUrl,
    DisplayName,
    IdentityVerificationStatus,
    FacialVerificationStatus,
    ValidationVerdict,
    BiometricStrategyUsed,
    ValidationLayers);

public record UserResponse(
    Guid Id,
    string FullName,
    string Email,
    string EmployeeOrResidentId,
    UserRole Role,
    ResponderUnitType Unit,
    AccountStatus Status,
    bool FaceVerified,
    bool HasIdCapture,
    bool HasFaceCapture,
    string? DepartmentOrBarangay,
    string RankOrTitle,
    DateTime CreatedAt,
    string? FullAddress = null,
    string? PhoneNumber = null,
    string DisplayName = "",
    string IdentityVerificationStatus = "PendingReview",
    string FacialVerificationStatus = "PendingReview",
    bool HasIdBackCapture = false,
    bool IsCliProtectedSuperAdmin = false
);

public record ReportResponse(
    Guid Id,
    string ReferenceCode,
    Guid ReporterId,
    string ReporterName,
    UserRole ReporterRole,
    string Title,
    string Note,
    IncidentCategory Category,
    IncidentSeverity Severity,
    ReportStatus Status,
    double Latitude,
    double Longitude,
    string LocationLabel,
    bool HasImage,
    string? ImageUrl,
    Guid? AllocatedUnitId,
    string? AllocatedUnitCode,
    DateTime CreatedAt,
    DateTime? VerifiedAt,
    DateTime? ResolvedAt,
    double? GpsAccuracyMeters = null,
    bool IsHardwareGeolocated = false,
    bool IsBlurry = false,
    bool RequiresManualVerification = false,
    string? RecommendedAgencyUnit = null,
    double? CurrentLatitude = null,
    double? CurrentLongitude = null,
    DateTime? LastBeaconAt = null,
    int BeaconCount = 0,
    string? SubmittedIpAddress = null,
    string? ReporterContactNumber = null,
    string? RoboflowModelId = null,
    string? RoboflowPrediction = null,
    double? RoboflowConfidence = null,
    bool RoboflowNeedsReview = true,
    string? ClaudeModelUsed = null,
    string? ClaudeIncidentCategory = null,
    string? ClaudeSituationSummary = null,
    string? ClaudeVisibleHazards = null,
    string? ClaudeUncertaintyNotes = null,
    string? PointerIconType = null,
    bool AiAutoApproved = false,
    string AiVerificationStatus = "AWAITING_MANUAL_REVIEW",
    int? FeedbackRating = null,
    string? FeedbackComment = null,
    DateTime? ClosedAt = null,
    string? ClosureSummary = null,
    string? ClosureApprovalMode = null,
    List<TaggedColleagueDto>? TaggedColleagues = null
);

public record TaggedColleagueDto(
    Guid UserId,
    string FullName,
    string Unit,
    string RankOrTitle
);

public record ReportEvidenceResponse(
    Guid Id,
    Guid ReportId,
    string Url,
    string MediaType,
    string Caption,
    string UploadedByName,
    DateTime CreatedAtUtc,
    string ClosureOutcome = "",
    string AiVerdict = "",
    string AiReasoning = "",
    List<TaggedColleagueDto>? TaggedColleagues = null,
    Guid? ApprovedByUserId = null,
    DateTime? ApprovedAtUtc = null
);

public record ClosureEvidenceSubmissionResponse(
    bool Success,
    string Message,
    string Verdict,
    bool AutoApproved,
    string ApprovalMode,
    ReportStatus ReportStatus,
    string AiReasoning,
    string ModelUsed,
    ReportResponse Report,
    ReportEvidenceResponse Evidence
);

public record ColleagueResponderDto(
    Guid Id,
    string FullName,
    string DisplayName,
    string Email,
    ResponderUnitType Unit,
    string RankOrTitle,
    string EmployeeOrResidentId
);

public record ReportFeedbackResponse(
    Guid Id,
    Guid ReportId,
    Guid UserId,
    int Rating,
    string Comment,
    DateTime CreatedAtUtc
);

public sealed record IncidentImageAiAnalysisResponseDto(
    string RoboflowModelId,
    string RoboflowPrediction,
    double RoboflowConfidence,
    bool RoboflowNeedsReview,
    string RoboflowAuthTransport,
    string ClaudeModelUsed,
    bool IsGenuineIncident,
    string DetectedCategory,
    string RecommendedSeverity,
    string PointerIconType,
    string SituationDescription,
    string VisibleHazards,
    string UncertaintyNotes,
    string VerificationStatus,
    string RecommendedAgencyUnit,
    bool AutoApproveEligible = false,
    string AiVerificationStatus = "PENDING_REVIEW",
    bool ClaudeRanOnline = false
);

public sealed record AiAutoApproveReportResult(
    bool AutoApproved,
    ReportStatus Status,
    string AiVerificationStatus,
    string Message,
    ReportResponse? Report = null,
    bool NotFound = false
);

public record DutyUnitResponse(
    Guid Id,
    string UnitCode,
    string UnitName,
    ResponderUnitType Agency,
    string CommanderName,
    DutyStatus Status,
    double BaseLatitude,
    double BaseLongitude,
    string ContactHotline,
    int ActivePersonnelCount,
    string ShiftSchedule,
    DateTime UpdatedAt
);

public record IncidentFixtureResponse(
    Guid Id,
    string FixtureCode,
    string Title,
    IncidentCategory Category,
    IncidentSeverity Severity,
    double Latitude,
    double Longitude,
    ResponderUnitType AssignedUnitType,
    bool IsActive,
    string Description
);

public record AlertResponse(
    Guid ReportId,
    string ReferenceCode,
    string Title,
    IncidentCategory Category,
    IncidentSeverity Severity,
    ReportStatus Status,
    DateTime Timestamp,
    bool IsRead,
    bool HasImage,
    string? ImageUrl
);

public record SettingResponse(
    Guid Id,
    string Key,
    string Value,
    string Category,
    string Description,
    DateTime UpdatedAt
);

public sealed record BiometricTrainingStatusDto(
    string Email,
    bool Exists,
    bool Found,
    bool HasBiometricEnrollment,
    string TrainingStatus,
    string BiometricTrainingStatus,
    bool IsReady,
    bool Ready,
    DateTime? ReadyTargetUtc,
    DateTime? BiometricTrainingReadyTargetUtc,
    DateTime? CompletedAtUtc,
    int RemainingSeconds,
    int RemainingMinutes,
    int TrainedFrameCount,
    string Message
);

