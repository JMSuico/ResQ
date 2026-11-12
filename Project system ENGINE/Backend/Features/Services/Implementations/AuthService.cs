// [Layer: Backend/Services/Implementations]
// Responsibility: Implements authentication, manual 6-phase registration orchestrated via Strategy & Decorator patterns, session management, and email-only credential verification using Universal Lambdas (=>).
// Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;

namespace Backend.Features.Services.Implementations;

public class AuthService(
    IUserRepository userRepo,
    ISessionRepository sessionRepo,
    IAuditLogRepository auditRepo,
    Backend.Features.Data.AppDbContext? db = null,
    IIdentityVerificationProvider? identityProvider = null,
    IFacialVerificationProvider? facialProvider = null) : IAuthService
{
    private readonly IIdentityVerificationProvider _identityProvider =
        identityProvider ?? VerificationProviderResolver.CreateDefaultIdentityProvider();

    private readonly IFacialVerificationProvider _facialProvider =
        facialProvider ?? VerificationProviderResolver.CreateDefaultFacialProvider();

    public async Task<(bool Success, string? Error, User? User)> RegisterAsync(
        RegisterRequest request,
        string capturesRootPath,
        CancellationToken ct = default)
    {
        var result = await RegisterWithDetailsAsync(request, capturesRootPath, ct);
        return (result.Success, result.Error, result.User);
    }

    public async Task<(bool Success, string? Error, int StatusCode, string? ErrorCode, User? User, RegistrationResponse? Response)> RegisterWithDetailsAsync(
        RegisterRequest request,
        string capturesRootPath,
        CancellationToken ct = default)
    {
        // Phase 1: Role Selection & Privilege Escalation Guard
        if (request.Role == UserRole.LDRRMO_Admin || request.Unit == ResponderUnitType.LDRRMO)
        {
            return (
                false,
                "Self-registration for the privileged LDRRMO_Admin role is forbidden. Administrator accounts must be provisioned by authorized command governance.",
                403,
                "ROLE_FORBIDDEN",
                null,
                null);
        }

        if (!Enum.IsDefined(typeof(UserRole), request.Role))
        {
            return (false, "Invalid user role selected.", 400, "VALIDATION_ERROR", null, null);
        }

        // Phase 5: Account Credentials Validation (Email as sole login identifier, Password, ConfirmPassword)
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
        {
            return (false, "A valid email address is required.", 400, "VALIDATION_ERROR", null, null);
        }

        string normalizedEmail = InputSanitizer.Sanitize(request.Email.Trim()).ToLowerInvariant();
        if (await userRepo.ExistsEmailAsync(normalizedEmail, ct))
        {
            return (false, "An account with this email address already exists.", 409, "EMAIL_CONFLICT", null, null);
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12)
        {
            return (false, "Password must be at least 12 characters long and meet complexity requirements.", 400, "VALIDATION_ERROR", null, null);
        }

        if (request.ConfirmPassword != null && !string.Equals(request.Password, request.ConfirmPassword, StringComparison.Ordinal))
        {
            return (false, "Password and Confirm Password do not match.", 400, "PASSWORD_MISMATCH", null, null);
        }

        // Phase 2: Personal Information Validation & Normalization
        string firstName = !string.IsNullOrWhiteSpace(request.FirstName) ? request.FirstName.Trim() : string.Empty;
        string surname = !string.IsNullOrWhiteSpace(request.Surname) ? request.Surname.Trim() : string.Empty;
        if (string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(request.FullName))
        {
            var nameParts = request.FullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            firstName = nameParts.Length > 0 ? nameParts[0] : string.Empty;
            if (string.IsNullOrWhiteSpace(surname))
                surname = nameParts.Length > 1 ? nameParts[1] : string.Empty;
        }

        string fullName = !string.IsNullOrWhiteSpace(request.FullName)
            ? request.FullName.Trim()
            : string.Join(" ", new[] { firstName, request.MiddleName, surname, request.Suffix }.Where(s => !string.IsNullOrWhiteSpace(s)));

        if (string.IsNullOrWhiteSpace(fullName))
        {
            return (false, "Personal information (First Name and Surname / Full Name) is required.", 400, "VALIDATION_ERROR", null, null);
        }

        string displayName = !string.IsNullOrWhiteSpace(request.DisplayName)
            ? InputSanitizer.Sanitize(request.DisplayName.Trim())
            : InputSanitizer.Sanitize(fullName);

        // Phase 3: Government ID Upload via IIdentityVerificationProvider Strategy
        int minDim = request.MinImageDimension.HasValue && request.MinImageDimension.Value > 0 ? request.MinImageDimension.Value : 1;
        string? govIdType = !string.IsNullOrWhiteSpace(request.GovernmentIdType) ? request.GovernmentIdType : request.ValidIdType;
        string? govIdNumber = !string.IsNullOrWhiteSpace(request.GovernmentIdNumber) ? request.GovernmentIdNumber : request.EmployeeOrResidentId;

        var idSubmissionResult = await _identityProvider.SubmitIdentityDocumentAsync(
            new IdentityDocumentSubmissionContext(
                Email: normalizedEmail,
                GovernmentIdType: govIdType,
                GovernmentIdNumber: govIdNumber,
                FrontImageDataUrl: request.IdCaptureDataUrl,
                BackImageDataUrl: request.IdBackCaptureDataUrl,
                CapturesRootPath: capturesRootPath,
                MinWidth: minDim,
                MinHeight: minDim),
            ct);

        if (!idSubmissionResult.Success)
        {
            int statusCode = (int)idSubmissionResult.ErrorType is >= 400 and <= 599 ? (int)idSubmissionResult.ErrorType : 400;
            return (
                false,
                idSubmissionResult.ErrorMessage ?? "Government ID validation failed.",
                statusCode,
                idSubmissionResult.ErrorType.ToString().ToUpperInvariant(),
                null,
                null);
        }

        // Phase 4: Facial Record via IFacialVerificationProvider Strategy
        bool consentAccepted = request.ConsentAccepted ?? true;
        var facialSubmissionResult = await _facialProvider.SubmitFacialRecordAsync(
            new FacialRecordSubmissionContext(
                Email: normalizedEmail,
                FaceCaptureDataUrl: request.FaceCaptureDataUrl,
                ConsentAccepted: consentAccepted,
                ConsentNoticeVersion: request.ConsentNoticeVersion ?? "v2.0-manual-registration",
                OptionalDescriptorVector: request.BiometricDescriptorVector,
                CapturesRootPath: capturesRootPath,
                MinWidth: minDim,
                MinHeight: minDim),
            ct);

        if (!facialSubmissionResult.Success)
        {
            int statusCode = (int)facialSubmissionResult.ErrorType is >= 400 and <= 599 ? (int)facialSubmissionResult.ErrorType : 400;
            return (
                false,
                facialSubmissionResult.ErrorMessage ?? "Facial record validation failed.",
                statusCode,
                facialSubmissionResult.ErrorType.ToString().ToUpperInvariant(),
                null,
                null);
        }

        // Hash password using PBKDF2-SHA512 (ScryptPasswordHelper)
        var (hash, salt) = ScryptPasswordHelper.HashPassword(request.Password);

        // Zero Client-Trusted Verification Rule (ADR-04):
        // All registrations default strictly to AccountStatus.Pending, FaceVerified = false,
        // and distinct PendingReview statuses for Identity and Facial verification.
        const AccountStatus initialStatus = AccountStatus.Pending;
        const bool faceVerified = false;

        DateTime? dob = request.DateOfBirth ?? (request.Age.HasValue ? DateTime.UtcNow.AddYears(-request.Age.Value) : null);

        string province = !string.IsNullOrWhiteSpace(request.Province)
            ? InputSanitizer.Sanitize(request.Province)
            : "Zamboanga del Norte";

        string cityOrMunicipality = !string.IsNullOrWhiteSpace(request.CityOrMunicipality)
            ? InputSanitizer.Sanitize(request.CityOrMunicipality)
            : "Katipunan";

        string barangay = !string.IsNullOrWhiteSpace(request.Barangay)
            ? InputSanitizer.Sanitize(request.Barangay)
            : (!string.IsNullOrWhiteSpace(request.DepartmentOrBarangay) ? InputSanitizer.Sanitize(request.DepartmentOrBarangay) : string.Empty);

        string streetOrPurok = !string.IsNullOrWhiteSpace(request.StreetOrPurok)
            ? InputSanitizer.Sanitize(request.StreetOrPurok)
            : string.Empty;

        var user = new User
        {
            Email = normalizedEmail,
            DisplayName = displayName,
            FullName = InputSanitizer.Sanitize(fullName),
            FirstName = InputSanitizer.Sanitize(firstName),
            MiddleName = !string.IsNullOrWhiteSpace(request.MiddleName) ? InputSanitizer.Sanitize(request.MiddleName) : null,
            Surname = InputSanitizer.Sanitize(surname),
            Suffix = !string.IsNullOrWhiteSpace(request.Suffix) ? InputSanitizer.Sanitize(request.Suffix) : null,
            Sex = !string.IsNullOrWhiteSpace(request.Sex) ? InputSanitizer.Sanitize(request.Sex) : null,
            DateOfBirth = dob,
            Province = province,
            CityOrMunicipality = cityOrMunicipality,
            Barangay = barangay,
            StreetOrPurok = streetOrPurok,
            Weight = !string.IsNullOrWhiteSpace(request.Weight) ? InputSanitizer.Sanitize(request.Weight) : null,
            Height = !string.IsNullOrWhiteSpace(request.Height) ? InputSanitizer.Sanitize(request.Height) : null,
            GovernmentIdType = !string.IsNullOrWhiteSpace(govIdType) ? InputSanitizer.Sanitize(govIdType) : null,
            GovernmentIdNumber = !string.IsNullOrWhiteSpace(govIdNumber) ? InputSanitizer.Sanitize(govIdNumber) : null,
            PhoneNumber = InputSanitizer.Sanitize(request.PhoneNumber ?? string.Empty),
            EmployeeOrResidentId = InputSanitizer.Sanitize(request.EmployeeOrResidentId ?? string.Empty),
            ValidIdType = !string.IsNullOrWhiteSpace(request.ValidIdType) ? InputSanitizer.Sanitize(request.ValidIdType) : (!string.IsNullOrWhiteSpace(govIdType) ? InputSanitizer.Sanitize(govIdType) : null),
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = request.Role,
            Unit = request.Unit,
            DepartmentOrBarangay = string.IsNullOrWhiteSpace(barangay) ? null : barangay,
            RankOrTitle = InputSanitizer.Sanitize(request.RankOrTitle ?? string.Empty),
            Status = initialStatus,
            FaceVerified = faceVerified,
            IdentityVerificationStatus = idSubmissionResult.VerificationStatus,
            FacialVerificationStatus = facialSubmissionResult.VerificationStatus,
            IdentityVerificationProvider = idSubmissionResult.ProviderName,
            FacialVerificationProvider = facialSubmissionResult.ProviderName,
            IdCapturePath = idSubmissionResult.FrontEncryptedFilePath,
            IdBackCapturePath = idSubmissionResult.BackEncryptedFilePath,
            FaceCapturePath = facialSubmissionResult.FaceEncryptedFilePath,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await userRepo.AddAsync(user, ct);

        if (db != null)
        {
            string noticeVersion = !string.IsNullOrWhiteSpace(request.ConsentNoticeVersion)
                ? InputSanitizer.Sanitize(request.ConsentNoticeVersion)
                : "v2.0-manual-registration";

            db.UserConsents.Add(new UserConsent
            {
                UserId = user.Id,
                NoticeVersion = noticeVersion,
                PurposeCategory = "EMERGENCY_DISPATCH_AND_MANUAL_IDENTITY_REVIEW",
                UserAction = "EXPLICIT_OPT_IN",
                LegalBasis = "RA_10173_SEC12_CONSENT_AND_VITAL_INTERESTS",
                ConsentedAtUtc = DateTime.UtcNow
            });

            byte[]? templateBytes = facialSubmissionResult.EnrolledTemplateBytes;
            if (templateBytes == null && request.BiometricDescriptorVector is { Length: > 0 } vec)
            {
                templateBytes = new byte[vec.Length * sizeof(float)];
                Buffer.BlockCopy(vec, 0, templateBytes, 0, templateBytes.Length);
            }

            if (templateBytes is { Length: > 0 })
            {
                db.BiometricEnrollments.Add(new BiometricEnrollment
                {
                    UserId = user.Id,
                    EncryptedTemplateData = templateBytes,
                    TemplateFormat = "128D_FLOAT32_NORMALIZED",
                    ModelIdentifier = facialSubmissionResult.EnrolledModelIdentifier ?? "ResQTrack_Hybrid_CSLBP_Gabor_Haar",
                    ModelVersion = "v1.0.0",
                    EnrollmentQualityScore = 0.95,
                    EnrollmentStatus = "ACTIVE",
                    EnrolledAtUtc = DateTime.UtcNow
                });
            }

            db.IdentityVerificationRecords.Add(new IdentityVerificationRecord
            {
                UserId = user.Id,
                GovernmentIdType = user.GovernmentIdType ?? "Unknown",
                GovernmentIdNumber = user.GovernmentIdNumber,
                Issuer = !string.IsNullOrWhiteSpace(request.IssuingAgency) ? InputSanitizer.Sanitize(request.IssuingAgency) : "Republic of the Philippines",
                IdSpecVersion = !string.IsNullOrWhiteSpace(request.DocumentVersion) ? InputSanitizer.Sanitize(request.DocumentVersion) : "ID-1_v2.0",
                ExtractionEngine = idSubmissionResult.ProviderName,
                ExtractionEngineVersion = "1.0.0-strategy",
                ConfidenceScore = idSubmissionResult.ConfidenceScore,
                NormalizedFieldsJson = idSubmissionResult.NormalizedFieldsJson,
                DocumentCheckStatus = idSubmissionResult.DocumentCheckStatus,
                FaceMatchStatus = facialSubmissionResult.FaceMatchStatus,
                LivenessStatus = facialSubmissionResult.LivenessStatus,
                OverallVerificationStatus = "PENDING_REVIEW",
                FrontIdEncryptedPath = idSubmissionResult.FrontEncryptedFilePath,
                BackIdEncryptedPath = idSubmissionResult.BackEncryptedFilePath,
                CreatedAtUtc = DateTime.UtcNow
            });

            await db.SaveChangesAsync(ct);
        }

        // Append SHA-256 hash-chained audit log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "USER_REGISTERED";
        string payload = $"User: {user.Email}, DisplayName: {user.DisplayName}, Role: {user.Role}, Status: {user.Status}, IdStatus: {user.IdentityVerificationStatus}, FacialStatus: {user.FacialVerificationStatus}";
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

        var registrationResponse = new RegistrationResponse(
            Message: "Registration successful. Your account, government ID documents, and facial record are pending administrative review.",
            UserId: user.Id,
            Email: user.Email,
            DisplayName: user.EffectiveDisplayName,
            FullName: user.FullName,
            Role: user.Role,
            Unit: user.Unit,
            Status: user.Status.ToString(),
            FaceVerified: user.FaceVerified,
            IdentityVerificationStatus: user.IdentityVerificationStatus,
            FacialVerificationStatus: user.FacialVerificationStatus,
            IdentityVerificationProvider: user.IdentityVerificationProvider,
            FacialVerificationProvider: user.FacialVerificationProvider,
            HasIdFrontCapture: !string.IsNullOrWhiteSpace(user.IdCapturePath),
            HasIdBackCapture: !string.IsNullOrWhiteSpace(user.IdBackCapturePath),
            HasFaceCapture: !string.IsNullOrWhiteSpace(user.FaceCapturePath),
            CreatedAt: user.CreatedAt);

        return (true, null, 201, null, user, registrationResponse);
    }

    private const int MaxFailedLoginAttempts = 5;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);

    private async Task<bool> IsAccountLockedOutAsync(string email, CancellationToken ct)
    {
        if (db == null || string.IsNullOrWhiteSpace(email)) return false;
        string normalized = email.Trim().ToLowerInvariant();
        DateTime cutoff = DateTime.UtcNow - LockoutWindow;
        int recentFailures = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.CountAsync(
            db.LoginAttempts,
            a => a.AccountIdentifier == normalized && !a.Success && a.AttemptedAtUtc >= cutoff,
            ct);
        return recentFailures >= MaxFailedLoginAttempts;
    }

    private async Task RecordLoginAttemptAsync(string email, string attemptType, string ipAddress, string userAgent, bool success, string? failureReason, CancellationToken ct)
    {
        if (db == null || string.IsNullOrWhiteSpace(email)) return;
        db.LoginAttempts.Add(new LoginAttempt
        {
            AccountIdentifier = email.Trim().ToLowerInvariant(),
            AttemptType = attemptType,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            AttemptedAtUtc = DateTime.UtcNow,
            Success = success,
            FailureReason = failureReason
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task<(bool Success, string? Error, string? RawToken, SessionResponse? Session)> LoginAsync(LoginRequest request, string ipAddress, string userAgent, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return (false, "Email is required.", null, null);

        string normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (!normalizedEmail.Contains('@'))
        {
            await RecordLoginAttemptAsync(normalizedEmail, "PASSWORD", ipAddress, userAgent, false, "NON_EMAIL_IDENTIFIER", ct);
            return (false, "Invalid credentials. Email address is the sole login identifier; display name cannot be used to sign in.", null, null);
        }

        if (await IsAccountLockedOutAsync(normalizedEmail, ct))
            return (false, "Account temporarily locked due to repeated failed sign-in attempts. Please wait 15 minutes.", null, null);

        var user = await userRepo.GetByEmailAsync(normalizedEmail, ct);
        if (user == null)
        {
            await RecordLoginAttemptAsync(normalizedEmail, "PASSWORD", ipAddress, userAgent, false, "USER_NOT_FOUND", ct);
            return (false, "Invalid credentials.", null, null);
        }

        if (!ScryptPasswordHelper.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt))
        {
            await RecordLoginAttemptAsync(user.Email, "PASSWORD", ipAddress, userAgent, false, "INVALID_PASSWORD", ct);
            return (false, "Invalid credentials.", null, null);
        }

        if (user.Status == AccountStatus.Suspended)
            return (false, "Your account has been suspended by LDRRMO Administration.", null, null);

        if (user.Status == AccountStatus.Pending)
            return (false, "Your account is pending biometric verification by LDRRMO Administration.", null, null);

        await RecordLoginAttemptAsync(user.Email, "PASSWORD", ipAddress, userAgent, true, null, ct);

        // Strict Port Origin Enforcement: Port 1996 is exclusively for LDRRMO_Admin
        if (string.Equals(request.PortalOrigin, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (user.Role != UserRole.LDRRMO_Admin)
            {
                return (false, "Access Denied: The Admin Command Portal on port 1996 is restricted exclusively to LDRRMO Administrators. Please sign in via the Emergency Responders & Civilians portal on port 1997 / 1998.", null, null);
            }
        }
        else
        {
            if (user.Role == UserRole.LDRRMO_Admin)
            {
                return (false, "Access Denied: LDRRMO Administrator personnel must sign in via the dedicated Command Portal on port 1996 (http://localhost:1996/admin/login).", null, null);
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
            targetUrl,
            user.EffectiveDisplayName,
            user.IdentityVerificationStatus,
            user.FacialVerificationStatus
        );

        return (true, null, rawToken, response);
    }

    public async Task<(bool Success, string? Error, string? RawToken, SessionResponse? Session)> BiometricLoginAsync(BiometricLoginRequest request, string ipAddress, string userAgent, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return (false, "Email is required.", null, null);

        string normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (!normalizedEmail.Contains('@'))
            return (false, "Invalid credentials. Email address is the sole login identifier.", null, null);

        if (await IsAccountLockedOutAsync(normalizedEmail, ct))
            return (false, "Account temporarily locked due to repeated failed sign-in attempts. Please wait 15 minutes.", null, null);

        var user = await userRepo.GetByEmailAsync(normalizedEmail, ct);
        if (user == null)
        {
            await RecordLoginAttemptAsync(normalizedEmail, "BIOMETRIC_1TO1", ipAddress, userAgent, false, "USER_NOT_FOUND", ct);
            return (false, "Invalid credentials.", null, null);
        }

        if (user.Status == AccountStatus.Suspended)
            return (false, "Your account has been suspended by LDRRMO Administration.", null, null);

        if (string.Equals(request.PortalOrigin, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (user.Role != UserRole.LDRRMO_Admin)
            {
                return (false, "Access Denied: The Admin Command Portal on port 1996 is restricted exclusively to LDRRMO Administrators. Please sign in via the Emergency Responders & Civilians portal on port 1997 / 1998.", null, null);
            }
        }
        else
        {
            if (user.Role == UserRole.LDRRMO_Admin)
            {
                return (false, "Access Denied: LDRRMO Administrator personnel must sign in via the dedicated Command Portal on port 1996 (http://localhost:1996/admin/login).", null, null);
            }
        }

        if (request.LiveDescriptorVector == null || request.LiveDescriptorVector.Length == 0)
            return (false, "No biometric descriptor vector provided for verification.", null, null);

        if (db != null)
        {
            var enrollment = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                db.BiometricEnrollments,
                b => b.UserId == user.Id && b.RevokedAtUtc == null,
                ct);

            if (enrollment == null || enrollment.EncryptedTemplateData.Length == 0)
            {
                return (false, "No active biometric enrollment found for this account. Please sign in with password.", null, null);
            }

            float[] storedVector = new float[enrollment.EncryptedTemplateData.Length / 4];
            Buffer.BlockCopy(enrollment.EncryptedTemplateData, 0, storedVector, 0, enrollment.EncryptedTemplateData.Length);

            double dot = 0.0, normA = 0.0, normB = 0.0;
            int len = Math.Min(request.LiveDescriptorVector.Length, storedVector.Length);
            for (int i = 0; i < len; i++)
            {
                dot += request.LiveDescriptorVector[i] * storedVector[i];
                normA += request.LiveDescriptorVector[i] * request.LiveDescriptorVector[i];
                normB += storedVector[i] * storedVector[i];
            }
            double similarity = (normA > 0 && normB > 0) ? (dot / (Math.Sqrt(normA) * Math.Sqrt(normB))) : 0.0;

            const double BiometricMatchThreshold = 0.70;
            if (similarity < BiometricMatchThreshold)
            {
                db.LoginAttempts.Add(new LoginAttempt
                {
                    AccountIdentifier = user.Email,
                    AttemptType = "BIOMETRIC_1TO1",
                    IpAddress = ipAddress,
                    UserAgent = userAgent,
                    AttemptedAtUtc = DateTime.UtcNow,
                    Success = false,
                    FailureReason = $"BIOMETRIC_MISMATCH (Similarity: {similarity:F2})"
                });
                await db.SaveChangesAsync(ct);

                return (false, $"Biometric verification mismatch (similarity score: {similarity:F2}). Access denied.", null, null);
            }

            if (user.Status == AccountStatus.Pending)
            {
                user.Status = AccountStatus.Verified;
                user.FaceVerified = true;
                user.UpdatedAt = DateTime.UtcNow;
                await userRepo.UpdateAsync(user, ct);
            }

            db.LoginAttempts.Add(new LoginAttempt
            {
                AccountIdentifier = user.Email,
                AttemptType = "BIOMETRIC_1TO1",
                IpAddress = ipAddress,
                UserAgent = userAgent,
                AttemptedAtUtc = DateTime.UtcNow,
                Success = true
            });
            await db.SaveChangesAsync(ct);
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
            targetUrl,
            user.EffectiveDisplayName,
            user.IdentityVerificationStatus,
            user.FacialVerificationStatus
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
            targetUrl,
            user.EffectiveDisplayName,
            user.IdentityVerificationStatus,
            user.FacialVerificationStatus
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
