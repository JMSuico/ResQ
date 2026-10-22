// [Layer: Backend/Data/Enums]
// Responsibility: Defines core user roles for multi-agency emergency operations.
// DO NOT import database or presentation concerns into this enum.

namespace Backend.Features.Data.Enums;

public enum UserRole
{
    LDRRMO_Admin = 1,
    Responder = 2,
    Civilian = 3
}

public enum ResponderUnitType
{
    None = 0,
    LDRRMO = 1,
    RHU = 2,
    FIRE = 3,
    PNP = 4,
    Security = 5
}

public enum AccountStatus
{
    Pending = 0,
    Verified = 1,
    Suspended = 2
}

public enum IncidentCategory
{
    VehicularAccident = 1,
    MedicalEmergency = 2,
    StructuralFire = 3,
    CrimeOrSecurity = 4,
    NaturalDisaster = 5,
    HazardFixture = 6
}

public enum IncidentSeverity
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

public enum ReportStatus
{
    Reported = 1,
    Verified = 2,
    Allocated = 3,
    EnRoute = 4,
    OnScene = 5,
    Resolved = 6,
    Rejected = 7
}

public enum DutyStatus
{
    OnDuty = 1,
    Dispatched = 2,
    Standby = 3,
    OffDuty = 4
}

public enum CaptureKind
{
    Id = 1,
    Face = 2,
    Report = 3
}
