// [Layer: Backend/Data/Models]
// Responsibility: Represents encrypted evidence media attached to an emergency incident report.
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

public class ReportEvidenceRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ReportId { get; set; }

    [Required, MaxLength(500)]
    public string FilePath { get; set; } = string.Empty;

    [Required, MaxLength(32)]
    public string MediaType { get; set; } = "image";

    [MaxLength(500)]
    public string Caption { get; set; } = string.Empty;

    public Guid? UploadedByUserId { get; set; }

    [MaxLength(150)]
    public string UploadedByName { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
