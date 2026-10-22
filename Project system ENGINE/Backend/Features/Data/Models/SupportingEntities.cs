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
