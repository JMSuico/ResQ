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
        "/api/login",
        "/api/register",
        "/api/openapi/v1.json",
        "/scalar/v1"
    };

    public async Task InvokeAsync(HttpContext context, ISessionRepository sessionRepo, IUserRepository userRepo)
    {
        string path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;

        // Skip public routes or non-API static requests
        if (!path.StartsWith("/api") || PublicPaths.Contains(path) || path.Contains("/image"))
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

        // Attach authenticated user identity to HttpContext items
        context.Items["UserId"] = user.Id;
        context.Items["UserRole"] = user.Role;
        context.Items["UserUnit"] = user.Unit;
        context.Items["UserEmail"] = user.Email;
        context.Items["User"] = user;

        await next(context);
    }
}
