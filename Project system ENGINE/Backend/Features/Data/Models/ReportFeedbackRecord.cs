// [Layer: Backend/Data/Models]
// Responsibility: Represents post-response civilian or agency feedback and rating for an incident report.
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

public class ReportFeedbackRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ReportId { get; set; }

    public Guid UserId { get; set; }

    public int Rating { get; set; }

    [MaxLength(1000)]
    public string Comment { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
