// [Layer: Backend/Data/Models]
// Responsibility: Audits credential and biometric authentication attempts, enforces brute-force lockout, and protects against automated probing.
// Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

public class LoginAttempt
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(180)]
    public string AccountIdentifier { get; set; } = string.Empty;

    [Required, MaxLength(30)]
    public string AttemptType { get; set; } = "PASSWORD"; // PASSWORD, BIOMETRIC_1TO1

    public bool Success { get; set; } = false;

    [MaxLength(100)]
    public string? FailureReason { get; set; }

    [MaxLength(60)]
    public string IpAddress { get; set; } = "127.0.0.1";

    [MaxLength(300)]
    public string? UserAgent { get; set; }

    public DateTime AttemptedAtUtc { get; set; } = DateTime.UtcNow;
}
