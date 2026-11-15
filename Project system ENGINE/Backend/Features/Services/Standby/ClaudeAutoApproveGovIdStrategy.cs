// [Layer: Backend/Services/Standby]
// Responsibility: Implements Claude Standby AI Auto-Approval Strategy for uploaded Front & Back Government IDs using shared forensic evaluation.
// Strategy Pattern (OCP), Universal Lambda Expressions (=>), Fail-Closed AI Forensics (No Offline Approved Fallback), Zero Emojis.

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;

namespace ResQTrack.Backend.Features.Services.Standby;

public class ClaudeAutoApproveGovIdStrategy : IStandbyGovIdAutoApproveStrategy
{
    private const string MissingInputGateProviderName = "DeterministicStructuralGate";

    private readonly ApplicationDbContext _db;
    private readonly ILogger<ClaudeAutoApproveGovIdStrategy> _logger;
    private readonly IGovIdAuthenticityEvaluator _authenticityEvaluator;

    public ClaudeAutoApproveGovIdStrategy(
        ApplicationDbContext db,
        IConfiguration? configuration = null,
        IHttpClientFactory? httpClientFactory = null,
        ILogger<ClaudeAutoApproveGovIdStrategy>? logger = null,
        IClaudeMessagesClient? claudeMessagesClient = null,
        IGovIdAuthenticityEvaluator? authenticityEvaluator = null)
    {
        _db = db;
        _logger = logger ?? NullLogger<ClaudeAutoApproveGovIdStrategy>.Instance;

        IConfiguration resolvedConfig = configuration ?? new ConfigurationBuilder().Build();
        IClaudeMessagesClient resolvedClaudeClient = claudeMessagesClient
            ?? new ClaudeMessagesClient(
                httpClientFactory?.CreateClient("ClaudeMessages") ?? new HttpClient(),
                resolvedConfig,
                NullLogger<ClaudeMessagesClient>.Instance);

        _authenticityEvaluator = authenticityEvaluator
            ?? new SharedGovIdForensicsEvaluator(
                resolvedConfig,
                resolvedClaudeClient,
                NullLogger<SharedGovIdForensicsEvaluator>.Instance);
    }

    public string StrategyKey => "ClaudeStandbyAutoApproveGovId";

    public async Task<StandbyGovIdApprovalResult> EvaluateAndApproveAsync(
        StandbyGovIdApprovalRequest request,
        CancellationToken ct = default)
    {
        User? user = request.UserId != Guid.Empty
            ? await _db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            : null;

        string? govIdType = ResolveFirstNonEmpty(request.GovernmentIdType, user?.GovernmentIdType, user?.ValidIdType);
        string? frontImage = ResolveFirstNonEmpty(request.FrontIdImageUrl, user?.IdCapturePath);
        string? backImage = ResolveFirstNonEmpty(request.BackIdImageUrl, user?.IdBackCapturePath);
        string? firstName = ResolveFirstNonEmpty(request.FirstName, user?.FirstName, user?.FullName);
        string? lastName = ResolveFirstNonEmpty(request.LastName, user?.Surname);
        string? dob = ResolveFirstNonEmpty(request.DateOfBirth, user?.DateOfBirth?.ToString("yyyy-MM-dd"));

        if (string.IsNullOrWhiteSpace(frontImage) ||
            string.IsNullOrWhiteSpace(backImage) ||
            string.IsNullOrWhiteSpace(govIdType))
        {
            return BuildDecision(
                approved: false,
                decisionStatus: "ManualReviewRequired",
                providerUsed: MissingInputGateProviderName,
                confidenceScore: 0.0,
                reasoning: "Both Front and Back Government ID captures along with a valid GovernmentIdType are required for automatic Standby AI approval.",
                userId: request.UserId);
        }

        if (string.Equals(frontImage.Trim(), backImage.Trim(), StringComparison.Ordinal))
        {
            return BuildDecision(
                approved: false,
                decisionStatus: "Rejected",
                providerUsed: MissingInputGateProviderName,
                confidenceScore: 0.0,
                reasoning: "Front and Back Government ID uploads reference the exact same image; duplicate ID sides cannot be approved.",
                userId: request.UserId);
        }

        var (frontBytes, frontMime) = await ResolveImageBytesAsync(frontImage, ct);
        var (backBytes, backMime) = await ResolveImageBytesAsync(backImage, ct);

        if (frontBytes.Length == 0 || backBytes.Length == 0)
        {
            _logger.LogInformation(
                "Standby AI could not resolve readable Front/Back capture bytes for UserId={UserId}; flagging manual review.",
                request.UserId);

            return BuildDecision(
                approved: false,
                decisionStatus: "ManualReviewRequired",
                providerUsed: MissingInputGateProviderName,
                confidenceScore: 0.0,
                reasoning: "Stored Front or Back Government ID image bytes were unavailable for Claude Vision verification; account remains Pending manual review.",
                userId: request.UserId);
        }

        GovIdForensicsResult forensics = await _authenticityEvaluator.EvaluateAsync(
            new GovIdAuthenticityInput(
                FrontBytes: frontBytes,
                FrontMimeType: frontMime,
                BackBytes: backBytes,
                BackMimeType: backMime,
                SelectedIdType: govIdType!,
                PreferredModel: null,
                RequireDualSideVerification: true),
            ct);

        bool verifiedGenuine = forensics.Success &&
                               forensics.IsGenuineId &&
                               forensics.MatchesSelectedIdType &&
                               !forensics.AreSidesIdentical &&
                               !forensics.RequiresPendingManualReview &&
                               string.IsNullOrWhiteSpace(forensics.ErrorCode);

        if (!verifiedGenuine)
        {
            bool isProviderUnavailable = forensics.RequiresPendingManualReview ||
                                         string.Equals(forensics.ErrorCode, "PROVIDER_UNAVAILABLE", StringComparison.OrdinalIgnoreCase);

            string decisionStatus = isProviderUnavailable ? "ManualReviewRequired" : "Rejected";
            string failureReason = forensics.ErrorMessage
                                   ?? forensics.AuthenticityReason
                                   ?? "Government ID verification did not pass automated AI authenticity checks; manual review is required.";

            _logger.LogInformation(
                "Standby AI denied auto-approval for UserId={UserId} (Status={DecisionStatus}, ErrorCode={ErrorCode}, Provider={Provider}).",
                request.UserId,
                decisionStatus,
                forensics.ErrorCode ?? "NONE",
                forensics.ProviderUsed);

            return BuildDecision(
                approved: false,
                decisionStatus: decisionStatus,
                providerUsed: string.IsNullOrWhiteSpace(forensics.ProviderUsed) ? "PROVIDER_UNAVAILABLE" : forensics.ProviderUsed,
                confidenceScore: 0.0,
                reasoning: failureReason,
                userId: request.UserId);
        }

        string resolvedProvider = string.IsNullOrWhiteSpace(forensics.ModelUsed)
            ? forensics.ProviderUsed
            : forensics.ModelUsed!;

        double confidence = forensics.Confidence > 0.0
            ? Math.Round(Math.Clamp(forensics.Confidence, 0.0, 1.0), 2)
            : ComputeAiApprovalConfidence(firstName, lastName, dob);

        if (request.ApplyToDatabase && user != null)
        {
            ApplyVerifiedUserState(user, govIdType!, resolvedProvider);
            await _db.SaveChangesAsync(ct);
        }

        string approvedReason = !string.IsNullOrWhiteSpace(forensics.AuthenticityReason)
            ? forensics.AuthenticityReason!
            : $"Claude Vision confirmed genuine dual-side {govIdType} submission.";

        return BuildDecision(
            approved: true,
            decisionStatus: "Approved",
            providerUsed: resolvedProvider,
            confidenceScore: confidence,
            reasoning: approvedReason,
            userId: request.UserId);
    }

