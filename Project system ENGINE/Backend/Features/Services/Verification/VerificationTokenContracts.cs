// [Layer: Backend/Services/Verification]
// Responsibility: Defines HMAC-SHA256 verification token contracts, dual-layer distributed cache + SQL Server replay ledger strategy, and role-scoped account auto-approval strategy.
// Compliance: Strategy Pattern (OCP), constant-time CryptographicOperations.FixedTimeEquals, universal arrow lambdas (=>), zero emojis.

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;

namespace Backend.Features.Services.Verification;

public sealed class VerificationTokenOptions
{
    public const string SectionName = "VerificationTokens";
    public string HmacSecret { get; set; } = string.Empty;
    public int TtlMinutes { get; set; } = 30;
    public double FaceToIdMatchThreshold { get; set; } = 0.72;
    public bool AllowAutoApproveInManualMode { get; set; } = true;
}

public sealed record TokenIssueResult(
    string Token,
    string TokenId,
    string ImagePairSha256,
    DateTime IssuedAtUtc,
    DateTime ExpiresAtUtc);

public sealed record TokenValidationResult(
    bool IsValid,
    string TokenId,
    string TokenType,
    string ImagePairSha256,
    string Verdict,
    Guid? RecordId,
    Guid? PairedIdTokenId,
    string? ErrorCode,
    string? ErrorMessage);

public sealed record AutoApprovalDecision(
    bool ShouldAutoApprove,
    bool HasSubmittedTokens,
    bool IsValidTokenSubmission,
    string ResultingStatus,
    string OverallVerificationStatus,
    string IdentityVerificationStatus,
    string FacialVerificationStatus,
    string? IdVerificationTokenId,
    string? FacialVerificationTokenId,
    double? FaceToIdMatchScore,
    string Reason,
    string? ErrorCode);

public interface IVerificationTokenCacheStrategy
{
    Task<TokenIssueResult> IssueIdTokenAsync(
        string imagePairSha256,
        string verdict,
        string providerUsed,
        string? modelUsed,
        string payloadJson,
        CancellationToken ct = default);

    Task<TokenIssueResult> IssueFacialTokenAsync(
        string imagePairSha256,
        string idTokenString,
        double faceToIdSimilarity,
        string providerUsed,
        string? modelUsed,
        string payloadJson,
        CancellationToken ct = default);

    Task<TokenValidationResult> ValidateTokenAsync(
        string token,
        string expectedTokenType,
        CancellationToken ct = default);

    Task<(bool Success, string? ErrorCode, string? ErrorMessage, TokenValidationResult? IdResult, TokenValidationResult? FacialResult)>
        ValidateAndConsumePairAsync(
            string idToken,
            string facialToken,
            string expectedImagePairSha256,
            Guid? consumedByUserId,
            CancellationToken ct = default);

    string ComputeImagePairSha256(byte[]? frontBytes, byte[]? backBytes);
}

public interface IAccountAutoApprovalStrategy
{
    Task<AutoApprovalDecision> EvaluateRegistrationAsync(
        UserRole role,
        ResponderUnitType unit,
        string? idVerificationToken,
        string? facialVerificationToken,
        byte[]? frontIdBytes,
        byte[]? backIdBytes,
        Guid userId,
        CancellationToken ct = default);
}

