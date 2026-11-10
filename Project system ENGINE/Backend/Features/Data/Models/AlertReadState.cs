// [Layer: Backend/Data/Models]
// Responsibility: Tracks per-user read/unread status for tactical emergency alerts.
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

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
