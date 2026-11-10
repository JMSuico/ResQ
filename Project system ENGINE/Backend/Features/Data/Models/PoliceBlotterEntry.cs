// [Layer: Backend/Data/Models]
// Responsibility: Defines PNP official electronic blotter records with cryptographic seal.
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

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