public class HmacVerificationTokenCacheStrategy(
    IOptions<VerificationTokenOptions>? options = null,
    IDistributedCache? cache = null,
    AppDbContext? db = null) : IVerificationTokenCacheStrategy
{
    private const string DefaultDevHmacSecret = "RESQTRACK-V2-TOKEN-HMAC-SHA256-DEV-SIGNING-KEY-2026-KATIPUNAN-7109";
    private const string CacheKeyPrefix = "verification:tok:";
    private static readonly TimeSpan CacheOperationTimeout = TimeSpan.FromMilliseconds(250);
    private static readonly TimeSpan RedisOfflineBackoff = TimeSpan.FromSeconds(60);
    private static readonly ConcurrentDictionary<string, CachedTokenState> StandbyCache = new(StringComparer.Ordinal);
    private static readonly object ConsumeSyncLock = new();
    private static long _redisBackoffUntilTicks;

    private readonly VerificationTokenOptions _options = options?.Value ?? new VerificationTokenOptions();

    private byte[] GetSigningKeyBytes() =>
        Encoding.UTF8.GetBytes(
            string.IsNullOrWhiteSpace(_options.HmacSecret)
                ? DefaultDevHmacSecret
                : _options.HmacSecret.Trim());

    private int GetEffectiveTtlMinutes() =>
        _options.TtlMinutes == 0 ? 30 : _options.TtlMinutes;

    public string ComputeImagePairSha256(byte[]? frontBytes, byte[]? backBytes)
    {
        byte[] frontHash = frontBytes is { Length: > 0 } ? SHA256.HashData(frontBytes) : [];
        byte[] backHash = backBytes is { Length: > 0 } ? SHA256.HashData(backBytes) : [];
        string combined = $"{Convert.ToHexString(frontHash)}|{Convert.ToHexString(backHash)}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(combined))).ToLowerInvariant();
    }

    public async Task<TokenIssueResult> IssueIdTokenAsync(
        string imagePairSha256,
        string verdict,
        string providerUsed,
        string? modelUsed,
        string payloadJson,
        CancellationToken ct = default)
    {
        string normalizedSha = NormalizeSha(imagePairSha256);
        string safeVerdict = BoundLength(string.IsNullOrWhiteSpace(verdict) ? "GENUINE_PHYSICAL_ID" : verdict.Trim(), 40);
        if (!IsPassingVerdict("ID", safeVerdict))
            throw new InvalidOperationException($"Cannot issue ID verification token for non-passing verdict '{safeVerdict}'.");

        return await IssueTokenInternalAsync(
            tokenType: "ID",
            imagePairSha256: normalizedSha,
            verdict: safeVerdict,
            pairedIdTokenId: null,
            score: 1.0,
            providerUsed: providerUsed,
            modelUsed: modelUsed,
            payloadJson: payloadJson,
            ct: ct);
    }

    public async Task<TokenIssueResult> IssueFacialTokenAsync(
        string imagePairSha256,
        string idTokenString,
        double faceToIdSimilarity,
        string providerUsed,
        string? modelUsed,
        string payloadJson,
        CancellationToken ct = default)
    {
        TokenValidationResult idValidation = await ValidateTokenAsync(idTokenString, "ID", ct);
        if (!idValidation.IsValid || !idValidation.RecordId.HasValue)
        {
            throw new InvalidOperationException(
                $"Cannot issue facial verification token without a valid unconsumed ID verification token ({idValidation.ErrorCode ?? "INVALID_VERIFICATION_TOKEN"}).");
        }

        string normalizedSha = NormalizeSha(imagePairSha256);
        if (!string.Equals(idValidation.ImagePairSha256, normalizedSha, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Cannot issue facial verification token: ImagePairSha256 does not match the linked ID verification token.");
        }

        return await IssueTokenInternalAsync(
            tokenType: "FACIAL",
            imagePairSha256: normalizedSha,
            verdict: "LIVE_FACE_ID_MATCHED",
            pairedIdTokenId: idValidation.RecordId.Value,
            score: Math.Round(Math.Clamp(faceToIdSimilarity, 0.0, 1.0), 4),
            providerUsed: providerUsed,
            modelUsed: modelUsed,
            payloadJson: payloadJson,
            ct: ct);
    }

    public async Task<TokenValidationResult> ValidateTokenAsync(
        string token,
        string expectedTokenType,
        CancellationToken ct = default)
    {
        if (!TryVerifyWireToken(token, out WireTokenPayload? wire, out string? errorCode, out string? errorMessage) || wire == null)
        {
            return InvalidResult(expectedTokenType, errorCode ?? "INVALID_VERIFICATION_TOKEN", errorMessage ?? "Invalid verification token.");
        }

        if (!string.Equals(wire.Typ, expectedTokenType, StringComparison.Ordinal))
        {
            return InvalidResult(
                expectedTokenType,
                "INVALID_VERIFICATION_TOKEN",
                $"Verification token type mismatch: expected '{expectedTokenType}', received '{wire.Typ}'.",
                wire.Jti,
                wire.Sha,
                wire.Vrd);
        }

        DateTime expiresAtUtc = DateTimeOffset.FromUnixTimeSeconds(wire.Exp).UtcDateTime;
        if (DateTime.UtcNow > expiresAtUtc)
        {
            return InvalidResult(
                expectedTokenType,
                "INVALID_VERIFICATION_TOKEN",
                "Verification token has expired.",
                wire.Jti,
                wire.Sha,
                wire.Vrd);
        }

        if (!IsPassingVerdict(wire.Typ, wire.Vrd))
        {
            return InvalidResult(
                expectedTokenType,
                "INVALID_VERIFICATION_TOKEN",
                $"Verification token verdict '{wire.Vrd}' does not permit verification approval.",
                wire.Jti,
                wire.Sha,
                wire.Vrd);
        }

        Guid? parsedPairedId = Guid.TryParse(wire.Pid, out Guid pidGuid) ? pidGuid : null;
        Guid? fallbackRecordId = Guid.TryParse(wire.Jti, out Guid jtiGuid) ? jtiGuid : null;

        if (StandbyCache.TryGetValue(wire.Jti, out CachedTokenState? standbyState))
        {
            if (standbyState.ConsumedAtUtc.HasValue)
            {
                return InvalidResult(
                    expectedTokenType,
                    "VERIFICATION_TOKEN_REPLAYED",
                    "Verification token has already been consumed.",
                    wire.Jti,
                    wire.Sha,
                    wire.Vrd,
                    standbyState.RecordId,
                    standbyState.PairedIdTokenId ?? parsedPairedId);
            }

            if (DateTime.UtcNow > standbyState.ExpiresAtUtc)
            {
                return InvalidResult(
                    expectedTokenType,
                    "INVALID_VERIFICATION_TOKEN",
                    "Verification token has expired.",
                    wire.Jti,
                    wire.Sha,
                    wire.Vrd);
            }
        }

        VerificationTokenRecord? dbRecord = null;
        if (db != null)
        {
            dbRecord = await db.VerificationTokenRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.TokenId == wire.Jti, ct);

            if (dbRecord != null)
            {
                if (dbRecord.ConsumedAtUtc.HasValue)
                {
                    return InvalidResult(
                        expectedTokenType,
                        "VERIFICATION_TOKEN_REPLAYED",
                        "Verification token has already been consumed.",
                        wire.Jti,
                        wire.Sha,
                        dbRecord.Verdict,
                        dbRecord.Id,
                        dbRecord.PairedIdTokenId ?? parsedPairedId);
                }

                if (DateTime.UtcNow > dbRecord.ExpiresAtUtc)
                {
                    return InvalidResult(
                        expectedTokenType,
                        "INVALID_VERIFICATION_TOKEN",
                        "Verification token has expired.",
                        wire.Jti,
                        wire.Sha,
                        dbRecord.Verdict,
                        dbRecord.Id,
                        dbRecord.PairedIdTokenId ?? parsedPairedId);
                }

                if (!string.Equals(dbRecord.TokenType, expectedTokenType, StringComparison.Ordinal)
                    || !string.Equals(dbRecord.ImagePairSha256, wire.Sha, StringComparison.OrdinalIgnoreCase)
                    || !IsPassingVerdict(dbRecord.TokenType, dbRecord.Verdict)
                    || dbRecord.PairedIdTokenId != parsedPairedId)
                {
                    return InvalidResult(
                        expectedTokenType,
                        "INVALID_VERIFICATION_TOKEN",
                        "Verification token record metadata does not match signed payload.",
                        wire.Jti,
                        wire.Sha,
                        dbRecord.Verdict,
                        dbRecord.Id,
                        dbRecord.PairedIdTokenId ?? parsedPairedId);
                }
            }
        }

        (bool cacheReachable, CachedTokenState? distributedState) = await SafeGetCacheAsync(CacheKey(wire.Jti), ct);
        if (distributedState != null)
        {
            if (distributedState.ConsumedAtUtc.HasValue)
            {
                return InvalidResult(
                    expectedTokenType,
                    "VERIFICATION_TOKEN_REPLAYED",
                    "Verification token has already been consumed.",
                    wire.Jti,
                    wire.Sha,
                    wire.Vrd,
                    distributedState.RecordId,
                    distributedState.PairedIdTokenId ?? parsedPairedId);
            }

            if (DateTime.UtcNow > distributedState.ExpiresAtUtc)
            {
                return InvalidResult(
                    expectedTokenType,
                    "INVALID_VERIFICATION_TOKEN",
                    "Verification token has expired.",
                    wire.Jti,
                    wire.Sha,
                    wire.Vrd);
            }
        }

        bool hasUnconsumedDb = dbRecord != null && !dbRecord.ConsumedAtUtc.HasValue;
        bool hasUnconsumedDistributedCache = distributedState != null && !distributedState.ConsumedAtUtc.HasValue;
        bool hasUnconsumedStandby = standbyState != null && !standbyState.ConsumedAtUtc.HasValue;
        bool hasActiveStorePresence =
            hasUnconsumedDb
            || hasUnconsumedDistributedCache
            || ((cache == null || !cacheReachable || standbyState?.CacheRetainedOnIssue == false) && hasUnconsumedStandby);

        if (!hasActiveStorePresence)
        {
            string missingCode = cacheReachable && standbyState != null
                ? "VERIFICATION_TOKEN_REPLAYED"
                : "INVALID_VERIFICATION_TOKEN";
            return InvalidResult(
                expectedTokenType,
                missingCode,
                "Verification token is no longer active in distributed cache or token ledger.",
                wire.Jti,
                wire.Sha,
                wire.Vrd);
        }

        Guid? effectiveRecordId = dbRecord?.Id ?? distributedState?.RecordId ?? standbyState?.RecordId ?? fallbackRecordId;
        Guid? effectivePairedId = dbRecord?.PairedIdTokenId ?? distributedState?.PairedIdTokenId ?? standbyState?.PairedIdTokenId ?? parsedPairedId;

        return new TokenValidationResult(
            IsValid: true,
            TokenId: wire.Jti,
            TokenType: wire.Typ,
            ImagePairSha256: wire.Sha,
            Verdict: dbRecord?.Verdict ?? wire.Vrd,
            RecordId: effectiveRecordId,
            PairedIdTokenId: effectivePairedId,
            ErrorCode: null,
            ErrorMessage: null);
    }

    public async Task<(bool Success, string? ErrorCode, string? ErrorMessage, TokenValidationResult? IdResult, TokenValidationResult? FacialResult)>
        ValidateAndConsumePairAsync(
            string idToken,
            string facialToken,
            string expectedImagePairSha256,
            Guid? consumedByUserId,
            CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(idToken) || string.IsNullOrWhiteSpace(facialToken))
        {
            return (false, "INVALID_VERIFICATION_TOKEN", "Both Government ID and Facial verification tokens are required.", null, null);
        }

        TokenValidationResult idResult = await ValidateTokenAsync(idToken, "ID", ct);
        if (!idResult.IsValid)
        {
            return (false, idResult.ErrorCode ?? "INVALID_VERIFICATION_TOKEN", idResult.ErrorMessage ?? "Invalid Government ID verification token.", idResult, null);
        }

        TokenValidationResult facialResult = await ValidateTokenAsync(facialToken, "FACIAL", ct);
        if (!facialResult.IsValid)
        {
            return (false, facialResult.ErrorCode ?? "INVALID_VERIFICATION_TOKEN", facialResult.ErrorMessage ?? "Invalid Facial verification token.", idResult, facialResult);
        }

        if (!idResult.RecordId.HasValue || !facialResult.PairedIdTokenId.HasValue || facialResult.PairedIdTokenId.Value != idResult.RecordId.Value)
        {
            return (
                false,
                "INVALID_VERIFICATION_TOKEN",
                "Facial verification token is not paired with the submitted Government ID verification token.",
                idResult,
                facialResult);
        }

        if (!string.Equals(idResult.ImagePairSha256, facialResult.ImagePairSha256, StringComparison.OrdinalIgnoreCase))
        {
            return (
                false,
                "INVALID_VERIFICATION_TOKEN",
                "Government ID and Facial verification tokens reference mismatched document digests.",
                idResult,
                facialResult);
        }

        if (!string.IsNullOrWhiteSpace(expectedImagePairSha256)
            && !string.Equals(idResult.ImagePairSha256, expectedImagePairSha256.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return (
                false,
                "INVALID_VERIFICATION_TOKEN",
                "Submitted Government ID images do not match the verified token pair.",
                idResult,
                facialResult);
        }

        DateTime consumedAtUtc = DateTime.UtcNow;

        if (db != null && db.Database.IsRelational())
        {
            List<VerificationTokenRecord> existingRows = await db.VerificationTokenRecords
                .AsNoTracking()
                .Where(t => t.TokenId == idResult.TokenId || t.TokenId == facialResult.TokenId)
                .ToListAsync(ct);

            if (existingRows.Any(r => r.ConsumedAtUtc.HasValue))
            {
                return (false, "VERIFICATION_TOKEN_REPLAYED", "Verification token has already been consumed.", idResult, facialResult);
            }

            if (existingRows.Any(r => consumedAtUtc > r.ExpiresAtUtc))
            {
                return (false, "INVALID_VERIFICATION_TOKEN", "Verification token has expired.", idResult, facialResult);
            }

            if (existingRows.Count > 0)
            {
                int updatedRows = await db.VerificationTokenRecords
                    .Where(t => (t.TokenId == idResult.TokenId || t.TokenId == facialResult.TokenId)
                                && t.ConsumedAtUtc == null
                                && t.ExpiresAtUtc >= consumedAtUtc)
                    .ExecuteUpdateAsync(
                        setters => setters
                            .SetProperty(t => t.ConsumedAtUtc, consumedAtUtc)
                            .SetProperty(t => t.ConsumedByUserId, consumedByUserId),
                        ct);

                if (updatedRows < existingRows.Count)
                {
                    return (false, "VERIFICATION_TOKEN_REPLAYED", "Verification token has already been consumed.", idResult, facialResult);
                }
            }
        }

        lock (ConsumeSyncLock)
        {
            if ((StandbyCache.TryGetValue(idResult.TokenId, out CachedTokenState? idStandby) && idStandby.ConsumedAtUtc.HasValue)
                || (StandbyCache.TryGetValue(facialResult.TokenId, out CachedTokenState? faceStandby) && faceStandby.ConsumedAtUtc.HasValue))
            {
                return (false, "VERIFICATION_TOKEN_REPLAYED", "Verification token has already been consumed.", idResult, facialResult);
            }

            MarkStandbyConsumed(idResult, consumedAtUtc, consumedByUserId);
            MarkStandbyConsumed(facialResult, consumedAtUtc, consumedByUserId);
        }

        if (db != null && !db.Database.IsRelational())
        {
            List<VerificationTokenRecord> records = await db.VerificationTokenRecords
                .Where(t => t.TokenId == idResult.TokenId || t.TokenId == facialResult.TokenId)
                .ToListAsync(ct);

            if (records.Any(r => r.ConsumedAtUtc.HasValue))
            {
                return (false, "VERIFICATION_TOKEN_REPLAYED", "Verification token has already been consumed.", idResult, facialResult);
            }

            if (records.Count > 0)
            {
                foreach (VerificationTokenRecord rec in records)
                {
                    rec.ConsumedAtUtc = consumedAtUtc;
                    rec.ConsumedByUserId = consumedByUserId;
                }
                await db.SaveChangesAsync(ct);
            }
        }

        await SafeRemoveCacheAsync(CacheKey(idResult.TokenId), ct);
        await SafeRemoveCacheAsync(CacheKey(facialResult.TokenId), ct);

        return (true, null, null, idResult, facialResult);
    }

    internal static double? TryReadScoreFromToken(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        string[] parts = token.Trim().Split('.');
        if (parts.Length != 2 || !TryBase64UrlDecode(parts[0], out byte[] payloadBytes)) return null;
        try
        {
            WireTokenPayload? wire = JsonSerializer.Deserialize<WireTokenPayload>(payloadBytes);
            return wire?.Score;
        }
        catch
        {
            return null;
        }
    }

    private async Task<TokenIssueResult> IssueTokenInternalAsync(
        string tokenType,
        string imagePairSha256,
        string verdict,
        Guid? pairedIdTokenId,
        double score,
        string providerUsed,
        string? modelUsed,
        string payloadJson,
        CancellationToken ct)
    {
        Guid recordId = Guid.NewGuid();
        string tokenId = recordId.ToString("N");
        DateTime issuedAtUtc = DateTime.UtcNow;
        int ttlMinutes = GetEffectiveTtlMinutes();
        DateTime expiresAtUtc = issuedAtUtc.AddMinutes(ttlMinutes);
        long expUnix = new DateTimeOffset(expiresAtUtc).ToUnixTimeSeconds();

        var wirePayload = new WireTokenPayload(
            Jti: tokenId,
            Typ: tokenType,
            Sha: imagePairSha256,
            Vrd: verdict,
            Pid: pairedIdTokenId?.ToString("D"),
            Score: score,
            Exp: expUnix);

        byte[] payloadBytes = JsonSerializer.SerializeToUtf8Bytes(wirePayload);
        byte[] hmacBytes = HMACSHA256.HashData(GetSigningKeyBytes(), payloadBytes);
        string encodedPayload = Base64UrlEncode(payloadBytes);
        string encodedSignature = Base64UrlEncode(hmacBytes);
        string tokenString = $"{encodedPayload}.{encodedSignature}";
        string hmacHex = Convert.ToHexString(hmacBytes).ToLowerInvariant();

        var cacheState = new CachedTokenState(
            RecordId: recordId,
            TokenId: tokenId,
            TokenType: tokenType,
            ImagePairSha256: imagePairSha256,
            Verdict: verdict,
            PairedIdTokenId: pairedIdTokenId,
            Score: score,
            IssuedAtUtc: issuedAtUtc,
            ExpiresAtUtc: expiresAtUtc,
            ConsumedAtUtc: null,
            ConsumedByUserId: null,
            CacheRetainedOnIssue: true);

        bool cacheRetainedOnIssue = await SafeSetCacheAsync(CacheKey(tokenId), cacheState, ttlMinutes, ct);
        StandbyCache[tokenId] = cacheState with { CacheRetainedOnIssue = cacheRetainedOnIssue };

        if (db != null)
        {
            var record = new VerificationTokenRecord
            {
                Id = recordId,
                TokenId = BoundLength(tokenId, 64),
                TokenType = BoundLength(tokenType, 16),
                ImagePairSha256 = BoundLength(imagePairSha256, 128),
                Verdict = BoundLength(verdict, 40),
                ProviderUsed = BoundLength(string.IsNullOrWhiteSpace(providerUsed) ? "ClaudeVision" : providerUsed.Trim(), 64),
                ModelUsed = BoundLength(modelUsed?.Trim() ?? string.Empty, 64),
                PayloadJson = string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson,
                HmacSignature = BoundLength(hmacHex, 128),
                PairedIdTokenId = pairedIdTokenId,
                IssuedAtUtc = issuedAtUtc,
                ExpiresAtUtc = expiresAtUtc,
                ConsumedAtUtc = null,
                ConsumedByUserId = null,
                IsSyntheticTestToken = false
            };

            db.VerificationTokenRecords.Add(record);
            await db.SaveChangesAsync(ct);
        }

        return new TokenIssueResult(
            Token: tokenString,
            TokenId: tokenId,
            ImagePairSha256: imagePairSha256,
            IssuedAtUtc: issuedAtUtc,
            ExpiresAtUtc: expiresAtUtc);
    }

    private bool TryVerifyWireToken(
        string? token,
        out WireTokenPayload? payload,
        out string? errorCode,
        out string? errorMessage)
    {
        payload = null;
        errorCode = null;
        errorMessage = null;

        if (string.IsNullOrWhiteSpace(token))
        {
            errorCode = "INVALID_VERIFICATION_TOKEN";
            errorMessage = "Verification token is missing.";
            return false;
        }

        string[] segments = token.Trim().Split('.');
        if (segments.Length != 2
            || string.IsNullOrWhiteSpace(segments[0])
            || string.IsNullOrWhiteSpace(segments[1]))
        {
            errorCode = "INVALID_VERIFICATION_TOKEN";
            errorMessage = "Verification token format is malformed.";
            return false;
        }

        if (!TryBase64UrlDecode(segments[0], out byte[] payloadBytes)
            || !TryBase64UrlDecode(segments[1], out byte[] providedSig))
        {
            errorCode = "INVALID_VERIFICATION_TOKEN";
            errorMessage = "Verification token encoding is invalid.";
            return false;
        }

        byte[] expectedSig = HMACSHA256.HashData(GetSigningKeyBytes(), payloadBytes);
        if (providedSig.Length != expectedSig.Length
            || !CryptographicOperations.FixedTimeEquals(expectedSig, providedSig))
        {
            errorCode = "INVALID_VERIFICATION_TOKEN";
            errorMessage = "Verification token HMAC signature is invalid.";
            return false;
        }

        try
        {
            payload = JsonSerializer.Deserialize<WireTokenPayload>(payloadBytes);
        }
        catch
        {
            payload = null;
        }

        if (payload == null
            || string.IsNullOrWhiteSpace(payload.Jti)
            || string.IsNullOrWhiteSpace(payload.Typ)
            || string.IsNullOrWhiteSpace(payload.Sha))
        {
            errorCode = "INVALID_VERIFICATION_TOKEN";
            errorMessage = "Verification token payload is incomplete.";
            return false;
        }

        return true;
    }

    private static void MarkStandbyConsumed(TokenValidationResult token, DateTime consumedAtUtc, Guid? userId) =>
        StandbyCache.AddOrUpdate(
            token.TokenId,
            _ => new CachedTokenState(
                RecordId: token.RecordId ?? Guid.NewGuid(),
                TokenId: token.TokenId,
                TokenType: token.TokenType,
                ImagePairSha256: token.ImagePairSha256,
                Verdict: token.Verdict,
                PairedIdTokenId: token.PairedIdTokenId,
                Score: 0.0,
                IssuedAtUtc: consumedAtUtc,
                ExpiresAtUtc: consumedAtUtc.AddMinutes(30),
                ConsumedAtUtc: consumedAtUtc,
                ConsumedByUserId: userId),
            (_, existing) => existing with
            {
                ConsumedAtUtc = consumedAtUtc,
                ConsumedByUserId = userId
            });

    private static bool IsRedisCircuitOpen() =>
        DateTime.UtcNow.Ticks < Interlocked.Read(ref _redisBackoffUntilTicks);

    private static void TripRedisCircuitBreaker() =>
        Interlocked.Exchange(ref _redisBackoffUntilTicks, DateTime.UtcNow.Add(RedisOfflineBackoff).Ticks);

    private static void ResetRedisCircuitBreaker() =>
        Interlocked.Exchange(ref _redisBackoffUntilTicks, 0);

    private async Task<bool> SafeSetCacheAsync(string key, CachedTokenState state, int ttlMinutes, CancellationToken ct)
    {
        if (cache == null || IsRedisCircuitOpen()) return false;
        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(CacheOperationTimeout);
            TimeSpan ttl = TimeSpan.FromMinutes(Math.Max(1, ttlMinutes));
            var entryOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ttl,
                SlidingExpiration = ttl
            };
            await cache.SetStringAsync(key, JsonSerializer.Serialize(state), entryOptions, timeoutCts.Token);
            string? verifyRaw = await cache.GetStringAsync(key, timeoutCts.Token);
            bool verified = !string.IsNullOrWhiteSpace(verifyRaw);
            if (verified) ResetRedisCircuitBreaker();
            return verified;
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            TripRedisCircuitBreaker();
            // Standby ConcurrentDictionary retains token state when Redis is offline.
            return false;
        }
        catch
        {
            return false;
        }
    }

    private async Task<(bool CacheReachable, CachedTokenState? State)> SafeGetCacheAsync(string key, CancellationToken ct)
    {
        if (cache == null || IsRedisCircuitOpen()) return (false, null);
        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(CacheOperationTimeout);
            string? raw = await cache.GetStringAsync(key, timeoutCts.Token);
            ResetRedisCircuitBreaker();
            if (string.IsNullOrWhiteSpace(raw)) return (true, null);
            return (true, JsonSerializer.Deserialize<CachedTokenState>(raw));
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            TripRedisCircuitBreaker();
            return (false, null);
        }
        catch
        {
            return (false, null);
        }
    }

    private async Task SafeRemoveCacheAsync(string key, CancellationToken ct)
    {
        if (cache == null || IsRedisCircuitOpen()) return;
        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(CacheOperationTimeout);
            await cache.RemoveAsync(key, timeoutCts.Token);
            ResetRedisCircuitBreaker();
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            TripRedisCircuitBreaker();
            // Standby ConcurrentDictionary already marks token consumed when Redis is offline.
        }
        catch
        {
            // Standby ConcurrentDictionary already marks token consumed when Redis is offline.
        }
    }

    private static string CacheKey(string tokenId) =>
        $"{CacheKeyPrefix}{tokenId}";

    private string NormalizeSha(string? sha) =>
        string.IsNullOrWhiteSpace(sha)
            ? ComputeImagePairSha256(null, null)
            : sha.Trim().ToLowerInvariant();

    private static string BoundLength(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    private static bool IsPassingVerdict(string tokenType, string? verdict)
    {
        if (string.IsNullOrWhiteSpace(verdict)) return false;
        string upper = verdict.Trim().ToUpperInvariant();
        if (upper.Contains("REJECT", StringComparison.Ordinal)
            || upper.Contains("FAKE", StringComparison.Ordinal)
            || upper.Contains("MISMATCH", StringComparison.Ordinal)
            || upper.Contains("SPOOF", StringComparison.Ordinal)
            || upper.Contains("NON_ID", StringComparison.Ordinal)
            || upper.Contains("UNREADABLE", StringComparison.Ordinal)
            || upper.Contains("INVALID", StringComparison.Ordinal)
            || upper.Contains("EXPIRED", StringComparison.Ordinal)
            || upper.Contains("REVOKED", StringComparison.Ordinal)
            || upper.Contains("FAIL", StringComparison.Ordinal)
            || upper.Contains("PENDING_MANUAL", StringComparison.Ordinal))
        {
            return false;
        }

        return tokenType is "ID" or "FACIAL";
    }

    private static TokenValidationResult InvalidResult(
        string expectedTokenType,
        string errorCode,
        string errorMessage,
        string tokenId = "",
        string imagePairSha256 = "",
        string verdict = "",
        Guid? recordId = null,
        Guid? pairedIdTokenId = null) =>
        new(
            IsValid: false,
            TokenId: tokenId,
            TokenType: expectedTokenType,
            ImagePairSha256: imagePairSha256,
            Verdict: verdict,
            RecordId: recordId,
            PairedIdTokenId: pairedIdTokenId,
            ErrorCode: errorCode,
            ErrorMessage: errorMessage);

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    private static bool TryBase64UrlDecode(string input, out byte[] bytes)
    {
        bytes = [];
        try
        {
            string padded = input.Replace('-', '+').Replace('_', '/');
            int mod = padded.Length % 4;
            if (mod == 2) padded += "==";
            else if (mod == 3) padded += "=";
            else if (mod == 1) return false;
            bytes = Convert.FromBase64String(padded);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private sealed record WireTokenPayload(
        [property: JsonPropertyName("jti")] string Jti,
        [property: JsonPropertyName("typ")] string Typ,
        [property: JsonPropertyName("sha")] string Sha,
        [property: JsonPropertyName("vrd")] string Vrd,
        [property: JsonPropertyName("pid")] string? Pid,
        [property: JsonPropertyName("score")] double Score,
        [property: JsonPropertyName("exp")] long Exp);

    private sealed record CachedTokenState(
        Guid RecordId,
        string TokenId,
        string TokenType,
        string ImagePairSha256,
        string Verdict,
        Guid? PairedIdTokenId,
        double Score,
        DateTime IssuedAtUtc,
        DateTime ExpiresAtUtc,
        DateTime? ConsumedAtUtc,
        Guid? ConsumedByUserId,
        bool CacheRetainedOnIssue = false);
}

public class TokenVerifiedAutoApprovalStrategy(
    IVerificationTokenCacheStrategy? tokenCache = null,
    IOptions<VerificationTokenOptions>? options = null) : IAccountAutoApprovalStrategy
{
    private readonly IVerificationTokenCacheStrategy _tokenCache =
        tokenCache ?? new HmacVerificationTokenCacheStrategy(options);

    private readonly VerificationTokenOptions _options =
        options?.Value ?? new VerificationTokenOptions();

    public async Task<AutoApprovalDecision> EvaluateRegistrationAsync(
        UserRole role,
        ResponderUnitType unit,
        string? idVerificationToken,
        string? facialVerificationToken,
        byte[]? frontIdBytes,
        byte[]? backIdBytes,
        Guid userId,
        CancellationToken ct = default)
    {
        bool hasIdToken = !string.IsNullOrWhiteSpace(idVerificationToken);
        bool hasFacialToken = !string.IsNullOrWhiteSpace(facialVerificationToken);
        bool hasAnyToken = hasIdToken || hasFacialToken;

        if (role == UserRole.LDRRMO_Admin || unit == ResponderUnitType.LDRRMO)
        {
            return new AutoApprovalDecision(
                ShouldAutoApprove: false,
                HasSubmittedTokens: hasAnyToken,
                IsValidTokenSubmission: false,
                ResultingStatus: "Rejected",
                OverallVerificationStatus: "ROLE_FORBIDDEN",
                IdentityVerificationStatus: "Rejected",
                FacialVerificationStatus: "Rejected",
                IdVerificationTokenId: null,
                FacialVerificationTokenId: null,
                FaceToIdMatchScore: null,
                Reason: "Self-registration and AI auto-approval are forbidden for LDRRMO_Admin accounts.",
                ErrorCode: "ROLE_FORBIDDEN");
        }

        if (!hasIdToken && !hasFacialToken)
        {
            return BuildPendingDecision(
                hasSubmittedTokens: false,
                reason: "No AI verification tokens submitted; account queued for manual LDRRMO administrative review.");
        }

        if (hasIdToken ^ hasFacialToken)
        {
            return new AutoApprovalDecision(
                ShouldAutoApprove: false,
                HasSubmittedTokens: true,
                IsValidTokenSubmission: false,
                ResultingStatus: "Rejected",
                OverallVerificationStatus: "INVALID_VERIFICATION_TOKEN",
                IdentityVerificationStatus: "PendingReview",
                FacialVerificationStatus: "PendingReview",
                IdVerificationTokenId: null,
                FacialVerificationTokenId: null,
                FaceToIdMatchScore: null,
                Reason: "Both IdVerificationToken and FacialVerificationToken are required when submitting verified registration tokens.",
                ErrorCode: "INVALID_VERIFICATION_TOKEN");
        }

        string expectedImagePairSha256 = (frontIdBytes is { Length: > 0 } || backIdBytes is { Length: > 0 })
            ? _tokenCache.ComputeImagePairSha256(frontIdBytes, backIdBytes)
            : string.Empty;

        var (success, errorCode, errorMessage, idResult, facialResult) = await _tokenCache.ValidateAndConsumePairAsync(
            idVerificationToken!.Trim(),
            facialVerificationToken!.Trim(),
            expectedImagePairSha256,
            userId,
            ct);

        if (!success)
        {
            return new AutoApprovalDecision(
                ShouldAutoApprove: false,
                HasSubmittedTokens: true,
                IsValidTokenSubmission: false,
                ResultingStatus: "Rejected",
                OverallVerificationStatus: errorCode ?? "INVALID_VERIFICATION_TOKEN",
                IdentityVerificationStatus: "PendingReview",
                FacialVerificationStatus: "PendingReview",
                IdVerificationTokenId: idResult?.TokenId,
                FacialVerificationTokenId: facialResult?.TokenId,
                FaceToIdMatchScore: null,
                Reason: errorMessage ?? "Verification token validation failed.",
                ErrorCode: errorCode ?? "INVALID_VERIFICATION_TOKEN");
        }

        if (!IsAutoApproveEligibleRole(role, unit))
        {
            return BuildPendingDecision(
                hasSubmittedTokens: true,
                reason: $"Role '{role}' with unit '{unit}' is not eligible for AI auto-approval and requires manual LDRRMO review.");
        }

        if (!_options.AllowAutoApproveInManualMode)
        {
            return BuildPendingDecision(
                hasSubmittedTokens: true,
                reason: "Automatic approval is disabled in current verification configuration; queued for manual LDRRMO review.");
        }

        double? faceScore = HmacVerificationTokenCacheStrategy.TryReadScoreFromToken(facialVerificationToken);
        double threshold = _options.FaceToIdMatchThreshold > 0 ? _options.FaceToIdMatchThreshold : 0.72;
        if (faceScore.HasValue && faceScore.Value > 0.0 && faceScore.Value < threshold)
        {
            return new AutoApprovalDecision(
                ShouldAutoApprove: false,
                HasSubmittedTokens: true,
                IsValidTokenSubmission: false,
                ResultingStatus: "Rejected",
                OverallVerificationStatus: "FACE_TO_ID_MISMATCH",
                IdentityVerificationStatus: "VERIFIED_AUTO_AI",
                FacialVerificationStatus: "Rejected",
                IdVerificationTokenId: idResult?.TokenId,
                FacialVerificationTokenId: facialResult?.TokenId,
                FaceToIdMatchScore: faceScore,
                Reason: $"Facial match score ({faceScore.Value:F2}) is below the required auto-approval threshold ({threshold:F2}).",
                ErrorCode: "FACE_TO_ID_MISMATCH");
        }

        string unitLabel = role == UserRole.Responder && unit != ResponderUnitType.None
            ? $" ({unit})"
            : string.Empty;

        return new AutoApprovalDecision(
            ShouldAutoApprove: true,
            HasSubmittedTokens: true,
            IsValidTokenSubmission: true,
            ResultingStatus: "Verified",
            OverallVerificationStatus: "APPROVED_AUTO_AI",
            IdentityVerificationStatus: "VERIFIED_AUTO_AI",
            FacialVerificationStatus: "VERIFIED_AUTO_AI",
            IdVerificationTokenId: idResult?.TokenId,
            FacialVerificationTokenId: facialResult?.TokenId,
            FaceToIdMatchScore: faceScore,
            Reason: $"Account automatically approved by AI Government ID forensics and Face-to-ID biometric token verification for {role}{unitLabel}.",
            ErrorCode: null);
    }

    private static bool IsAutoApproveEligibleRole(UserRole role, ResponderUnitType unit) =>
        role == UserRole.Civilian
        || (role == UserRole.Responder && unit is ResponderUnitType.FIRE or ResponderUnitType.RHU or ResponderUnitType.PNP);

    private static AutoApprovalDecision BuildPendingDecision(bool hasSubmittedTokens, string reason) =>
        new(
            ShouldAutoApprove: false,
            HasSubmittedTokens: hasSubmittedTokens,
            IsValidTokenSubmission: true,
            ResultingStatus: "Pending",
            OverallVerificationStatus: "PENDING_REVIEW",
            IdentityVerificationStatus: "PendingReview",
            FacialVerificationStatus: "PendingReview",
            IdVerificationTokenId: null,
            FacialVerificationTokenId: null,
            FaceToIdMatchScore: null,
            Reason: reason,
            ErrorCode: null);
}
