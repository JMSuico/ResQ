// [Layer: Backend/Api/DTOs]
// Responsibility: Encapsulates incoming requests and responses for responder operational telemetry, roster, PCR, blotter, and alarms.
// DO NOT expose raw internal database entities across these contracts.

using System.ComponentModel.DataAnnotations;
using Backend.Features.Data.Enums;

namespace Backend.Features.Api.DTOs;

public record UpdateDutyStatusRequest(
    [Required] DutyStatus Status,
    Guid? UnitId = null,
    string? UnitCode = null
);

public record CreatePcrRequest(
    Guid? ReportId,
    [Required(ErrorMessage = "Patient name is required."), MaxLength(120)] string PatientName,
    [Range(0, 150, ErrorMessage = "Age must be between 0 and 150.")] int Age,
    [Required(ErrorMessage = "Gender is required."), MaxLength(20)] string Gender,
    [Range(0.0, 500.0)] double WeightKg,
    [Required(ErrorMessage = "Level of consciousness is required."), MaxLength(50)] string LevelOfConsciousness,
    int BloodPressureSystolic,
    int BloodPressureDiastolic,
    int HeartRateBpm,
    int RespiratoryRate,
    int SpO2Percent,
    int BloodGlucoseMgDl,
    double TemperatureCelsius,
    List<string>? Interventions,
    List<string>? AnatomicalInjuries,
    [MaxLength(500)] string? ChiefComplaint,
    [MaxLength(2000)] string? Narrative,
    [MaxLength(120)] string? MedicName,
    [MaxLength(50)] string? UnitCode
);

public record PcrResponse(
    Guid Id,
    string PcrReference,
    Guid? ReportId,
    Guid? ResponderUserId,
    string MedicName,
    string UnitCode,
    string PatientName,
    int Age,
    string Gender,
    double WeightKg,
    string LevelOfConsciousness,
    int BloodPressureSystolic,
    int BloodPressureDiastolic,
    int HeartRateBpm,
    int RespiratoryRate,
    int SpO2Percent,
    int BloodGlucoseMgDl,
    double TemperatureCelsius,
    List<string> Interventions,
    List<string> AnatomicalInjuries,
    string ChiefComplaint,
    string Narrative,
    DateTime CreatedAt
);

public record CreateBlotterRequest(
    Guid? ReportId,
    [Required(ErrorMessage = "Incident classification is required."), MaxLength(150)] string IncidentClassification,
    [Required(ErrorMessage = "Complainant name is required."), MaxLength(120)] string ComplainantName,
    [MaxLength(50)] string? ComplainantContact,
    [MaxLength(250)] string? ComplainantAddress,
    [MaxLength(120)] string? SuspectName,
    [MaxLength(500)] string? SuspectDescription,
    [MaxLength(250)] string? Witnesses,
    [Required(ErrorMessage = "Narrative statement is required."), MaxLength(4000)] string NarrativeStatement,
    [Required(ErrorMessage = "Incident location is required."), MaxLength(250)] string IncidentLocation,
    DateTime? IncidentDateTime,
    [MaxLength(120)] string? InvestigatingOfficerName,
    [MaxLength(50)] string? InvestigatingOfficerBadge,
    [MaxLength(100)] string? Station
);

public record BlotterResponse(
    Guid Id,
    string BlotterNumber,
    Guid? ReportId,
    string IncidentClassification,
    string ComplainantName,
    string? ComplainantContact,
    string? ComplainantAddress,
    string? SuspectName,
    string? SuspectDescription,
    string? Witnesses,
    string NarrativeStatement,
    string IncidentLocation,
    DateTime IncidentDateTime,
    string InvestigatingOfficerName,
    string InvestigatingOfficerBadge,
    string Station,
    string CryptographicSeal,
    DateTime CreatedAt
);

public record SetAlarmLevelRequest(
    Guid? ReportId,
    [Required(ErrorMessage = "Alarm level is required."), MaxLength(80)] string AlarmLevel,
    [MaxLength(100)] string? BuildingType,
    int TrappedOccupantsCount,
    [MaxLength(120)] string? CommanderName,
    [MaxLength(50)] string? ReportingUnit,
    [MaxLength(500)] string? Remarks,
    int WaterSupplyGallons
);

public record AlarmLevelResponse(
    Guid Id,
    Guid? ReportId,
    string AlarmLevel,
    string BuildingType,
    int TrappedOccupantsCount,
    string CommanderName,
    string ReportingUnit,
    string Remarks,
    int WaterSupplyGallons,
    DateTime UpdatedAt
);

public record HydrantResponse(
    Guid Id,
    string FixtureCode,
    string Title,
    string Description,
    double Latitude,
    double Longitude,
    int FlowRateGpm,
    string FlowClass,
    bool IsActive
);
