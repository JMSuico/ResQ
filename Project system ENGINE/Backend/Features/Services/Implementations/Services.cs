// [Layer: Backend/Services/Implementations]
// Responsibility: Implements core business logic for authentication, triage, biometrics, and governance.
// DO NOT bypass password complexity validation or omit audit logs on state mutations.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class AuthService(
    IUserRepository userRepo,
    ISessionRepository sessionRepo,
    IAuditLogRepository auditRepo) : IAuthService
{
    public async Task<(bool Success, string? Error, User? User)> RegisterAsync(RegisterRequest request, string capturesRootPath, CancellationToken ct = default)
    {
        if (await userRepo.ExistsEmailAsync(request.Email, ct))
            return (false, "An account with this email address already exists.", null);

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12)
            return (false, "Password must be at least 12 characters long.", null);

        var (hash, salt) = ScryptPasswordHelper.HashPassword(request.Password);

        // Save biometric captures
        string? idPath = await CaptureStorageHelper.SavePngDataUrlAsync(request.IdCaptureDataUrl, capturesRootPath, "ID", ct);
        string? facePath = await CaptureStorageHelper.SavePngDataUrlAsync(request.FaceCaptureDataUrl, capturesRootPath, "FACE", ct);

        // Deterministic Verification Rule: Valid face capture immediately grants Verified status; otherwise Pending.
        bool faceVerified = !string.IsNullOrWhiteSpace(facePath);
        AccountStatus initialStatus = faceVerified ? AccountStatus.Verified : AccountStatus.Pending;

        var user = new User
        {
            Email = InputSanitizer.Sanitize(request.Email).ToLowerInvariant(),
            FullName = InputSanitizer.Sanitize(request.FullName),
            PhoneNumber = InputSanitizer.Sanitize(request.PhoneNumber),
            EmployeeOrResidentId = InputSanitizer.Sanitize(request.EmployeeOrResidentId),
            ValidIdType = request.ValidIdType,
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = request.Role,
            Unit = request.Unit,
            DepartmentOrBarangay = InputSanitizer.Sanitize(request.DepartmentOrBarangay),
            RankOrTitle = InputSanitizer.Sanitize(request.RankOrTitle),
            Status = initialStatus,
            FaceVerified = faceVerified,
            IdCapturePath = idPath,
            FaceCapturePath = facePath,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await userRepo.AddAsync(user, ct);

        // Append audit log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "USER_REGISTERED";
        string payload = $"User: {user.Email}, Role: {user.Role}, Status: {user.Status}, FaceVerified: {user.FaceVerified}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, user.Id, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = user.Id,
            Action = action,
            TargetEntity = nameof(User),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return (true, null, user);
    }

    public async Task<(bool Success, string? Error, string? RawToken, SessionResponse? Session)> LoginAsync(LoginRequest request, string ipAddress, string userAgent, CancellationToken ct = default)
    {
        var user = await userRepo.GetByEmailAsync(request.Email, ct);
        if (user == null)
            return (false, "Invalid credentials.", null, null);

        if (!ScryptPasswordHelper.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt))
            return (false, "Invalid credentials.", null, null);

        if (user.Status == AccountStatus.Suspended)
            return (false, "Your account has been suspended by LDRRMO Administration.", null, null);

        if (user.Status == AccountStatus.Pending)
            return (false, "Your account is pending biometric verification by LDRRMO Administration.", null, null);

        // Strict Port Origin Enforcement: Port 5174 is exclusively for LDRRMO_Admin
        if (string.Equals(request.PortalOrigin, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (user.Role != UserRole.LDRRMO_Admin)
            {
                return (false, "Access Denied: The Admin Command Portal on port 5174 is restricted exclusively to LDRRMO Administrators. Please sign in via the Emergency Responders & Civilians portal on port 5173.", null, null);
            }
        }

        string rawToken = SessionCookieHelper.GenerateSessionToken();
        string tokenHash = SessionCookieHelper.HashSessionToken(rawToken);
        DateTime expiresAt = DateTime.UtcNow.AddDays(7);

        var session = new Session
        {
            UserId = user.Id,
            TokenHash = tokenHash,
            Role = user.Role,
            Unit = user.Unit,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt
        };

        await sessionRepo.AddAsync(session, ct);

        string targetUrl = user.Role switch
        {
            UserRole.LDRRMO_Admin => "/admin/dashboard",
            UserRole.Responder => "/responder/dashboard",
            _ => "/civilian/dashboard"
        };

        var response = new SessionResponse(
            user.Id,
            user.FullName,
            user.Email,
            user.EmployeeOrResidentId,
            user.Role,
            user.Unit,
            user.Status,
            user.FaceVerified,
            user.DepartmentOrBarangay,
            user.RankOrTitle,
            targetUrl
        );

        return (true, null, rawToken, response);
    }

    public async Task<SessionResponse?> GetSessionDetailsAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userRepo.GetByIdAsync(userId, ct);
        if (user == null || user.Status != AccountStatus.Verified) return null;

        string targetUrl = user.Role switch
        {
            UserRole.LDRRMO_Admin => "/admin/dashboard",
            UserRole.Responder => "/responder/dashboard",
            _ => "/civilian/dashboard"
        };

        return new SessionResponse(
            user.Id,
            user.FullName,
            user.Email,
            user.EmployeeOrResidentId,
            user.Role,
            user.Unit,
            user.Status,
            user.FaceVerified,
            user.DepartmentOrBarangay,
            user.RankOrTitle,
            targetUrl
        );
    }

    public async Task RevokeSessionAsync(string rawToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return;
        string hash = SessionCookieHelper.HashSessionToken(rawToken);
        var session = await sessionRepo.GetByTokenHashAsync(hash, ct);
        if (session != null) await sessionRepo.RevokeAsync(session.Id, ct);
    }
}

