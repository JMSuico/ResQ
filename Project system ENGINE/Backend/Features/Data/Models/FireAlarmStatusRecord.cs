// [Layer: Backend/Data/Models]
// Responsibility: Defines BFP structural fire alarm level tracking and water supply telemetry.
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

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
