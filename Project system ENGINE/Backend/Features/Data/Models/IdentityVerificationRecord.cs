// [Layer: Backend/Data/Models]
// Responsibility: Retains statutory government document processing, OCR extraction provenance, user corrections, and verification check outcomes.
// Compliance: Philippine Data Privacy Act of 2012 (RA 10173). Zero emojis.

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Features.Data.Models;

public class IdentityVerificationRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    [Required, MaxLength(60)]
    public string GovernmentIdType { get; set; } = string.Empty;

    [MaxLength(80)]
    public string? GovernmentIdNumber { get; set; }

    [MaxLength(80)]
    public string? Issuer { get; set; } = "Republic of the Philippines";

    [MaxLength(30)]
    public string? IdSpecVersion { get; set; } = "ID-1_v1.0";

    [MaxLength(60)]
    public string ExtractionEngine { get; set; } = "ManualIdentityVerificationProvider";

    [MaxLength(30)]
    public string ExtractionEngineVersion { get; set; } = "1.0.0-manual";

    public double ConfidenceScore { get; set; } = 0.0;

    // JSON serialization of normalized statutory fields (Full Name, DOB, Address, Sex, Expiry)
    public string NormalizedFieldsJson { get; set; } = "{}";

    // JSON serialization of fields manually edited/confirmed by user before submission
    public string UserCorrectedFieldsJson { get; set; } = "{}";

    [MaxLength(50)]
    public string DocumentCheckStatus { get; set; } = "SUBMITTED_PENDING_ADMIN_REVIEW";

    [MaxLength(50)]
    public string FaceMatchStatus { get; set; } = "NOT_PERFORMED_MANUAL_REVIEW";

    [MaxLength(50)]
    public string LivenessStatus { get; set; } = "CAPTURED_PENDING_ADMIN_REVIEW";

    [MaxLength(50)]
    public string OverallVerificationStatus { get; set; } = "PENDING_REVIEW";

    [MaxLength(500)]
    public string? FrontIdEncryptedPath { get; set; }

    [MaxLength(500)]
    public string? BackIdEncryptedPath { get; set; }

    public DateTime VerifiedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
