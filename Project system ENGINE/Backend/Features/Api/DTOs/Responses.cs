// [Layer: Backend/Api/DTOs]
// Responsibility: Encapsulates outgoing JSON response contracts for frontend consumption.
// DO NOT expose password hashes or sensitive internal salt strings.

using Backend.Features.Data.Enums;

namespace Backend.Features.Api.DTOs;

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
    string TargetDashboardUrl
);

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
    string DepartmentOrBarangay,
    string RankOrTitle,
    DateTime CreatedAt,
    string? FullAddress = null,
    string? PhoneNumber = null
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
    string? RecommendedAgencyUnit = null
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