    private StandbyGovIdApprovalResult BuildDecision(
        bool approved,
        string decisionStatus,
        string providerUsed,
        double confidenceScore,
        string reasoning,
        Guid userId) =>
        new(
            Approved: approved,
            DecisionStatus: decisionStatus,
            StrategyName: StrategyKey,
            ProviderUsed: providerUsed,
            ConfidenceScore: confidenceScore,
            Reasoning: reasoning,
            UserId: userId,
            EvaluatedAtUtc: DateTime.UtcNow);

    private static async Task<(byte[] Bytes, string MimeType)> ResolveImageBytesAsync(
        string imageReference,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(imageReference))
        {
            return ([], "image/jpeg");
        }

        string trimmed = imageReference.Trim();
        if (trimmed.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var (mime, b64) = SharedGovIdForensicsEvaluator.ParseDataUrl(trimmed);
            return (SharedGovIdForensicsEvaluator.TryDecodeBase64(b64), mime);
        }

        string? resolvedPath = ResolveExistingFilePath(trimmed);
        if (resolvedPath is not null)
        {
            var (bytes, contentType) = await CaptureStorageHelper.ReadCaptureFileAsync(resolvedPath, ct);
            return (bytes, contentType);
        }

        if (!trimmed.Contains('/') && !trimmed.Contains('\\') && !trimmed.Contains(':'))
        {
            byte[] decoded = SharedGovIdForensicsEvaluator.TryDecodeBase64(trimmed);
            if (decoded.Length > 0)
            {
                return (decoded, "image/jpeg");
            }
        }

        return ([], "image/jpeg");
    }

    private static string? ResolveExistingFilePath(string rawPath)
    {
        if (File.Exists(rawPath))
        {
            return rawPath;
        }

        string relative = rawPath.TrimStart('/', '\\');
        if (string.IsNullOrWhiteSpace(relative))
        {
            return null;
        }

        string combined = Path.Combine(Directory.GetCurrentDirectory(), relative);
        return File.Exists(combined) ? combined : null;
    }

    private static double ComputeAiApprovalConfidence(
        string? firstName,
        string? lastName,
        string? dob)
    {
        double score = 0.75;
        if (!string.IsNullOrWhiteSpace(firstName)) score += 0.10;
        if (!string.IsNullOrWhiteSpace(lastName)) score += 0.10;
        if (!string.IsNullOrWhiteSpace(dob)) score += 0.05;
        return Math.Round(Math.Clamp(score, 0.0, 1.0), 2);
    }

    private static void ApplyVerifiedUserState(User user, string govIdType, string providerUsed) =>
        (
            user.Status,
            user.IdentityVerificationStatus,
            user.FacialVerificationStatus,
            user.IdentityVerificationProvider,
            user.FaceVerified,
            user.GovernmentIdType,
            user.ValidIdType,
            user.UpdatedAt
        ) = (
            AccountStatus.Verified,
            "Verified",
            "Verified",
            providerUsed.Length <= 60 ? providerUsed : providerUsed[..60],
            true,
            string.IsNullOrWhiteSpace(user.GovernmentIdType) ? govIdType : user.GovernmentIdType,
            string.IsNullOrWhiteSpace(user.ValidIdType) ? govIdType : user.ValidIdType,
            DateTime.UtcNow
        );

    private static string? ResolveFirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();
}
