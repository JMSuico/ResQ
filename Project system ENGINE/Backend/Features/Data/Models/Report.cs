// [Layer: Backend/Data/Models]
// Responsibility: Represents an emergency incident report with geotagged coordinates and camera capture.
// DO NOT mutate reference codes once generated.

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Backend.Features.Data.Enums;

namespace Backend.Features.Data.Models;

public class Report
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(32)]
    public string ReferenceCode { get; set; } = string.Empty;

    public Guid ReporterId { get; set; }

    [ForeignKey(nameof(ReporterId))]
    public User? Reporter { get; set; }

    [Required, MaxLength(150)]
    public string ReporterName { get; set; } = string.Empty;

    public UserRole ReporterRole { get; set; } = UserRole.Civilian;

    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Note { get; set; } = string.Empty;

    public IncidentCategory Category { get; set; } = IncidentCategory.VehicularAccident;

    public IncidentSeverity Severity { get; set; } = IncidentSeverity.Medium;

    public ReportStatus Status { get; set; } = ReportStatus.Reported;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    [MaxLength(255)]
    public string LocationLabel { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ImageCapturePath { get; set; }

    public double? GpsAccuracyMeters { get; set; }

    public bool IsHardwareGeolocated { get; set; } = false;

    public bool IsBlurry { get; set; } = false;

    public bool RequiresManualVerification { get; set; } = false;

    [MaxLength(50)]
    public string? RecommendedAgencyUnit { get; set; }

    public Guid? AllocatedUnitId { get; set; }

    [ForeignKey(nameof(AllocatedUnitId))]
    public DutyUnit? AllocatedUnit { get; set; }

    [MaxLength(50)]
    public string? AllocatedUnitCode { get; set; }

    public Guid? VerifiedByAdminId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? VerifiedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }
}
