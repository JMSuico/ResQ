// [Layer: Backend/Data/Models]
// Responsibility: Persists HMAC-SHA256 verification token lifecycle records for replay prevention, paired ID-to-facial linkage, and audit provenance.
// Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

public class VerificationTokenRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(64)]
    public string TokenId { get; set; } = string.Empty;

    [Required, MaxLength(16)]
    public string TokenType { get; set; } = string.Empty;

    [Required, MaxLength(128)]
    public string ImagePairSha256 { get; set; } = string.Empty;

    [Required, MaxLength(40)]
    public string Verdict { get; set; } = string.Empty;

    [Required, MaxLength(64)]
    public string ProviderUsed { get; set; } = string.Empty;

    [MaxLength(64)]
    public string ModelUsed { get; set; } = string.Empty;

    [Required]
    public string PayloadJson { get; set; } = string.Empty;

    [Required, MaxLength(128)]
    public string HmacSignature { get; set; } = string.Empty;

    public Guid? PairedIdTokenId { get; set; }

    public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime ExpiresAtUtc { get; set; } = DateTime.UtcNow.AddMinutes(30);

    public DateTime? ConsumedAtUtc { get; set; }

    public Guid? ConsumedByUserId { get; set; }

    public bool IsSyntheticTestToken { get; set; } = false;
}
