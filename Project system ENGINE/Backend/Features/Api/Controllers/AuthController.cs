// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes authentication endpoints for 3-step registration, constant-time login, and session checks.
// DO NOT implement business logic or password hashing directly inside controller actions.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api")]
public class AuthController(IAuthService authService, IWebHostEnvironment env) : ControllerBase
{
    private string CapturesDirectory => Path.Combine(env.ContentRootPath, "server-data", "uploads", "captures");

    [HttpPost("register")]
    public async Task<IActionResult> RegisterAsync([FromBody] RegisterRequest request, CancellationToken ct) =>
        await authService.RegisterAsync(request, CapturesDirectory, ct) is var result && result.Success
            ? StatusCode(StatusCodes.Status201Created, new { message = "Registration successful.", faceVerified = result.User?.FaceVerified, status = result.User?.Status.ToString() })
            : BadRequest(new { message = result.Error });

    [HttpPost("login")]
    public async Task<IActionResult> LoginAsync([FromBody] LoginRequest request, CancellationToken ct)
    {
        string ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        string ua = Request.Headers.UserAgent.ToString();

        var (success, error, rawToken, session) = await authService.LoginAsync(request, ip, ua, ct);
        if (!success || session == null || string.IsNullOrWhiteSpace(rawToken))
        {
            bool isForbidden = error?.Contains("suspended", StringComparison.OrdinalIgnoreCase) == true
                            || error?.Contains("restricted", StringComparison.OrdinalIgnoreCase) == true
                            || error?.Contains("Access Denied", StringComparison.OrdinalIgnoreCase) == true;
            return StatusCode(isForbidden ? StatusCodes.Status403Forbidden : StatusCodes.Status401Unauthorized, new { message = error });
        }

        SessionCookieHelper.AppendSessionCookie(Response, rawToken, DateTime.UtcNow.AddDays(7));
        return Ok(new { token = rawToken, session, redirectUrl = session.TargetDashboardUrl });
    }

    [HttpGet("session")]
    public async Task<IActionResult> GetSessionAsync(CancellationToken ct) =>
        HttpContext.Items["UserId"] is not Guid userId
            ? Unauthorized(new { message = "No active session." })
            : await authService.GetSessionDetailsAsync(userId, ct) is { } session
                ? Ok(session)
                : Unauthorized(new { message = "Session expired or user inactive." });

    [HttpPost("logout")]
    public async Task<IActionResult> LogoutAsync(CancellationToken ct)
    {
        string? token = SessionCookieHelper.ExtractToken(Request);
        if (!string.IsNullOrWhiteSpace(token)) await authService.RevokeSessionAsync(token, ct);

        SessionCookieHelper.ExpireSessionCookie(Response);
        return Ok(new { message = "Successfully logged out." });
    }
}
