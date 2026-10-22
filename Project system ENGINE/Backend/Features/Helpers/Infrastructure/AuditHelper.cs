// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Computes cryptographic SHA-256 hash chains for tamper-evident audit logs.
// DO NOT bypass previous hash linkage when appending logs.

using System.Security.Cryptography;
using System.Text;

namespace Backend.Features.Helpers.Infrastructure;

public static class AuditHelper
{
    public static string ComputeChainedHash(string previousHash, DateTime timestamp, Guid? actorUserId, string action, string payload)
    {
        string raw = $"{previousHash}|{timestamp:O}|{actorUserId?.ToString() ?? "SYSTEM"}|{action}|{payload}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
    }
}
