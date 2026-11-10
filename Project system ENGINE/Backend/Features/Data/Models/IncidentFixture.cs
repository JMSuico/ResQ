// [Layer: Backend/Data/Models]
// Responsibility: Defines geospatial infrastructure hazard fixtures, hydrants, and CCTV points.
// Pure relational entity model. Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;
using Backend.Features.Data.Enums;

namespace Backend.Features.Data.Models;

public class IncidentFixture
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string FixtureCode { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    public IncidentCategory Category { get; set; } = IncidentCategory.HazardFixture;

    public IncidentSeverity Severity { get; set; } = IncidentSeverity.Low;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public ResponderUnitType AssignedUnitType { get; set; } = ResponderUnitType.None;

    public bool IsActive { get; set; } = true;

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
