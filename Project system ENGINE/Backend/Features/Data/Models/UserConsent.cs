// [Layer: Backend/Data/Models]
// Responsibility: Retains statutory privacy notice versioning, explicit user consent actions, and legal basis metadata under the Philippine Data Privacy Act of 2012.
// Compliance: RA 10173 Section 12/13. Zero emojis.

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Features.Data.Models;

public class UserConsent
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    [Required, MaxLength(30)]
    public string NoticeVersion { get; set; } = "v1.0";

    [Required, MaxLength(100)]
    public string PurposeCategory { get; set; } = "EMERGENCY_DISPATCH_AND_IDENTITY_VERIFICATION";

    [Required, MaxLength(50)]
    public string UserAction { get; set; } = "EXPLICIT_OPT_IN"; // EXPLICIT_OPT_IN, WITHDRAWN

    [MaxLength(80)]
    public string LegalBasis { get; set; } = "RA_10173_SEC12_CONSENT_AND_VITAL_INTERESTS";

    [MaxLength(60)]
    public string ClientIpAddress { get; set; } = "127.0.0.1";

    public DateTime ConsentedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? WithdrawnAtUtc { get; set; }
}
