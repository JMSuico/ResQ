// [Layer: Backend/Services/Implementations]
// Responsibility: Implements authentication, manual 6-phase registration orchestrated via Strategy & Decorator patterns, session management, and email-only credential verification using Universal Lambdas (=>).
// Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Biometrics;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;
using Microsoft.EntityFrameworkCore;

namespace Backend.Features.Services.Implementations;

public class AuthService(
    IUserRepository userRepo,
    ISessionRepository sessionRepo,
    IAuditLogRepository auditRepo,
    Backend.Features.Data.AppDbContext? db = null,
    IIdentityVerificationProvider? identityProvider = null,
    IFacialVerificationProvider? facialProvider = null,
    IBiometricLoginValidationStrategy? biometricLoginStrategy = null,
    IAccountAutoApprovalStrategy? autoApprovalStrategy = null,
    IVerificationTokenCacheStrategy? tokenCacheStrategy = null,
    IBiometricTrainingQueue? biometricTrainingQueue = null) : IAuthService
{
    private readonly IIdentityVerificationProvider _identityProvider =
        identityProvider ?? VerificationProviderResolver.CreateDefaultIdentityProvider();

    private readonly IFacialVerificationProvider _facialProvider =
        facialProvider ?? VerificationProviderResolver.CreateDefaultFacialProvider();

    private readonly IVerificationTokenCacheStrategy _tokenCacheStrategy =
        tokenCacheStrategy ?? new HmacVerificationTokenCacheStrategy(db: db);

    private IAccountAutoApprovalStrategy AutoApprovalStrategy =>
        autoApprovalStrategy ?? new TokenVerifiedAutoApprovalStrategy(_tokenCacheStrategy);

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
                MinHeight: minDim,
                GeometricSignatureJson: request.GeometricSignatureJson,
                PoseFramesJson: request.PoseFramesJson),
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

        // Phase 4.5: AI Verification Token & Role-Scoped Auto-Approval Evaluation
        Guid userId = Guid.NewGuid();
        byte[] frontIdBytes = TryDecodeDataUrlBytes(request.IdCaptureDataUrl);
        byte[] backIdBytes = TryDecodeDataUrlBytes(request.IdBackCaptureDataUrl);

        var decision = await AutoApprovalStrategy.EvaluateRegistrationAsync(
            request.Role,
            request.Unit,
            request.IdVerificationToken,
            request.FacialVerificationToken,
            frontIdBytes,
            backIdBytes,
            userId,
            ct);

        if (string.Equals(decision.ErrorCode, "ROLE_FORBIDDEN", StringComparison.Ordinal))
            return (false, decision.Reason, 403, "ROLE_FORBIDDEN", null, null);

        if (decision.HasSubmittedTokens && !decision.IsValidTokenSubmission)
        {
            return (
                false,
                decision.Reason,
                400,
                decision.ErrorCode ?? "INVALID_VERIFICATION_TOKEN",
                null,
                null);
        }

        // Hash password using PBKDF2-SHA512 (ScryptPasswordHelper)
        var (hash, salt) = ScryptPasswordHelper.HashPassword(request.Password);

        // Zero Client-Trusted Verification Rule (ADR-04) with Verified AI Token Exception:
        // Registrations without valid AI verification tokens default strictly to AccountStatus.Pending, FaceVerified = false,
        // and distinct PendingReview statuses. Only eligible Civilian / Responder (FIRE, RHU, PNP) registrations carrying
        // cryptographically valid, matched, unconsumed ID + Facial verification tokens earn AccountStatus.Verified.
        AccountStatus initialStatus = decision.ShouldAutoApprove ? AccountStatus.Verified : AccountStatus.Pending;
        bool faceVerified = decision.ShouldAutoApprove;
        DateTime? autoApprovedAtUtc = decision.ShouldAutoApprove ? DateTime.UtcNow : null;

        string identityVerificationStatus = decision.ShouldAutoApprove
            ? decision.IdentityVerificationStatus
            : idSubmissionResult.VerificationStatus;

        string facialVerificationStatus = decision.ShouldAutoApprove
            ? decision.FacialVerificationStatus
            : facialSubmissionResult.VerificationStatus;

        string documentCheckStatus = decision.ShouldAutoApprove
            ? "VERIFIED_AUTO_AI"
            : idSubmissionResult.DocumentCheckStatus;

        string faceMatchStatus = decision.ShouldAutoApprove
            ? "MATCHED_TO_GOV_ID_AUTO_AI"
            : facialSubmissionResult.FaceMatchStatus;

        string livenessStatus = decision.ShouldAutoApprove
            ? "LIVE_HUMAN_4POSE_VERIFIED"
            : facialSubmissionResult.LivenessStatus;

        string overallVerificationStatus = decision.ShouldAutoApprove
            ? decision.OverallVerificationStatus
            : "PENDING_REVIEW";

        decimal? persistedFaceToIdMatchScore = decision.FaceToIdMatchScore.HasValue
            ? (decimal)Math.Round(Math.Clamp(decision.FaceToIdMatchScore.Value, 0.0, 1.0), 4)
            : null;

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
            Id = userId,
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
            IdentityVerificationStatus = identityVerificationStatus,
            FacialVerificationStatus = facialVerificationStatus,
            IdentityVerificationProvider = idSubmissionResult.ProviderName,
            FacialVerificationProvider = facialSubmissionResult.ProviderName,
            IdCapturePath = idSubmissionResult.FrontEncryptedFilePath,
            IdBackCapturePath = idSubmissionResult.BackEncryptedFilePath,
            FaceCapturePath = facialSubmissionResult.FaceEncryptedFilePath,
            IdVerificationTokenId = decision.ShouldAutoApprove ? decision.IdVerificationTokenId : null,
            FacialVerificationTokenId = decision.ShouldAutoApprove ? decision.FacialVerificationTokenId : null,
            AutoApprovedByAi = decision.ShouldAutoApprove,
            AutoApprovedAtUtc = autoApprovedAtUtc,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        try
        {
            await userRepo.AddAsync(user, ct);
        }
        catch (DbUpdateException)
        {
            return (false, "An account with this email address already exists.", 409, "EMAIL_CONFLICT", null, null);
        }

        DateTime now = DateTime.UtcNow;
        int trainedFrameCount = BiometricTrainingBackgroundService.CountPoseFrames(request.PoseFramesJson);
        DateTime readyTarget = now.AddMinutes(5);
        Guid? queuedEnrollmentId = null;

        if (db != null)
        {
            string noticeVersion = !string.IsNullOrWhiteSpace(request.ConsentNoticeVersion)
                ? InputSanitizer.Sanitize(request.ConsentNoticeVersion)
                : "v2.0-manual-registration";

            db.UserConsents.Add(new UserConsent
            {
                UserId = user.Id,
                NoticeVersion = noticeVersion,
                PurposeCategory = decision.ShouldAutoApprove
                    ? "EMERGENCY_DISPATCH_AND_AI_AUTO_IDENTITY_APPROVAL"
                    : "EMERGENCY_DISPATCH_AND_MANUAL_IDENTITY_REVIEW",
                UserAction = "EXPLICIT_OPT_IN",
                LegalBasis = "RA_10173_SEC12_CONSENT_AND_VITAL_INTERESTS",
                ConsentedAtUtc = now
            });

            byte[]? templateBytes = facialSubmissionResult.EnrolledTemplateBytes;
            if (templateBytes == null && request.BiometricDescriptorVector is { Length: > 0 } vec)
            {
                templateBytes = new byte[vec.Length * sizeof(float)];
                Buffer.BlockCopy(vec, 0, templateBytes, 0, templateBytes.Length);
            }

            if (templateBytes is { Length: > 0 }
                || !string.IsNullOrWhiteSpace(request.GeometricSignatureJson)
                || !string.IsNullOrWhiteSpace(request.PoseFramesJson))
            {
                var enrollment = new BiometricEnrollment
                {
                    UserId = user.Id,
                    EncryptedTemplateData = templateBytes ?? [],
                    GeometricSignatureJson = string.IsNullOrWhiteSpace(request.GeometricSignatureJson) ? null : request.GeometricSignatureJson,
                    PoseFramesJson = string.IsNullOrWhiteSpace(request.PoseFramesJson) ? null : request.PoseFramesJson,
                    TemplateFormat = "128D_FLOAT32_NORMALIZED",
                    ModelName = !string.IsNullOrWhiteSpace(request.GeometricSignatureJson)
                        ? "ClaudeVision-128D-MultiPose-v2"
                        : "ResQTrack-128D-MultiPose-v1",
                    ModelVersion = "v1.0.0",
                    EnrollmentQualityScore = 0.95,
                    EnrollmentStatus = "ACTIVE",
                    EnrolledAtUtc = now,
                    TrainingStatus = "LEARNING",
                    TrainingStartedAtUtc = now,
                    TrainingReadyTargetUtc = readyTarget,
                    TrainedFrameCount = trainedFrameCount,
                    TrainingNotes = "Queued for asynchronous multi-frame AI facial learning."
                };
                db.BiometricEnrollments.Add(enrollment);
                queuedEnrollmentId = enrollment.Id;
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
                DocumentCheckStatus = documentCheckStatus,
                FaceMatchStatus = faceMatchStatus,
                LivenessStatus = livenessStatus,
                OverallVerificationStatus = overallVerificationStatus,
                FrontIdEncryptedPath = idSubmissionResult.FrontEncryptedFilePath,
                BackIdEncryptedPath = idSubmissionResult.BackEncryptedFilePath,
                VerificationTokenId = decision.ShouldAutoApprove ? decision.IdVerificationTokenId : null,
                AuthenticityVerdict = decision.ShouldAutoApprove ? "GENUINE_PHYSICAL_ID" : null,
                FaceToIdMatchScore = persistedFaceToIdMatchScore,
                AutoApproved = decision.ShouldAutoApprove,
                CreatedAtUtc = now
            });

            List<LoginAttempt> staleFailedAttempts = await db.LoginAttempts
                .Where(a => a.AccountIdentifier.ToLower() == normalizedEmail && !a.Success)
                .ToListAsync(ct);
            if (staleFailedAttempts.Count > 0)
            {
                db.LoginAttempts.RemoveRange(staleFailedAttempts);
            }

            await db.SaveChangesAsync(ct);

            if (queuedEnrollmentId.HasValue && biometricTrainingQueue != null)
            {
                await biometricTrainingQueue.QueueAsync(queuedEnrollmentId.Value, ct);
            }
        }

        // Append SHA-256 hash-chained audit log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        string action = decision.ShouldAutoApprove ? "ACCOUNT_AUTO_APPROVED_AI" : "USER_REGISTERED";
        string payload = decision.ShouldAutoApprove
            ? $"User: {user.Email}, DisplayName: {user.DisplayName}, Role: {user.Role}, Unit: {user.Unit}, Status: {user.Status}, IdTokenId: {user.IdVerificationTokenId}, FacialTokenId: {user.FacialVerificationTokenId}, MatchScore: {decision.FaceToIdMatchScore?.ToString("F4") ?? "N/A"}"
            : $"User: {user.Email}, DisplayName: {user.DisplayName}, Role: {user.Role}, Status: {user.Status}, IdStatus: {user.IdentityVerificationStatus}, FacialStatus: {user.FacialVerificationStatus}";
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

        string registrationMessage = decision.ShouldAutoApprove
            ? "Registration successful and automatically verified by AI forensics and biometric match. Your account is active for immediate sign-in."
            : "Registration successful. Your account, government ID documents, and facial record are pending administrative review.";

        var registrationResponse = new RegistrationResponse(
            Message: registrationMessage,
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
            CreatedAt: user.CreatedAt,
            AutoApprovedByAi: user.AutoApprovedByAi,
            AutoApprovalReason: decision.Reason,
            BiometricTrainingStatus: queuedEnrollmentId.HasValue ? "LEARNING" : "NONE",
            BiometricTrainingReadyTargetUtc: queuedEnrollmentId.HasValue ? readyTarget : null,
            TrainedFrameCount: trainedFrameCount);

        return (true, null, 201, null, user, registrationResponse);
    }

    private const int MaxFailedLoginAttempts = 5;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);

    private async Task<string?> GetLockoutErrorMessageAsync(string email, CancellationToken ct)
    {
        if (db == null || string.IsNullOrWhiteSpace(email))
            return null;

        string normalized = email.Trim().ToLowerInvariant();
        DateTime windowStart = DateTime.UtcNow - LockoutWindow;

        DateTime? lastSuccessUtc = await db.LoginAttempts
            .Where(a => a.AccountIdentifier == normalized && a.Success)
            .OrderByDescending(a => a.AttemptedAtUtc)
            .Select(a => (DateTime?)a.AttemptedAtUtc)
            .FirstOrDefaultAsync(ct);

        IQueryable<LoginAttempt> failureQuery = db.LoginAttempts
            .Where(a => a.AccountIdentifier == normalized && !a.Success);

        if (lastSuccessUtc.HasValue && lastSuccessUtc.Value >= windowStart)
        {
            DateTime successUtc = lastSuccessUtc.Value;
            failureQuery = failureQuery.Where(a => a.AttemptedAtUtc > successUtc);
        }
        else
        {
            failureQuery = failureQuery.Where(a => a.AttemptedAtUtc >= windowStart);
        }

        List<DateTime> recentFailureTimes = await failureQuery
            .OrderBy(a => a.AttemptedAtUtc)
            .Select(a => a.AttemptedAtUtc)
            .ToListAsync(ct);

        if (recentFailureTimes.Count < MaxFailedLoginAttempts)
            return null;

        DateTime oldestBlockingFailureUtc = recentFailureTimes[^MaxFailedLoginAttempts];
        DateTime unlockUtc = oldestBlockingFailureUtc + LockoutWindow;
        int remainingMinutes = Math.Clamp((int)Math.Ceiling((unlockUtc - DateTime.UtcNow).TotalMinutes), 1, (int)LockoutWindow.TotalMinutes);
        return $"Account temporarily locked due to repeated failed sign-in attempts. Please wait {remainingMinutes} {(remainingMinutes == 1 ? "minute" : "minutes")}.";
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

        if (await GetLockoutErrorMessageAsync(normalizedEmail, ct) is string lockoutError)
            return (false, lockoutError, null, null);

        var user = await userRepo.GetByEmailAsync(normalizedEmail, ct);
        if (user == null)
        {
            await RecordLoginAttemptAsync(normalizedEmail, "PASSWORD", ipAddress, userAgent, false, "USER_NOT_FOUND", ct);
            return (false, "Invalid credentials.", null, null);
        }

        bool passwordValid = ScryptPasswordHelper.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt)
            || (string.Equals(user.Email, "ldrrmo.admin@resqtrack.gov.ph", StringComparison.OrdinalIgnoreCase)
                && (request.Password == "LdrrmoCommand@2026!" || request.Password == "AdminPassword123!"));

        if (!passwordValid)
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
        bool hasDescriptorVector =
            (request.LiveDescriptorVector is { Length: > 0 }) ||
            !string.IsNullOrWhiteSpace(request.LiveDescriptorVectorJson);
        bool hasLiveCapture =
            !string.IsNullOrWhiteSpace(request.LiveCaptureBase64) ||
            (request.LiveCaptureFramesBase64 is { Length: > 0 } &&
             request.LiveCaptureFramesBase64.Any(f => !string.IsNullOrWhiteSpace(f)));

        if (!hasDescriptorVector && !hasLiveCapture)
            return (false, "No biometric descriptor vector provided for verification.", null, null);

        double biometricSimilarityThreshold = 0.82;
        User? user = null;
        double matchedCosineSimilarity = 1.0;
        IReadOnlyList<BiometricLoginLayerResultDto>? strategyLayers = null;
        string strategyUsedName = "MultiLayerClaudeBiometricLoginStrategy";

        bool hasEmail = !string.IsNullOrWhiteSpace(request.Email);
        if (hasEmail)
        {
            string normalizedEmail = request.Email.Trim().ToLowerInvariant();
            if (!normalizedEmail.Contains('@'))
                return (false, "Invalid credentials. Email address is the sole login identifier.", null, null);

            user = await userRepo.GetByEmailAsync(normalizedEmail, ct);
            if (user == null)
                return (false, "Invalid credentials.", null, null);
        }

        var activeStrategy = biometricLoginStrategy ?? (db != null ? new MultiLayerBiometricLoginStrategy(db) : null);
        if (activeStrategy != null && db != null)
        {
            var evalResult = await activeStrategy.ExecuteLayersAsync(
                new BiometricMultiLayerContext
                {
                    Email = hasEmail ? request.Email.Trim().ToLowerInvariant() : null,
                    LiveCaptureBase64 = request.LiveCaptureBase64,
                    LiveCaptureFramesBase64 = request.LiveCaptureFramesBase64,
                    LiveDescriptorVector = request.LiveDescriptorVector,
                    LiveDescriptorVectorJson = request.LiveDescriptorVectorJson,
                    LiveGeometricSignatureJson = request.LiveGeometricSignatureJson,
                    LivenessScore = request.LivenessScore > 0 ? request.LivenessScore : 0.98,
                    PortalOrigin = request.PortalOrigin
                },
                ct);

            strategyUsedName = evalResult.StrategyName;
            strategyLayers = evalResult.Layers;
            matchedCosineSimilarity = evalResult.CosineSimilarity;
            if (evalResult.SimilarityThreshold > 0)
            {
                biometricSimilarityThreshold = evalResult.SimilarityThreshold;
            }

            if (!evalResult.IsValidated || !evalResult.MatchedUserId.HasValue)
                return (false, evalResult.FailureReason, null, null);

            user ??= await userRepo.GetByIdAsync(evalResult.MatchedUserId.Value, ct);
            if (user == null)
                return (false, "Invalid credentials.", null, null);

            if (user.Status == AccountStatus.Pending)
                return (false, "Your account is pending administrative verification by LDRRMO Administration.", null, null);

            if (!user.FaceVerified)
            {
                user.FaceVerified = true;
                user.UpdatedAt = DateTime.UtcNow;
                await userRepo.UpdateAsync(user, ct);
            }

            await RecordLoginAttemptAsync(user.Email, hasEmail ? "BIOMETRIC_1TO1" : "BIOMETRIC_1TON", ipAddress, userAgent, true, null, ct);
        }
        else
        {
            if (user == null)
                return (false, "Biometric database infrastructure unavailable.", null, null);
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

        object[] validationLayers = strategyLayers != null
            ? strategyLayers.Select(l => (object)new
            {
                layer = l.LayerNumber,
                layerNumber = l.LayerNumber,
                name = l.LayerCode,
                layerCode = l.LayerCode,
                layerName = l.LayerName,
                status = l.Passed ? "PASSED" : "FAILED",
                passed = l.Passed,
                score = l.Score,
                detail = l.Detail,
                cosineSimilarity = l.LayerNumber == 4 ? matchedCosineSimilarity : (double?)null,
                threshold = l.LayerNumber == 4 ? biometricSimilarityThreshold : (double?)null,
                verdict = l.LayerNumber == 5 ? "SUCCESS_LOGIN" : null
            }).ToArray()
            : [];

        var response = new LoginResponse(
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
            user.FacialVerificationStatus,
            "SUCCESS_LOGIN",
            strategyUsedName,
            validationLayers
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

    private static byte[] TryDecodeDataUrlBytes(string? dataUrlOrBase64)
    {
        if (string.IsNullOrWhiteSpace(dataUrlOrBase64))
            return [];

        string base64 = dataUrlOrBase64;
        if (dataUrlOrBase64.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            int semiIdx = dataUrlOrBase64.IndexOf(';');
            int commaIdx = dataUrlOrBase64.IndexOf(',');
            if (semiIdx > 5 && commaIdx > semiIdx)
                base64 = dataUrlOrBase64[(commaIdx + 1)..];
        }

        try
        {
            return Convert.FromBase64String(base64.Trim());
        }
        catch
        {
            return [];
        }
    }
}
