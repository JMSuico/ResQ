// [Layer: Backend/Data/Models]
// Responsibility: Represents the User domain entity with multi-role identity, biometric capture metadata, granular Philippine emergency address breakdown, role-specific professional attributes, and soft-delete governance.
// DO NOT bypass password hashing or store raw plaintext credentials.

using System.ComponentModel.DataAnnotations;
using Backend.Features.Data.Enums;

namespace Backend.Features.Data.Models;

public class User
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(80)]
    public string EmployeeOrResidentId { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(30)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    public string PasswordSalt { get; set; } = string.Empty;

    public UserRole Role { get; set; } = UserRole.Civilian;

    public ResponderUnitType Unit { get; set; } = ResponderUnitType.None;

    public AccountStatus Status { get; set; } = AccountStatus.Pending;

    public bool FaceVerified { get; set; } = false;

    [MaxLength(50)]
    public string? ValidIdType { get; set; }

    [MaxLength(500)]
    public string? IdCapturePath { get; set; }

    [MaxLength(500)]
    public string? FaceCapturePath { get; set; }

    [MaxLength(150)]
    public string DepartmentOrBarangay { get; set; } = string.Empty;

    [MaxLength(100)]
    public string RankOrTitle { get; set; } = string.Empty;

    // --- Personal Details ---
    [MaxLength(80)]
    public string FirstName { get; set; } = string.Empty;

    [MaxLength(80)]
    public string? MiddleName { get; set; }

    [MaxLength(80)]
    public string Surname { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Suffix { get; set; }

    public DateTime? DateOfBirth { get; set; }

    [MaxLength(20)]
    public string? Sex { get; set; }

    [MaxLength(10)]
    public string? BloodType { get; set; }

    // --- Granular Address Breakdown (Philippine LGU Hierarchy) ---
    [MaxLength(100)]
    public string Province { get; set; } = "Zamboanga del Norte";

    [MaxLength(100)]
    public string CityOrMunicipality { get; set; } = "Dipolog City";

    [MaxLength(100)]
    public string Barangay { get; set; } = string.Empty;

    [MaxLength(150)]
    public string StreetOrPurok { get; set; } = string.Empty;

    // --- Emergency Contact ---
    [MaxLength(150)]
    public string? EmergencyContactName { get; set; }

    [MaxLength(30)]
    public string? EmergencyContactPhone { get; set; }

    [MaxLength(50)]
    public string? EmergencyContactRelationship { get; set; }

    // --- Civilian Specific ---
    [MaxLength(60)]
    public string? GovernmentIdType { get; set; }

    [MaxLength(80)]
    public string? GovernmentIdNumber { get; set; }

    [MaxLength(50)]
    public string? ResidencyCategory { get; set; }

    [MaxLength(250)]
    public string? VulnerabilityFlags { get; set; }

    // --- RHU Medic Specific ---
    [MaxLength(80)]
    public string? MedicalLicenseNumber { get; set; }

    [MaxLength(80)]
    public string? MedicalCadre { get; set; }

    [MaxLength(120)]
    public string? StationHealthCenter { get; set; }

    [MaxLength(250)]
    public string? MedicalCertifications { get; set; }

    [MaxLength(50)]
    public string? AmbulanceCallSign { get; set; }

    // --- FIRE (BFP) Specific ---
    [MaxLength(80)]
    public string? FirefighterRank { get; set; }

    [MaxLength(80)]
    public string? BfpBadgeNumber { get; set; }

    [MaxLength(120)]
    public string? FireStation { get; set; }

    [MaxLength(150)]
    public string? FireSpecialization { get; set; }

    [MaxLength(50)]
    public string? ApparatusCallSign { get; set; }

    // --- PNP Police Specific ---
    [MaxLength(80)]
    public string? PoliceRank { get; set; }

    [MaxLength(80)]
    public string? PnpBadgeNumber { get; set; }

    [MaxLength(120)]
    public string? PrecinctOrStation { get; set; }

    [MaxLength(120)]
    public string? PoliceAssignment { get; set; }

    [MaxLength(80)]
    public string? SidearmSerial { get; set; }

    // --- LDRRMO Admin Specific ---
    [MaxLength(80)]
    public string? PlantillaNumber { get; set; }

    [MaxLength(120)]
    public string? ExecutiveDesignation { get; set; }

    [MaxLength(50)]
    public string? ClearanceLevel { get; set; }

    // --- Governance & Soft Delete ---
    public bool IsDeleted { get; set; } = false;

    public DateTime? DeletedAt { get; set; }

    [MaxLength(180)]
    public string? DeletedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // --- Navigation collections ---
    public ICollection<Session> Sessions { get; set; } = new List<Session>();
    public ICollection<Report> Reports { get; set; } = new List<Report>();
    public ICollection<AlertReadState> AlertReadStates { get; set; } = new List<AlertReadState>();

    // --- Universal Lambdas (Expression-Bodied Helpers) ---
    public string FullAddress =>
        string.Join(", ", new[] { StreetOrPurok, Barangay, CityOrMunicipality, Province }.Where(s => !string.IsNullOrWhiteSpace(s)));

    public string ComputedFullName =>
        string.Join(" ", new[] { FirstName, MiddleName, Surname, Suffix }.Where(s => !string.IsNullOrWhiteSpace(s)));

    public void SoftDelete(string deletedBy) =>
        (IsDeleted, DeletedAt, DeletedBy, UpdatedAt) = (true, DateTime.UtcNow, deletedBy, DateTime.UtcNow);

    public void Restore() =>
        (IsDeleted, DeletedAt, DeletedBy, UpdatedAt) = (false, null, null, DateTime.UtcNow);
}
