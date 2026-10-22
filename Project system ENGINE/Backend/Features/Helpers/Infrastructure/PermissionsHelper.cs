// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Enforces deterministic role authorization and agency unit permissions.
// DO NOT grant admin capabilities to unverified responders or civilians.

using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;

namespace Backend.Features.Helpers.Infrastructure;

public static class PermissionsHelper
{
    public static bool IsSuperAdmin(User? user) =>
        user != null && user.Role == UserRole.LDRRMO_Admin && user.Status == AccountStatus.Verified;

    public static bool IsResponder(User? user) =>
        user != null && user.Role == UserRole.Responder && user.Status == AccountStatus.Verified;

    public static bool IsCivilian(User? user) =>
        user != null && user.Role == UserRole.Civilian;

    public static bool CanVerifyIncident(User? user) =>
        IsSuperAdmin(user);

    public static bool CanAllocateUnit(User? user) =>
        IsSuperAdmin(user);

    public static bool CanUpdateUnitStatus(User? user, ResponderUnitType unitType) =>
        IsSuperAdmin(user) || (IsResponder(user) && user?.Unit == unitType);
}
