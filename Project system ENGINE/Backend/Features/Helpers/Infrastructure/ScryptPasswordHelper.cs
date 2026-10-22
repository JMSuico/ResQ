// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Implements deterministic password derivation and constant-time equality verification.
// DO NOT use plain string comparison for password hashes.

using System.Security.Cryptography;
using System.Text;

namespace Backend.Features.Helpers.Infrastructure;

public static class ScryptPasswordHelper
{
    private const int SaltByteSize = 32;
    private const int HashByteSize = 64;
    private const int Iterations = 100_000;

    public static (string Hash, string Salt) HashPassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 12)
            throw new ArgumentException("Password must be at least 12 characters long.");

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