public class ReportService(
    IReportRepository reportRepo,
    IUserRepository userRepo,
    IAuditLogRepository auditRepo) : IReportService
{
    public async Task<ReportResponse> CreateReportAsync(Guid reporterId, CreateReportRequest request, string reportsRootPath, CancellationToken ct = default)
    {
        var reporter = await userRepo.GetByIdAsync(reporterId, ct);
        string? imagePath = await CaptureStorageHelper.SavePngDataUrlAsync(request.ImageDataUrl, reportsRootPath, "REPORT", ct);

        string refCode = $"RESQ-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}"[..18].ToUpperInvariant();
        string recommendedAgency = DetermineRecommendedAgency(request.Category, request.Severity, request.Title, request.Note);
        bool requiresManualVerif = request.RequiresManualVerification == true || request.IsBlurry == true;

        var report = new Report
        {
            ReferenceCode = refCode,
            ReporterId = reporterId,
            ReporterName = reporter?.FullName ?? "Anonymous Resident",
            ReporterRole = reporter?.Role ?? UserRole.Civilian,
            Title = InputSanitizer.Sanitize(request.Title),
            Note = InputSanitizer.Sanitize(request.Note),
            Category = request.Category,
            Severity = request.Severity,
            Status = requiresManualVerif ? ReportStatus.Reported : ReportStatus.Reported,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            GpsAccuracyMeters = request.GpsAccuracyMeters,
            IsHardwareGeolocated = request.IsHardwareGeolocated ?? false,
            IsBlurry = request.IsBlurry ?? false,
            RequiresManualVerification = requiresManualVerif,
            RecommendedAgencyUnit = recommendedAgency,
            LocationLabel = InputSanitizer.Sanitize(request.LocationLabel),
            ImageCapturePath = imagePath,
            CreatedAt = DateTime.UtcNow
        };

        await reportRepo.AddAsync(report, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "REPORT_CREATED";
        string payload = $"Report: {refCode}, Cat: {report.Category}, Sev: {report.Severity}, Loc: {report.Latitude:F4},{report.Longitude:F4}, Blurry: {report.IsBlurry}, RecAgency: {recommendedAgency}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, reporterId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = reporterId,
            Action = action,
            TargetEntity = nameof(Report),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return MapToResponse(report);
    }

    public async Task<List<ReportResponse>> GetAllReportsAsync(CancellationToken ct = default) =>
        (await reportRepo.GetAllAsync(ct)).Select(MapToResponse).ToList();

    public async Task<List<ReportResponse>> GetMyReportsAsync(Guid userId, CancellationToken ct = default) =>
        (await reportRepo.GetByReporterIdAsync(userId, ct)).Select(MapToResponse).ToList();

    public async Task<List<ReportResponse>> GetAgencyReportsAsync(ResponderUnitType agency, CancellationToken ct = default) =>
        (await reportRepo.GetByUnitAgencyAsync(agency, ct)).Select(MapToResponse).ToList();

    public async Task<string?> GetReportImagePathAsync(Guid reportId, CancellationToken ct = default) =>
        (await reportRepo.GetByIdAsync(reportId, ct))?.ImageCapturePath;

    private static string DetermineRecommendedAgency(IncidentCategory category, IncidentSeverity severity, string title, string? note)
    {
        string text = $"{title} {note}".ToLowerInvariant();
        if (category == IncidentCategory.StructuralFire || text.Contains("fire") || text.Contains("smoke") || text.Contains("hazmat") || text.Contains("explosion") || text.Contains("gas"))
            return "FIRE (BFP)";
        if (category == IncidentCategory.MedicalEmergency || text.Contains("medical") || text.Contains("injury") || text.Contains("unconscious") || text.Contains("casualty") || text.Contains("bleeding"))
            return "RHU (Medical)";
        if (category == IncidentCategory.VehicularAccident || text.Contains("collision") || text.Contains("crash") || text.Contains("vehicle") || text.Contains("motorcycle"))
        {
            if (severity == IncidentSeverity.Critical || text.Contains("trapped") || text.Contains("fatal") || text.Contains("multiple"))
                return "Joint Dispatch: RHU + FIRE + PNP";
            return "PNP (Police Traffic)";
        }
        if (category == IncidentCategory.CrimeOrSecurity || text.Contains("fight") || text.Contains("assault") || text.Contains("robbery"))
            return "PNP (Police Sector)";

        return "LDRRMO Command Triage";
    }

    private static ReportResponse MapToResponse(Report r) =>
        new(
            r.Id,
            r.ReferenceCode,
            r.ReporterId,
            r.ReporterName,
            r.ReporterRole,
            r.Title,
            r.Note,
            r.Category,
            r.Severity,
            r.Status,
            r.Latitude,
            r.Longitude,
            r.LocationLabel,
            !string.IsNullOrWhiteSpace(r.ImageCapturePath),
            !string.IsNullOrWhiteSpace(r.ImageCapturePath) ? $"/api/reports/{r.Id}/image" : null,
            r.AllocatedUnitId,
            r.AllocatedUnitCode,
            r.CreatedAt,
            r.VerifiedAt,
            r.ResolvedAt,
            r.GpsAccuracyMeters,
            r.IsHardwareGeolocated,
            r.IsBlurry,
            r.RequiresManualVerification,
            r.RecommendedAgencyUnit
        );
}

public class TriageService(
    IReportRepository reportRepo,
    IDutyUnitRepository unitRepo,
    IIncidentFixtureRepository fixtureRepo,
    IAuditLogRepository auditRepo) : ITriageService
{
    public async Task<List<IncidentFixtureResponse>> GetActiveFixturesAsync(CancellationToken ct = default) =>
        (await fixtureRepo.GetAllActiveAsync(ct)).Select(f => new IncidentFixtureResponse(
            f.Id, f.FixtureCode, f.Title, f.Category, f.Severity, f.Latitude, f.Longitude, f.AssignedUnitType, f.IsActive, f.Description
        )).ToList();

    public async Task<(bool Success, string? Error)> VerifyReportAsync(Guid reportId, Guid adminId, VerifyReportRequest request, CancellationToken ct = default)
    {
        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report == null) return (false, "Report not found.");

        report.Status = request.Status;
        report.VerifiedAt = DateTime.UtcNow;
        if (request.Status == ReportStatus.Resolved) report.ResolvedAt = DateTime.UtcNow;

        await reportRepo.UpdateAsync(report, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "REPORT_VERIFIED";
        string payload = $"ReportId: {reportId}, Status: {request.Status}, AdminId: {adminId}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, adminId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = adminId,
            Action = action,
            TargetEntity = nameof(Report),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return (true, null);
    }

    public async Task<(bool Success, string? Error)> AllocateUnitAsync(Guid reportId, Guid adminId, Guid unitId, CancellationToken ct = default)
    {
        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report == null) return (false, "Report not found.");

        var unit = await unitRepo.GetByIdAsync(unitId, ct);
        if (unit == null) return (false, "Duty unit not found.");

        report.AllocatedUnitId = unit.Id;
        report.AllocatedUnitCode = unit.UnitCode;
        report.Status = ReportStatus.Allocated;

        await reportRepo.UpdateAsync(report, ct);
        await unitRepo.UpdateStatusAsync(unit.Id, DutyStatus.Dispatched, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "UNIT_ALLOCATED";
        string payload = $"ReportId: {reportId}, AllocatedTo: {unit.UnitCode} ({unit.Agency}), AdminId: {adminId}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, adminId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = adminId,
            Action = action,
            TargetEntity = nameof(Report),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return (true, null);
    }
}

public class RespondersService(IDutyUnitRepository unitRepo) : IRespondersService
{
    public async Task<List<DutyUnitResponse>> GetRosterAsync(CancellationToken ct = default) =>
        (await unitRepo.GetAllAsync(ct)).Select(d => new DutyUnitResponse(
            d.Id, d.UnitCode, d.UnitName, d.Agency, d.CommanderName, d.Status,
            d.BaseLatitude, d.BaseLongitude, d.ContactHotline, d.ActivePersonnelCount,
            d.ShiftSchedule, d.UpdatedAt
        )).ToList();

    public async Task<(bool Success, string? Error)> UpdateUnitStatusAsync(Guid unitId, DutyStatus status, CancellationToken ct = default)
    {
        var unit = await unitRepo.GetByIdAsync(unitId, ct);
        if (unit == null) return (false, "Unit not found.");

        await unitRepo.UpdateStatusAsync(unitId, status, ct);
        return (true, null);
    }
}

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
        var city = string.IsNullOrWhiteSpace(request.CityOrMunicipality) ? "Dipolog City" : InputSanitizer.Sanitize(request.CityOrMunicipality);

        var user = new User
        {
            Email = InputSanitizer.Sanitize(request.Email).ToLowerInvariant(),
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
            DepartmentOrBarangay = InputSanitizer.Sanitize(request.DepartmentOrBarangay ?? string.Empty),
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

        if (request.DepartmentOrBarangay != null) user.DepartmentOrBarangay = InputSanitizer.Sanitize(request.DepartmentOrBarangay);
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
        u.PhoneNumber
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
        u.UpdatedAt
    );
}

public class SettingsService(ISettingsRepository settingsRepo) : ISettingsService
{
    public async Task<List<SettingResponse>> GetAllSettingsAsync(CancellationToken ct = default) =>
        (await settingsRepo.GetAllAsync(ct)).Select(s => new SettingResponse(
            s.Id, s.Key, s.Value, s.Category, s.Description, s.UpdatedAt
        )).ToList();

    public async Task<bool> UpdateSettingAsync(string key, string value, Guid adminId, CancellationToken ct = default)
    {
        var setting = await settingsRepo.GetByKeyAsync(key, ct);
        if (setting == null) return false;

        setting.Value = value;
        setting.UpdatedByUserId = adminId;
        setting.UpdatedAt = DateTime.UtcNow;
        await settingsRepo.UpdateAsync(setting, ct);
        return true;
    }
}
