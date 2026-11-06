// [Layer: Backend/Data/Models]
// Responsibility: Defines static infrastructure fixtures, responder duty units, settings, alerts, and audit logs.
// DO NOT tamper with previous hash links in AuditLog.

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Backend.Features.Data.Enums;

namespace Backend.Features.Data.Models;

public class IncidentFixture
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string FixtureCode { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    public IncidentCategory Category { get; set; } = IncidentCategory.HazardFixture;

    public IncidentSeverity Severity { get; set; } = IncidentSeverity.Low;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public ResponderUnitType AssignedUnitType { get; set; } = ResponderUnitType.None;

    public bool IsActive { get; set; } = true;

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class DutyUnit
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string UnitCode { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string UnitName { get; set; } = string.Empty;

    public ResponderUnitType Agency { get; set; } = ResponderUnitType.RHU;

    [MaxLength(120)]
    public string CommanderName { get; set; } = string.Empty;

    public DutyStatus Status { get; set; } = DutyStatus.OnDuty;

    public double BaseLatitude { get; set; }

    public double BaseLongitude { get; set; }

    [MaxLength(50)]
    public string ContactHotline { get; set; } = string.Empty;

    public int ActivePersonnelCount { get; set; } = 4;

    [MaxLength(80)]
    public string ShiftSchedule { get; set; } = "08:00 - 20:00 (Alpha)";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Report> AllocatedReports { get; set; } = new List<Report>();
}

public class Settings
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string Key { get; set; } = string.Empty;

    [Required]
    public string Value { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Category { get; set; } = "General";

    [MaxLength(255)]
    public string Description { get; set; } = string.Empty;

    public Guid? UpdatedByUserId { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class AlertReadState
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public Guid ReportId { get; set; }

    public Report? Report { get; set; }

    public bool IsRead { get; set; } = false;

    public DateTime? ReadAt { get; set; }
}

public class AuditLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? ActorUserId { get; set; }

    [Required, MaxLength(100)]
    public string Action { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string TargetEntity { get; set; } = string.Empty;

    public string Payload { get; set; } = string.Empty;

    [Required, MaxLength(128)]
    public string PreviousHash { get; set; } = "0000000000000000000000000000000000000000000000000000000000000000";

    [Required, MaxLength(128)]
    public string CurrentHash { get; set; } = string.Empty;

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class PatientCareRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string PcrReference { get; set; } = string.Empty;

    public Guid? ReportId { get; set; }

    public Guid? ResponderUserId { get; set; }

    [Required, MaxLength(120)]
    public string MedicName { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string UnitCode { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string PatientName { get; set; } = string.Empty;

    public int Age { get; set; }

    [Required, MaxLength(20)]
    public string Gender { get; set; } = string.Empty;

    public double WeightKg { get; set; }

    [Required, MaxLength(50)]
    public string LevelOfConsciousness { get; set; } = "Alert";

    public int BloodPressureSystolic { get; set; }

    public int BloodPressureDiastolic { get; set; }

    public int HeartRateBpm { get; set; }

    public int RespiratoryRate { get; set; }

    public int SpO2Percent { get; set; }

    public int BloodGlucoseMgDl { get; set; }

    public double TemperatureCelsius { get; set; }

    public string InterventionsJson { get; set; } = "[]";

    public string AnatomicalInjuriesJson { get; set; } = "[]";

    [MaxLength(500)]
    public string ChiefComplaint { get; set; } = string.Empty;

    public string Narrative { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class PoliceBlotterEntry
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string BlotterNumber { get; set; } = string.Empty;

    public Guid? ReportId { get; set; }

    [Required, MaxLength(150)]
    public string IncidentClassification { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string ComplainantName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? ComplainantContact { get; set; }

    [MaxLength(250)]
    public string? ComplainantAddress { get; set; }

    [MaxLength(120)]
    public string? SuspectName { get; set; }

    [MaxLength(500)]
    public string? SuspectDescription { get; set; }

    [MaxLength(250)]
    public string? Witnesses { get; set; }

    [Required]
    public string NarrativeStatement { get; set; } = string.Empty;

    [Required, MaxLength(250)]
    public string IncidentLocation { get; set; } = string.Empty;

    public DateTime IncidentDateTime { get; set; } = DateTime.UtcNow;

    [Required, MaxLength(120)]
    public string InvestigatingOfficerName { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string InvestigatingOfficerBadge { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Station { get; set; } = "Dipolog City Police Station";

    [Required, MaxLength(128)]
    public string CryptographicSeal { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class FireAlarmStatusRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? ReportId { get; set; }

    [Required, MaxLength(80)]
    public string AlarmLevel { get; set; } = "1st Alarm";

    [Required, MaxLength(100)]
    public string BuildingType { get; set; } = "Residential";

    public int TrappedOccupantsCount { get; set; }

    [Required, MaxLength(120)]
    public string CommanderName { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string ReportingUnit { get; set; } = "BFP-ALPHA";

    [MaxLength(500)]
    public string Remarks { get; set; } = string.Empty;

    public int WaterSupplyGallons { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
