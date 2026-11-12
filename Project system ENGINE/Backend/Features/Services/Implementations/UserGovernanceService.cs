// [Layer: Backend/Services/Implementations]
// Responsibility: Implements user governance, account administration, RBAC mutations, and profile editing using Universal Lambdas (=>).
// Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class UserGovernanceService(
    IUserRepository userRepo,
    ISessionRepository sessionRepo,
    IAuditLogRepository auditRepo) : IUserGovernanceService
{
    public async Task<List<UserResponse>> GetAllUsersAsync(CancellationToken ct = default) =>
        (await userRepo.GetAllAsync(ct)).Select(MapToUserResponse).ToList();

    public async Task<PagedResult<UserResponse>> GetPagedUsersAsync(UserFilterParams filter, CancellationToken ct = default)
    {
        var users = await userRepo.SearchUsersAsync(filter.Query, filter.Role, filter.Unit, filter.Status, filter.Page, filter.PageSize, ct);
        var total = await userRepo.CountUsersAsync(filter.Query, filter.Role, filter.Unit, filter.Status, ct);
        var totalPages = (int)Math.Ceiling((double)total / Math.Max(1, filter.PageSize));
        return new PagedResult<UserResponse>(users.Select(MapToUserResponse).ToList(), total, filter.Page, filter.PageSize, totalPages);
    }

    public async Task<UserDetailResponse?> GetUserDetailAsync(Guid id, CancellationToken ct = default) =>
        await userRepo.GetByIdWithDeletedAsync(id, ct) is { } user
            ? MapToUserDetailResponse(user)
            : null;

    public async Task<(bool Success, string? Error, UserResponse? User)> CreateUserAsync(CreateUserRequest request, Guid adminId, CancellationToken ct = default)
    {
        if (await userRepo.ExistsEmailAsync(request.Email, ct))
            return (false, "An account with this email address already exists.", null);

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12)
            return (false, "Password must be at least 12 characters long.", null);

        var (hash, salt) = ScryptPasswordHelper.HashPassword(request.Password);

        var computedName = string.Join(" ", new[] { request.FirstName, request.MiddleName, request.Surname, request.Suffix }.Where(s => !string.IsNullOrWhiteSpace(s)));
        var fullName = string.IsNullOrWhiteSpace(computedName) ? $"{request.FirstName} {request.Surname}".Trim() : computedName;

        var province = string.IsNullOrWhiteSpace(request.Province) ? "Zamboanga del Norte" : InputSanitizer.Sanitize(request.Province);
        var city = string.IsNullOrWhiteSpace(request.CityOrMunicipality) ? "Katipunan" : InputSanitizer.Sanitize(request.CityOrMunicipality);

        var user = new User
        {
            Email = InputSanitizer.Sanitize(request.Email).ToLowerInvariant(),
            DisplayName = !string.IsNullOrWhiteSpace(request.DisplayName) ? InputSanitizer.Sanitize(request.DisplayName) : fullName,
            FullName = fullName,
            FirstName = InputSanitizer.Sanitize(request.FirstName),
            MiddleName = InputSanitizer.Sanitize(request.MiddleName),
            Surname = InputSanitizer.Sanitize(request.Surname),
            Suffix = InputSanitizer.Sanitize(request.Suffix),
            DateOfBirth = request.DateOfBirth,
            Sex = InputSanitizer.Sanitize(request.Sex),
            BloodType = InputSanitizer.Sanitize(request.BloodType),
            Province = province,
            CityOrMunicipality = city,
            Barangay = InputSanitizer.Sanitize(request.Barangay ?? string.Empty),
            StreetOrPurok = InputSanitizer.Sanitize(request.StreetOrPurok ?? string.Empty),
            PhoneNumber = InputSanitizer.Sanitize(request.PhoneNumber ?? string.Empty),
            EmergencyContactName = InputSanitizer.Sanitize(request.EmergencyContactName),
            EmergencyContactPhone = InputSanitizer.Sanitize(request.EmergencyContactPhone),
            EmergencyContactRelationship = InputSanitizer.Sanitize(request.EmergencyContactRelationship),
            Role = request.Role,
            Unit = request.Unit,
            Status = AccountStatus.Verified,
            FaceVerified = false,
            IdentityVerificationStatus = "Verified",
            FacialVerificationStatus = "Verified",
            IdentityVerificationProvider = "AdminProvisioned",
            FacialVerificationProvider = "AdminProvisioned",
            DepartmentOrBarangay = string.IsNullOrWhiteSpace(request.DepartmentOrBarangay) ? null : InputSanitizer.Sanitize(request.DepartmentOrBarangay),
            RankOrTitle = InputSanitizer.Sanitize(request.RankOrTitle ?? string.Empty),
            EmployeeOrResidentId = InputSanitizer.Sanitize(request.EmployeeOrResidentId ?? string.Empty),
            PasswordHash = hash,
            PasswordSalt = salt,
            GovernmentIdType = InputSanitizer.Sanitize(request.GovernmentIdType),
            GovernmentIdNumber = InputSanitizer.Sanitize(request.GovernmentIdNumber),
            ResidencyCategory = InputSanitizer.Sanitize(request.ResidencyCategory),
            VulnerabilityFlags = InputSanitizer.Sanitize(request.VulnerabilityFlags),
            MedicalLicenseNumber = InputSanitizer.Sanitize(request.MedicalLicenseNumber),
            MedicalCadre = InputSanitizer.Sanitize(request.MedicalCadre),
            StationHealthCenter = InputSanitizer.Sanitize(request.StationHealthCenter),
            MedicalCertifications = InputSanitizer.Sanitize(request.MedicalCertifications),
            AmbulanceCallSign = InputSanitizer.Sanitize(request.AmbulanceCallSign),
            FirefighterRank = InputSanitizer.Sanitize(request.FirefighterRank),
            BfpBadgeNumber = InputSanitizer.Sanitize(request.BfpBadgeNumber),
            FireStation = InputSanitizer.Sanitize(request.FireStation),
            FireSpecialization = InputSanitizer.Sanitize(request.FireSpecialization),
            ApparatusCallSign = InputSanitizer.Sanitize(request.ApparatusCallSign),
            PoliceRank = InputSanitizer.Sanitize(request.PoliceRank),
            PnpBadgeNumber = InputSanitizer.Sanitize(request.PnpBadgeNumber),
            PrecinctOrStation = InputSanitizer.Sanitize(request.PrecinctOrStation),
            PoliceAssignment = InputSanitizer.Sanitize(request.PoliceAssignment),
            SidearmSerial = InputSanitizer.Sanitize(request.SidearmSerial),
            PlantillaNumber = InputSanitizer.Sanitize(request.PlantillaNumber),
            ExecutiveDesignation = InputSanitizer.Sanitize(request.ExecutiveDesignation),
            ClearanceLevel = InputSanitizer.Sanitize(request.ClearanceLevel),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await userRepo.AddAsync(user, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "USER_CREATED_BY_ADMIN";
        string payload = $"User: {user.Email}, Role: {user.Role}, Unit: {user.Unit}, AdminId: {adminId}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, adminId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = adminId,
            Action = action,
            TargetEntity = nameof(User),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return (true, null, MapToUserResponse(user));
    }

    public async Task<(bool Success, string? Error)> UpdateUserAsync(Guid id, UpdateUserRequest request, Guid adminId, CancellationToken ct = default)
    {
        var user = await userRepo.GetByIdAsync(id, ct);
        if (user == null) return (false, "User not found.");

        user.FirstName = InputSanitizer.Sanitize(request.FirstName);
        user.MiddleName = InputSanitizer.Sanitize(request.MiddleName);
        user.Surname = InputSanitizer.Sanitize(request.Surname);
        user.Suffix = InputSanitizer.Sanitize(request.Suffix);
        var computedName = string.Join(" ", new[] { user.FirstName, user.MiddleName, user.Surname, user.Suffix }.Where(s => !string.IsNullOrWhiteSpace(s)));
        user.FullName = string.IsNullOrWhiteSpace(computedName) ? $"{user.FirstName} {user.Surname}".Trim() : computedName;

        user.DateOfBirth = request.DateOfBirth;
        user.Sex = InputSanitizer.Sanitize(request.Sex);
        user.BloodType = InputSanitizer.Sanitize(request.BloodType);
        user.PhoneNumber = InputSanitizer.Sanitize(request.PhoneNumber ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(request.Province)) user.Province = InputSanitizer.Sanitize(request.Province);
        if (!string.IsNullOrWhiteSpace(request.CityOrMunicipality)) user.CityOrMunicipality = InputSanitizer.Sanitize(request.CityOrMunicipality);
        if (request.Barangay != null) user.Barangay = InputSanitizer.Sanitize(request.Barangay);
        if (request.StreetOrPurok != null) user.StreetOrPurok = InputSanitizer.Sanitize(request.StreetOrPurok);

        user.EmergencyContactName = InputSanitizer.Sanitize(request.EmergencyContactName);
        user.EmergencyContactPhone = InputSanitizer.Sanitize(request.EmergencyContactPhone);
        user.EmergencyContactRelationship = InputSanitizer.Sanitize(request.EmergencyContactRelationship);

        user.Role = request.Role;
        user.Unit = request.Unit;
        var previousStatus = user.Status;
        user.Status = request.Status;

        if (request.DepartmentOrBarangay != null) user.DepartmentOrBarangay = string.IsNullOrWhiteSpace(request.DepartmentOrBarangay) ? null : InputSanitizer.Sanitize(request.DepartmentOrBarangay);
        if (request.RankOrTitle != null) user.RankOrTitle = InputSanitizer.Sanitize(request.RankOrTitle);
        if (request.EmployeeOrResidentId != null) user.EmployeeOrResidentId = InputSanitizer.Sanitize(request.EmployeeOrResidentId);

        // Role-specific
        user.GovernmentIdType = InputSanitizer.Sanitize(request.GovernmentIdType);
        user.GovernmentIdNumber = InputSanitizer.Sanitize(request.GovernmentIdNumber);
        user.ResidencyCategory = InputSanitizer.Sanitize(request.ResidencyCategory);
        user.VulnerabilityFlags = InputSanitizer.Sanitize(request.VulnerabilityFlags);
        user.MedicalLicenseNumber = InputSanitizer.Sanitize(request.MedicalLicenseNumber);
        user.MedicalCadre = InputSanitizer.Sanitize(request.MedicalCadre);
        user.StationHealthCenter = InputSanitizer.Sanitize(request.StationHealthCenter);
        user.MedicalCertifications = InputSanitizer.Sanitize(request.MedicalCertifications);
        user.AmbulanceCallSign = InputSanitizer.Sanitize(request.AmbulanceCallSign);
        user.FirefighterRank = InputSanitizer.Sanitize(request.FirefighterRank);
        user.BfpBadgeNumber = InputSanitizer.Sanitize(request.BfpBadgeNumber);
        user.FireStation = InputSanitizer.Sanitize(request.FireStation);
        user.FireSpecialization = InputSanitizer.Sanitize(request.FireSpecialization);
        user.ApparatusCallSign = InputSanitizer.Sanitize(request.ApparatusCallSign);
        user.PoliceRank = InputSanitizer.Sanitize(request.PoliceRank);
        user.PnpBadgeNumber = InputSanitizer.Sanitize(request.PnpBadgeNumber);
        user.PrecinctOrStation = InputSanitizer.Sanitize(request.PrecinctOrStation);
        user.PoliceAssignment = InputSanitizer.Sanitize(request.PoliceAssignment);
        user.SidearmSerial = InputSanitizer.Sanitize(request.SidearmSerial);
        user.PlantillaNumber = InputSanitizer.Sanitize(request.PlantillaNumber);
        user.ExecutiveDesignation = InputSanitizer.Sanitize(request.ExecutiveDesignation);
        user.ClearanceLevel = InputSanitizer.Sanitize(request.ClearanceLevel);
        if (!string.IsNullOrWhiteSpace(request.DisplayName))
            user.DisplayName = InputSanitizer.Sanitize(request.DisplayName);
        if (!string.IsNullOrWhiteSpace(request.IdentityVerificationStatus))
            user.IdentityVerificationStatus = InputSanitizer.Sanitize(request.IdentityVerificationStatus);
        if (!string.IsNullOrWhiteSpace(request.FacialVerificationStatus))
            user.FacialVerificationStatus = InputSanitizer.Sanitize(request.FacialVerificationStatus);

        user.UpdatedAt = DateTime.UtcNow;
        await userRepo.UpdateAsync(user, ct);

        // Immediate session revocation if status changed to Suspended
        if (user.Status == AccountStatus.Suspended && previousStatus != AccountStatus.Suspended)
            await sessionRepo.RevokeAllForUserAsync(id, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "USER_UPDATED_BY_ADMIN";
        string payload = $"User: {user.Email}, Role: {user.Role}, Unit: {user.Unit}, Status: {user.Status}, AdminId: {adminId}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, adminId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = adminId,
            Action = action,
            TargetEntity = nameof(User),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return (true, null);
    }

    public async Task<(bool Success, string? Error)> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default)
    {
        var user = await userRepo.GetByIdAsync(userId, ct);
        if (user == null) return (false, "User not found.");

        if (!string.IsNullOrWhiteSpace(request.FirstName)) user.FirstName = InputSanitizer.Sanitize(request.FirstName);
        if (request.MiddleName != null) user.MiddleName = InputSanitizer.Sanitize(request.MiddleName);
        if (!string.IsNullOrWhiteSpace(request.Surname)) user.Surname = InputSanitizer.Sanitize(request.Surname);
        if (request.Suffix != null) user.Suffix = InputSanitizer.Sanitize(request.Suffix);

        if (!string.IsNullOrWhiteSpace(request.FullName))
            user.FullName = InputSanitizer.Sanitize(request.FullName);
        else if (!string.IsNullOrWhiteSpace(user.FirstName) && !string.IsNullOrWhiteSpace(user.Surname))
            user.FullName = user.ComputedFullName;

        if (request.PhoneNumber != null) user.PhoneNumber = InputSanitizer.Sanitize(request.PhoneNumber);
        if (!string.IsNullOrWhiteSpace(request.Province)) user.Province = InputSanitizer.Sanitize(request.Province);
        if (!string.IsNullOrWhiteSpace(request.CityOrMunicipality)) user.CityOrMunicipality = InputSanitizer.Sanitize(request.CityOrMunicipality);
        if (request.Barangay != null) user.Barangay = InputSanitizer.Sanitize(request.Barangay);
        if (request.StreetOrPurok != null) user.StreetOrPurok = InputSanitizer.Sanitize(request.StreetOrPurok);

        if (request.EmergencyContactName != null) user.EmergencyContactName = InputSanitizer.Sanitize(request.EmergencyContactName);
        if (request.EmergencyContactPhone != null) user.EmergencyContactPhone = InputSanitizer.Sanitize(request.EmergencyContactPhone);
        if (request.EmergencyContactRelationship != null) user.EmergencyContactRelationship = InputSanitizer.Sanitize(request.EmergencyContactRelationship);

        if (request.Sex != null) user.Sex = request.Sex;
        if (request.BloodType != null) user.BloodType = request.BloodType;
        if (request.DateOfBirth.HasValue) user.DateOfBirth = request.DateOfBirth.Value;
        if (request.DepartmentOrBarangay != null) user.DepartmentOrBarangay = InputSanitizer.Sanitize(request.DepartmentOrBarangay);
        if (request.RankOrTitle != null) user.RankOrTitle = InputSanitizer.Sanitize(request.RankOrTitle);
        if (request.EmployeeOrResidentId != null) user.EmployeeOrResidentId = InputSanitizer.Sanitize(request.EmployeeOrResidentId);
        if (request.GovernmentIdType != null) user.GovernmentIdType = InputSanitizer.Sanitize(request.GovernmentIdType);
        if (request.GovernmentIdNumber != null) user.GovernmentIdNumber = InputSanitizer.Sanitize(request.GovernmentIdNumber);
        if (!string.IsNullOrWhiteSpace(request.DisplayName)) user.DisplayName = InputSanitizer.Sanitize(request.DisplayName);

        user.UpdatedAt = DateTime.UtcNow;
        await userRepo.UpdateAsync(user, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "USER_PROFILE_UPDATED";
        string payload = $"User: {user.Email}, Name: {user.FullName}, Role: {user.Role}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, userId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = userId,
            Action = action,
            TargetEntity = nameof(User),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return (true, null);
    }

    public async Task<(bool Success, string? Error)> DeleteUserAsync(Guid id, Guid adminId, string adminEmail, CancellationToken ct = default)
    {
        var user = await userRepo.GetByIdAsync(id, ct);
        if (user == null) return (false, "User not found.");

        if (id == adminId) return (false, "Administrators cannot delete their own account.");

        await userRepo.SoftDeleteAsync(id, adminEmail, ct);
        await sessionRepo.RevokeAllForUserAsync(id, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "USER_SOFT_DELETED";
        string payload = $"TargetUser: {user.Email}, AdminEmail: {adminEmail}, AdminId: {adminId}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, adminId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = adminId,
            Action = action,
            TargetEntity = nameof(User),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return (true, null);
    }

    public async Task<(bool Success, string? Error)> UpdateUserStatusAsync(Guid targetUserId, Guid adminId, AccountStatus status, CancellationToken ct = default)
    {
        var targetUser = await userRepo.GetByIdAsync(targetUserId, ct);
        if (targetUser == null) return (false, "User not found.");

        targetUser.Status = status;
        if (status == AccountStatus.Verified)
        {
            targetUser.IdentityVerificationStatus = "Verified";
            targetUser.FacialVerificationStatus = "Verified";
        }
        else if (status == AccountStatus.Suspended)
        {
            targetUser.IdentityVerificationStatus = "Rejected";
            targetUser.FacialVerificationStatus = "Rejected";
        }
        targetUser.UpdatedAt = DateTime.UtcNow;
        await userRepo.UpdateAsync(targetUser, ct);

        // Immediate revocation: if suspended, terminate all sessions
        if (status == AccountStatus.Suspended)
            await sessionRepo.RevokeAllForUserAsync(targetUserId, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "USER_STATUS_UPDATED";
        string payload = $"TargetUser: {targetUser.Email}, NewStatus: {status}, AdminId: {adminId}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, adminId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = adminId,
            Action = action,
            TargetEntity = nameof(User),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return (true, null);
    }

    public async Task<string?> GetUserCapturePathAsync(Guid userId, CaptureKind kind, CancellationToken ct = default) =>
        (await userRepo.GetByIdWithDeletedAsync(userId, ct)) switch
        {
            { } u when kind == CaptureKind.Id => u.IdCapturePath,
            { } u when kind == CaptureKind.IdBack => u.IdBackCapturePath,
            { } u when kind == CaptureKind.Face => u.FaceCapturePath,
            _ => null
        };

    private static UserResponse MapToUserResponse(User u) => new(
        u.Id,
        u.FullName,
        u.Email,
        u.EmployeeOrResidentId,
        u.Role,
        u.Unit,
        u.Status,
        u.FaceVerified,
        !string.IsNullOrWhiteSpace(u.IdCapturePath),
        !string.IsNullOrWhiteSpace(u.FaceCapturePath),
        u.DepartmentOrBarangay,
        u.RankOrTitle,
        u.CreatedAt,
        u.FullAddress,
        u.PhoneNumber,
        u.EffectiveDisplayName,
        u.IdentityVerificationStatus,
        u.FacialVerificationStatus,
        !string.IsNullOrWhiteSpace(u.IdBackCapturePath)
    );

    private static UserDetailResponse MapToUserDetailResponse(User u) => new(
        u.Id,
        u.Email,
        u.FullName,
        u.FirstName,
        u.MiddleName,
        u.Surname,
        u.Suffix,
        u.DateOfBirth,
        u.Sex,
        u.BloodType,
        u.PhoneNumber,
        u.Province,
        u.CityOrMunicipality,
        u.Barangay,
        u.StreetOrPurok,
        u.FullAddress,
        u.EmergencyContactName,
        u.EmergencyContactPhone,
        u.EmergencyContactRelationship,
        u.Role,
        u.Unit,
        u.Status,
        u.FaceVerified,
        u.ValidIdType,
        !string.IsNullOrWhiteSpace(u.IdCapturePath),
        !string.IsNullOrWhiteSpace(u.FaceCapturePath),
        u.IdCapturePath,
        u.FaceCapturePath,
        u.DepartmentOrBarangay,
        u.RankOrTitle,
        u.EmployeeOrResidentId,
        u.GovernmentIdType,
        u.GovernmentIdNumber,
        u.ResidencyCategory,
        u.VulnerabilityFlags,
        u.MedicalLicenseNumber,
        u.MedicalCadre,
        u.StationHealthCenter,
        u.MedicalCertifications,
        u.AmbulanceCallSign,
        u.FirefighterRank,
        u.BfpBadgeNumber,
        u.FireStation,
        u.FireSpecialization,
        u.ApparatusCallSign,
        u.PoliceRank,
        u.PnpBadgeNumber,
        u.PrecinctOrStation,
        u.PoliceAssignment,
        u.SidearmSerial,
        u.PlantillaNumber,
        u.ExecutiveDesignation,
        u.ClearanceLevel,
        u.IsDeleted,
        u.DeletedAt,
        u.DeletedBy,
        u.CreatedAt,
        u.UpdatedAt,
        u.EffectiveDisplayName,
        u.IdentityVerificationStatus,
        u.FacialVerificationStatus,
        !string.IsNullOrWhiteSpace(u.IdBackCapturePath)
    );
}
