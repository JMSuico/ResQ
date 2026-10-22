// [Layer: Backend/Data/Models]
// Responsibility: Represents active user session tokens, client telemetry, and revocation status.
// DO NOT expose raw session secret tokens without hashing.

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Backend.Features.Data.Enums;

namespace Backend.Features.Data.Models;

public class Session
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    [Required, MaxLength(128)]
    public string TokenHash { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    public ResponderUnitType Unit { get; set; }

    [MaxLength(60)]
    public string IpAddress { get; set; } = "127.0.0.1";

    [MaxLength(255)]
    public string UserAgent { get; set; } = string.Empty;

    public bool IsRevoked { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);
}
