// [Layer: Backend/Data/Models]
// Responsibility: Retains the enrolled facial identity template (encrypted at rest), descriptor version, quality telemetry, and revocation lifecycle.
// Compliance: Section 20 of RA 10173 & NPC Circular 16-01. Zero emojis.

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Features.Data.Models;

public class BiometricEnrollment
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    // AES-256-GCM encrypted binary representation of the 128-D descriptor vector
    [Required]
    public byte[] EncryptedTemplateData { get; set; } = [];

    [MaxLength(50)]
    public string TemplateFormat { get; set; } = "128D_FLOAT32_NORMALIZED";

    [MaxLength(80)]
    public string ModelIdentifier { get; set; } = "ResQTrack_Hybrid_CSLBP_Gabor_Haar";

    [MaxLength(30)]
    public string ModelVersion { get; set; } = "v1.0.0";

    public double EnrollmentQualityScore { get; set; } = 0.0;

    [MaxLength(100)]
    public string LivenessSummary { get; set; } = "CHALLENGE_SEQUENCE_VERIFIED";

    [MaxLength(50)]
    public string EnrollmentStatus { get; set; } = "ACTIVE"; // ACTIVE, REVOKED, SUPERSEDED

    public bool IsActive => EnrollmentStatus == "ACTIVE" && RevokedAtUtc == null;

    public DateTime EnrolledAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? RevokedAtUtc { get; set; }

    [MaxLength(180)]
    public string? RevokedBy { get; set; }
}
