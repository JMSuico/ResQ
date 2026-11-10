// [Layer: Backend/Api/Middleware]
// Responsibility: Validates session tokens and enforces per-request database verification of user status.
// DO NOT trust cached JWT claims without checking active database account status.

using Backend.Features.Data.Enums;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Api.Middleware;

public class SessionVerificationMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> PublicPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/health",
        "/health",
        "/api/login",
        "/api/logout",
        "/api/register",
        "/api/openapi/v1.json",
        "/scalar/v1",
        "/api/identity/ai-extract",
        "/api/identity/ai-status"
    };

    private static bool IsAdminPortRequest(HttpRequest request)
    {
        if (request.Headers.TryGetValue("Origin", out var originVal) && !string.IsNullOrWhiteSpace(originVal))
        {
            var str = originVal.ToString();
            if (Uri.TryCreate(str, UriKind.Absolute, out var uri) && uri.Port == 5174) return true;
            if (str.Contains(":5174")) return true;
        }

        if (request.Headers.TryGetValue("Referer", out var refererVal) && !string.IsNullOrWhiteSpace(refererVal))
        {
            var str = refererVal.ToString();
            if (Uri.TryCreate(str, UriKind.Absolute, out var uri) && uri.Port == 5174) return true;
            if (str.Contains(":5174")) return true;
        }

        if (request.Headers.TryGetValue("X-Client-Port", out var portVal) && portVal.ToString().Trim() == "5174")
        {
            return true;
        }

        return false;
    }

    public async Task InvokeAsync(HttpContext context, ISessionRepository sessionRepo, IUserRepository userRepo)
    {
        string rawPath = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
        string path = rawPath.TrimEnd('/');

        // Skip public routes, health checks, identity extraction endpoints, or distress beacon emergency pings
        if (path == "/api/health" || path == "/health" || path.StartsWith("/api/health") || !path.StartsWith("/api") || PublicPaths.Contains(path) || path.StartsWith("/api/identity") || path.Contains("/image") || path.EndsWith("/beacon"))
        {
            await next(context);
            return;
        }

        string? token = SessionCookieHelper.ExtractToken(context.Request);
        if (string.IsNullOrWhiteSpace(token))
        {
            // For session endpoint, allow null to return empty/unauthorized without throwing
            if (path == "/api/session")
            {
                await next(context);
                return;
            }

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { message = "Authentication session required." });
            return;
        }

        string tokenHash = SessionCookieHelper.HashSessionToken(token);
        var session = await sessionRepo.GetByTokenHashAsync(tokenHash);

        if (session == null || session.IsRevoked || session.ExpiresAt <= DateTime.UtcNow)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { message = "Session is invalid or has expired." });
            return;
        }

        // Deterministic Security Check: Re-verify user's status in the database per request
        var user = await userRepo.GetByIdAsync(session.UserId);
        if (user == null || user.Status != AccountStatus.Verified)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { 
                message = user?.Status == AccountStatus.Suspended 
                    ? "Account has been suspended by LDRRMO Administration." 
                    : "Account is pending verification." 
            });
            return;
        }

        // Enforce Port 5174 Restriction: Only LDRRMO_Admin is permitted on port 5174
        if (IsAdminPortRequest(context.Request) && user.Role != UserRole.LDRRMO_Admin)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { message = "Port 5174 is restricted to LDRRMO Admin personnel." });
            return;
        }

        // Attach authenticated user identity to HttpContext items
        context.Items["UserId"] = user.Id;
        context.Items["UserRole"] = user.Role;
        context.Items["UserUnit"] = user.Unit;
        context.Items["UserEmail"] = user.Email;
        context.Items["User"] = user;

        await next(context);
    }
}
