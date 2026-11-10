// [Layer: Backend/Data/Models]
// Responsibility: Defines immutable cryptographic SHA-256 chained audit logs.
// DO NOT tamper with previous hash links. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

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
