// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Implements deterministic PBKDF2-HMAC-SHA512 password derivation (100,000 iterations) and constant-time equality verification.
// Retained under legacy type name ScryptPasswordHelper for complete binary & seeder compatibility.
// DO NOT use plain string comparison for password hashes. Zero emojis.

using System.Security.Cryptography;
using System.Text;

namespace Backend.Features.Helpers.Infrastructure;

public static class ScryptPasswordHelper
{
    private const int SaltByteSize = 32;
    private const int HashByteSize = 64;
    private const int Iterations = 100_000;
    public const int MinimumPasswordLength = 12;

    public static (string Hash, string Salt) HashPassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinimumPasswordLength)
            throw new ArgumentException($"Password must be at least {MinimumPasswordLength} characters long.");

        byte[] saltBytes = RandomNumberGenerator.GetBytes(SaltByteSize);
        byte[] hashBytes = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            saltBytes,
            Iterations,
            HashAlgorithmName.SHA512,
            HashByteSize
        );

        return (Convert.ToBase64String(hashBytes), Convert.ToBase64String(saltBytes));
    }

    public static bool VerifyPassword(string password, string storedHashBase64, string storedSaltBase64) =>
        !string.IsNullOrWhiteSpace(password) &&
        !string.IsNullOrWhiteSpace(storedHashBase64) &&
        !string.IsNullOrWhiteSpace(storedSaltBase64) &&
        CryptographicOperations.FixedTimeEquals(
            Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(password),
                Convert.FromBase64String(storedSaltBase64),
                Iterations,
                HashAlgorithmName.SHA512,
                HashByteSize
            ),
            Convert.FromBase64String(storedHashBase64)
        );
}
