// [Layer: Backend/Data/Models]
// Responsibility: Represents an inter-agency dispatch request between LDRRMO, RHU, BFP, and PNP units.
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

public class DispatchRequestRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string RequestCode { get; set; } = string.Empty;

    [Required, MaxLength(40)]
    public string Direction { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string TargetUnit { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string OriginUnit { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    [Required, MaxLength(32)]
    public string Severity { get; set; } = string.Empty;

    [Required, MaxLength(32)]
    public string Status { get; set; } = "PENDING";

    [MaxLength(255)]
    public string LocationLabel { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

    public Guid? RequestedByUserId { get; set; }

    [Required, MaxLength(150)]
    public string RequestedByName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? RespondedByName { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
