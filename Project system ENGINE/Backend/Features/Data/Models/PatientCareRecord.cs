// [Layer: Backend/Data/Models]
// Responsibility: Defines RHU / EMS pre-hospital clinical Patient Care Records (PCR).
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Data.Models;

public class PatientCareRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string PcrReference { get; set; } = string.Empty;

    public Guid? ReportId { get; set; }

    public Guid? ResponderUserId { get; set; }

    [Required, MaxLength(120)]
    public string MedicName { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string UnitCode { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string PatientName { get; set; } = string.Empty;

    public int Age { get; set; }

    [Required, MaxLength(20)]
    public string Gender { get; set; } = string.Empty;

    public double WeightKg { get; set; }

    [Required, MaxLength(50)]
    public string LevelOfConsciousness { get; set; } = "Alert";

    public int BloodPressureSystolic { get; set; }

    public int BloodPressureDiastolic { get; set; }

    public int HeartRateBpm { get; set; }

    public int RespiratoryRate { get; set; }

    public int SpO2Percent { get; set; }

    public int BloodGlucoseMgDl { get; set; }

    public double TemperatureCelsius { get; set; }

    public string InterventionsJson { get; set; } = "[]";

    public string AnatomicalInjuriesJson { get; set; } = "[]";

    [MaxLength(500)]
    public string ChiefComplaint { get; set; } = string.Empty;

    public string Narrative { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
