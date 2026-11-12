// [Layer: Backend/Api/DTOs]
// Responsibility: Encapsulates incoming HTTP request contracts for authentication, reporting, and triage.
// DO NOT expose internal entity state directly through request parameters.

using System.ComponentModel.DataAnnotations;
using Backend.Features.Data.Enums;

namespace Backend.Features.Api.DTOs;

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(12)] string Password,
    [Required] string FullName,
    string? PhoneNumber = null,
    string? EmployeeOrResidentId = null,
    string? ValidIdType = null,
    UserRole Role = UserRole.Civilian,
    ResponderUnitType Unit = ResponderUnitType.None,
    string? DepartmentOrBarangay = null,
    string? RankOrTitle = null,
    string? IdCaptureDataUrl = null,
    string? IdBackCaptureDataUrl = null,
    string? FaceCaptureDataUrl = null,
    string? Sex = null,
    int? Age = null,
    string? GovernmentIdType = null,
    string? GovernmentIdNumber = null,
    string? FirstName = null,
    string? MiddleName = null,
    string? Surname = null,
    string? Suffix = null,
    DateTime? DateOfBirth = null,
    string? Province = null,
    string? CityOrMunicipality = null,
    string? Barangay = null,
    string? StreetOrPurok = null,
    string? Weight = null,
    string? Height = null,
    string? ConsentNoticeVersion = null,
    float[]? BiometricDescriptorVector = null,
    double? OcrConfidenceScore = null,
    string? DocumentVersion = null,
    string? IssuingAgency = null,
    string? DetectedSide = null,
    string? DocumentCheckStatus = null,
    string? OfficialVerificationStatus = null,
    string? FieldProvenanceJson = null,
    string? DisplayName = null,
    string? ConfirmPassword = null,
    bool? ConsentAccepted = null,
    int? MinImageDimension = null
);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password,
    string? SelectedTabRole = null, // Presentation only, actual role determined by user account
    string? PortalOrigin = null // "Admin" (Port 1996) or "ResponderCivilian" (Port 1997/1998)
);

public record BiometricLoginRequest(
    [Required, EmailAddress] string Email,
    [Required] float[] LiveDescriptorVector,
    string? PortalOrigin = null
);

public record CreateReportRequest(
    [Required] string Title,
    string? Note,
    IncidentCategory Category,
    IncidentSeverity Severity,
    double Latitude,
    double Longitude,
    double? GpsAccuracyMeters,
    bool? IsHardwareGeolocated,
    bool? IsBlurry,
    bool? RequiresManualVerification,
    string? LocationLabel,
    string? ImageDataUrl
);

public record DistressBeaconRequest(
    double Latitude,
    double Longitude,
    double? GpsAccuracyMeters = null,
    long? Timestamp = null
);

public record AllocateReportRequest(
    Guid? UnitId = null,
    Guid? ResponderId = null
);

public record VerifyReportRequest(
    ReportStatus Status,
    string? AdminNote = null,
    IncidentSeverity? Severity = null
);

public record UpdateSeverityRequest(
    IncidentSeverity Severity
);

public record CreateAlertBroadcastRequest(
    [Required] string Title,
    [Required] string Message,
    string? Severity = null,
    string? ExternalLink = null,
    bool? HasImage = false,
    bool? HasVideo = false
);

public record UpdateProfileRequest(
    string? FirstName = null,
    string? MiddleName = null,
    string? Surname = null,
    string? Suffix = null,
    string? FullName = null,
    string? PhoneNumber = null,
    string? Province = null,
    string? CityOrMunicipality = null,
    string? Barangay = null,
    string? StreetOrPurok = null,
    string? EmergencyContactName = null,
    string? EmergencyContactPhone = null,
    string? EmergencyContactRelationship = null,
    string? BloodType = null,
    string? Sex = null,
    DateTime? DateOfBirth = null,
    string? DepartmentOrBarangay = null,
    string? RankOrTitle = null,
    string? EmployeeOrResidentId = null,
    string? GovernmentIdType = null,
    string? GovernmentIdNumber = null,
    string? DisplayName = null
);

public record UpdateUserStatusRequest(
    AccountStatus Status
);

public record UpdateUnitStatusRequest(
    DutyStatus Status
);

public record UpdateSettingRequest(
    [Required] string Value
);
