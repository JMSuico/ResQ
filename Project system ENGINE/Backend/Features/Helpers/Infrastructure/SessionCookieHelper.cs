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
            Path = "/",
            IsEssential = true
        });

    public static void ExpireSessionCookie(HttpResponse response) =>
        response.Cookies.Delete(CookieName, new CookieOptions
        {
            Path = "/",
            HttpOnly = true,
            Secure = false,
            SameSite = SameSiteMode.Lax,
            IsEssential = true
        });

    public static string? ExtractToken(HttpRequest request)
    {
        // 1. Authorization: Bearer <token> FIRST!
        var authHeader = request.Headers.Authorization.ToString();
        if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var bearerToken = authHeader["Bearer ".Length..].Trim();
            if (!string.IsNullOrWhiteSpace(bearerToken))
            {
                return bearerToken;
            }
        }

        // 2. X-Session-Token SECOND!
        if (request.Headers.TryGetValue("X-Session-Token", out var sessionTokenHeader))
        {
            var customToken = sessionTokenHeader.ToString().Trim();
            if (!string.IsNullOrWhiteSpace(customToken))
            {
                return customToken;
            }
        }

        // 3. Fall back to shared browser cookie only if no header token was provided
        if (request.Cookies.TryGetValue(CookieName, out var cookieToken) && !string.IsNullOrWhiteSpace(cookieToken))
        {
            return cookieToken.Trim();
        }

        return null;
    }
}
