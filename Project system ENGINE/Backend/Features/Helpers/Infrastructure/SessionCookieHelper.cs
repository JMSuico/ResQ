// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Issues and invalidates secure HTTP-only session cookies and computes token hashes.
// DO NOT set HttpOnly to false on session cookies.

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace Backend.Features.Helpers.Infrastructure;

public static class SessionCookieHelper
{
    public const string CookieName = "resqtrack_session";

    public static string GenerateSessionToken() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    public static string HashSessionToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    public static void AppendSessionCookie(HttpResponse response, string rawToken, DateTime expiresAt) =>
        response.Cookies.Append(CookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = false, // Set to true in strict HTTPS production
            SameSite = SameSiteMode.Lax,
            Expires = expiresAt,
            Path = "/"
        });

    public static void ExpireSessionCookie(HttpResponse response) =>
        response.Cookies.Delete(CookieName, new CookieOptions
        {
            Path = "/",
            HttpOnly = true,
            Secure = false,
            SameSite = SameSiteMode.Lax
        });

    public static string? ExtractToken(HttpRequest request) =>
        request.Cookies.TryGetValue(CookieName, out var cookieToken) && !string.IsNullOrWhiteSpace(cookieToken)
            ? cookieToken
            : request.Headers.Authorization.ToString().StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? request.Headers.Authorization.ToString()["Bearer ".Length..].Trim()
                : null;
}
