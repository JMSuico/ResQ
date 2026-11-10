// [Layer: Backend/Services/Implementations]
// Responsibility: Implements authentication, registration, session management, and credential verification using Universal Lambdas (=>).
// Zero emojis.

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

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 5)
            return (false, "Password must be at least 5 characters long.", null);

        var (hash, salt) = ScryptPasswordHelper.HashPassword(request.Password);

        // Save biometric captures
        string? idPath = await CaptureStorageHelper.SavePngDataUrlAsync(request.IdCaptureDataUrl, capturesRootPath, "ID", ct);
        string? facePath = await CaptureStorageHelper.SavePngDataUrlAsync(request.FaceCaptureDataUrl, capturesRootPath, "FACE", ct);

        // Deterministic Verification Rule: Valid face capture immediately grants Verified status; otherwise Pending.
        bool faceVerified = !string.IsNullOrWhiteSpace(facePath);
        AccountStatus initialStatus = faceVerified ? AccountStatus.Verified : AccountStatus.Pending;

        var nameParts = (request.FullName ?? string.Empty).Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        string firstName = nameParts.Length > 0 ? nameParts[0] : string.Empty;
        string surname = nameParts.Length > 1 ? nameParts[1] : string.Empty;

        var user = new User
        {
            Email = InputSanitizer.Sanitize(request.Email).ToLowerInvariant(),
            FullName = InputSanitizer.Sanitize(request.FullName),
            FirstName = InputSanitizer.Sanitize(firstName),
            Surname = InputSanitizer.Sanitize(surname),
            Sex = request.Sex,
            DateOfBirth = request.Age.HasValue ? DateTime.UtcNow.AddYears(-request.Age.Value) : null,
            GovernmentIdType = request.GovernmentIdType ?? request.ValidIdType,
            GovernmentIdNumber = request.GovernmentIdNumber ?? request.EmployeeOrResidentId,
            PhoneNumber = InputSanitizer.Sanitize(request.PhoneNumber),
            EmployeeOrResidentId = InputSanitizer.Sanitize(request.EmployeeOrResidentId),
            ValidIdType = request.ValidIdType,
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = request.Role,
            Unit = request.Unit,
            DepartmentOrBarangay = string.IsNullOrWhiteSpace(request.DepartmentOrBarangay) ? null : InputSanitizer.Sanitize(request.DepartmentOrBarangay),
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
        else
        {
            // Port 5173 is exclusively for Responders and Civilians; Admins must use dedicated Port 5174 Command Center
            if (user.Role == UserRole.LDRRMO_Admin)
            {
                return (false, "Access Denied: LDRRMO Administrator personnel must sign in via the dedicated Command Portal on port 5174 (http://localhost:5174/admin/login).", null, null);
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
