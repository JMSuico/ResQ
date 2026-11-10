// [Layer: Backend/Data/Models]
// Responsibility: Defines emergency responder duty units across PNP, BFP, RHU, and LDRRMO.
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;
using Backend.Features.Data.Enums;

namespace Backend.Features.Data.Models;

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
