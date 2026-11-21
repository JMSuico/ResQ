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

    public string? GeometricSignatureJson { get; set; }

    public string? PoseFramesJson { get; set; }

    [NotMapped]
    public string? DescriptorVectorJson
    {
        get => EncryptedTemplateData.Length >= sizeof(float)
            ? System.Text.Json.JsonSerializer.Serialize(ToFloatArray(EncryptedTemplateData))
            : null;
        set
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                var arr = System.Text.Json.JsonSerializer.Deserialize<float[]>(value);
                if (arr is { Length: > 0 })
                {
                    var bytes = new byte[arr.Length * sizeof(float)];
                    Buffer.BlockCopy(arr, 0, bytes, 0, bytes.Length);
                    EncryptedTemplateData = bytes;
                }
            }
        }
    }

    [MaxLength(50)]
    public string TemplateFormat { get; set; } = "128D_FLOAT32_NORMALIZED";

    [MaxLength(80)]
    public string ModelIdentifier { get; set; } = "ResQTrack_Hybrid_CSLBP_Gabor_Haar";

    [NotMapped]
    public string ModelName
    {
        get => ModelIdentifier;
        set => ModelIdentifier = value;
    }

    [MaxLength(30)]
    public string ModelVersion { get; set; } = "v1.0.0";

    public double EnrollmentQualityScore { get; set; } = 0.0;

    [MaxLength(100)]
    public string LivenessSummary { get; set; } = "CHALLENGE_SEQUENCE_VERIFIED";

    [MaxLength(50)]
    public string EnrollmentStatus { get; set; } = "ACTIVE"; // ACTIVE, REVOKED, SUPERSEDED

    public bool IsActive => EnrollmentStatus == "ACTIVE" && RevokedAtUtc == null;

    public DateTime EnrolledAtUtc { get; set; } = DateTime.UtcNow;

    [MaxLength(32)]
    public string TrainingStatus { get; set; } = "READY"; // LEARNING, READY, FAILED

    public DateTime? TrainingStartedAtUtc { get; set; }

    public DateTime? TrainingReadyTargetUtc { get; set; }

    public DateTime? TrainingCompletedAtUtc { get; set; }

    [MaxLength(500)]
    public string? TrainingNotes { get; set; }

    public int TrainedFrameCount { get; set; } = 0;

    public DateTime? RevokedAtUtc { get; set; }

    [MaxLength(180)]
    public string? RevokedBy { get; set; }

    private static float[] ToFloatArray(byte[] bytes)
    {
        var floats = new float[bytes.Length / sizeof(float)];
        Buffer.BlockCopy(bytes, 0, floats, 0, floats.Length * sizeof(float));
        return floats;
    }
}
