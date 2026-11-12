// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes authentication endpoints for 6-phase manual registration, constant-time email login, and session checks using Universal Lambdas (=>).
// DO NOT implement business logic or password hashing directly inside controller actions.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api")]
public class AuthController(
    IAuthService authService,
    IWebHostEnvironment env,
    IVerificationProviderResolver? providerResolver = null) : ControllerBase
{
    private string CapturesDirectory => Path.Combine(env.ContentRootPath, "server-data", "uploads", "captures");

    [HttpPost("register")]
    [HttpPost("auth/register")]
    public async Task<IActionResult> RegisterAsync([FromBody] RegisterRequest request, CancellationToken ct) =>
        await authService.RegisterWithDetailsAsync(request, CapturesDirectory, ct) is var result && result.Success && result.Response != null
            ? StatusCode(StatusCodes.Status201Created, result.Response)
            : StatusCode(
                result.StatusCode is >= 400 and <= 599 ? result.StatusCode : StatusCodes.Status400BadRequest,
                new { message = result.Error ?? "Registration validation failed.", code = result.ErrorCode ?? "VALIDATION_ERROR" });

    [HttpGet("auth/verification-providers")]
    public IActionResult GetVerificationProviders()
    {
        var resolver = providerResolver ?? new VerificationProviderResolver();
        var idProvider = resolver.ResolveIdentityProvider();
        var facialProvider = resolver.ResolveFacialProvider();
        return Ok(new
        {
            activeIdentityProvider = idProvider.ProviderName,
            activeIdentityMode = idProvider.ProviderMode,
            activeFacialProvider = facialProvider.ProviderName,
            activeFacialMode = facialProvider.ProviderMode,
            availableIdentityProviders = resolver.GetAvailableIdentityProviders(),
            availableFacialProviders = resolver.GetAvailableFacialProviders()
        });
    }

    [HttpPost("login")]
    [HttpPost("auth/login")]
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

    [HttpPost("biometric-login")]
    [HttpPost("auth/biometric-login")]
    [HttpPost("login/biometric")]
    [HttpPost("auth/login/biometric")]
    public async Task<IActionResult> BiometricLoginAsync([FromBody] BiometricLoginRequest request, CancellationToken ct)
    {
        string ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        string ua = Request.Headers.UserAgent.ToString();

        var (success, error, rawToken, session) = await authService.BiometricLoginAsync(request, ip, ua, ct);
        if (!success || session == null || string.IsNullOrWhiteSpace(rawToken))
        {
            bool isForbidden = (error?.Contains("suspended", StringComparison.OrdinalIgnoreCase) == true
                            || error?.Contains("restricted", StringComparison.OrdinalIgnoreCase) == true
                            || error?.Contains("Access Denied", StringComparison.OrdinalIgnoreCase) == true)
                            && error?.Contains("mismatch", StringComparison.OrdinalIgnoreCase) != true;
            return StatusCode(isForbidden ? StatusCodes.Status403Forbidden : StatusCodes.Status401Unauthorized, new { message = error });
        }

        SessionCookieHelper.AppendSessionCookie(Response, rawToken, DateTime.UtcNow.AddDays(7));
        return Ok(new { token = rawToken, session, redirectUrl = session.TargetDashboardUrl });
    }

    [HttpGet("session")]
    [HttpGet("auth/session")]
    public async Task<IActionResult> GetSessionAsync(CancellationToken ct) =>
        HttpContext.Items["UserId"] is not Guid userId
            ? Unauthorized(new { message = "No active session." })
            : await authService.GetSessionDetailsAsync(userId, ct) is { } session
                ? Ok(session)
                : Unauthorized(new { message = "Session expired or user inactive." });

    [HttpPost("logout")]
    [HttpPost("auth/logout")]
    public async Task<IActionResult> LogoutAsync(CancellationToken ct)
    {
        string? token = SessionCookieHelper.ExtractToken(Request);
        if (!string.IsNullOrWhiteSpace(token)) await authService.RevokeSessionAsync(token, ct);

        SessionCookieHelper.ExpireSessionCookie(Response);
        return Ok(new { message = "Successfully logged out." });
    }
}
