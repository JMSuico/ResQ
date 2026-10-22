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
    string? PhoneNumber,
    string? EmployeeOrResidentId,
    string? ValidIdType,
    UserRole Role,
    ResponderUnitType Unit,
    string? DepartmentOrBarangay,
    string? RankOrTitle,
    string? IdCaptureDataUrl,
    string? FaceCaptureDataUrl
);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password,
    string? SelectedTabRole, // Presentation only, actual role determined by user account
    string? PortalOrigin // "Admin" (Port 5174) or "ResponderCivilian" (Port 5173)
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

public record AllocateReportRequest(
    [Required] Guid UnitId
);

public record VerifyReportRequest(
    ReportStatus Status,
    string? AdminNote
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
