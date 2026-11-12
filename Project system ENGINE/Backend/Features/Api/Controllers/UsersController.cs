// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes administrative user governance, account approval/suspension, biometric capture streaming, and self-service profile modification using Universal Lambdas (=>).
// DO NOT expose raw passwords or allow unauthorized non-admin access to captures.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController(IUserGovernanceService governanceService) : ControllerBase
{
    private bool IsAdmin => HttpContext.Items["UserRole"] is UserRole role && role == UserRole.LDRRMO_Admin;
    private Guid CurrentUserId => HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;
    private Guid AdminId => CurrentUserId;
    private string AdminEmail => HttpContext.Items["UserEmail"] as string ?? "admin@resqtrack.gov.ph";
    private bool IsAdminOrOwner(Guid resourceUserId) => IsAdmin || (CurrentUserId != Guid.Empty && CurrentUserId == resourceUserId);
    private IActionResult ForbiddenNonAdmin(string message) => StatusCode(StatusCodes.Status403Forbidden, new { message });
    private IActionResult Forbidden(string message) => StatusCode(StatusCodes.Status403Forbidden, new { message });

    [HttpGet]
    public async Task<IActionResult> GetAllUsersAsync(CancellationToken ct) =>
        !IsAdmin
            ? ForbiddenNonAdmin("Only LDRRMO Administrators may inspect user registries.")
            : Ok(await governanceService.GetAllUsersAsync(ct));

    [HttpGet("paged")]
    public async Task<IActionResult> GetPagedUsersAsync([FromQuery] UserFilterParams filter, CancellationToken ct) =>
        !IsAdmin
            ? ForbiddenNonAdmin("Only LDRRMO Administrators may inspect user registries.")
            : Ok(await governanceService.GetPagedUsersAsync(filter, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetUserDetailAsync(Guid id, CancellationToken ct) =>
        !IsAdminOrOwner(id)
            ? Forbidden("You are not authorized to inspect this user record.")
            : await governanceService.GetUserDetailAsync(id, ct) is { } user
                ? Ok(user)
                : NotFound(new { message = "User not found." });

    [HttpPost]
    public async Task<IActionResult> CreateUserAsync([FromBody] CreateUserRequest request, CancellationToken ct) =>
        !IsAdmin
            ? ForbiddenNonAdmin("Only LDRRMO Administrators may register or provision users.")
            : await governanceService.CreateUserAsync(request, AdminId, ct) is var (success, error, user) && success
                ? StatusCode(StatusCodes.Status201Created, user)
                : BadRequest(new { message = error });

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateUserAsync(Guid id, [FromBody] UpdateUserRequest request, CancellationToken ct) =>
        !IsAdmin
            ? ForbiddenNonAdmin("Only LDRRMO Administrators may update user profiles.")
            : await governanceService.UpdateUserAsync(id, request, AdminId, ct) is var (success, error) && success
                ? Ok(new { message = "User updated successfully." })
                : BadRequest(new { message = error });

    [HttpPut("/api/profile")]
    public async Task<IActionResult> UpdateSelfProfileAsync([FromBody] UpdateProfileRequest request, CancellationToken ct) =>
        HttpContext.Items["UserId"] is not Guid userId || userId == Guid.Empty
            ? Unauthorized(new { message = "Authentication required to update profile." })
            : await governanceService.UpdateProfileAsync(userId, request, ct) is var (success, error) && success
                ? Ok(new { message = "Profile updated successfully." })
                : BadRequest(new { message = error });

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteUserAsync(Guid id, CancellationToken ct) =>
        !IsAdmin
            ? ForbiddenNonAdmin("Only LDRRMO Administrators may delete user profiles.")
            : await governanceService.DeleteUserAsync(id, AdminId, AdminEmail, ct) is var (success, error) && success
                ? Ok(new { message = "User deleted successfully." })
                : BadRequest(new { message = error });

    [HttpPost("{id:guid}/status")]
    public async Task<IActionResult> UpdateUserStatusAsync(Guid id, [FromBody] UpdateUserStatusRequest request, CancellationToken ct) =>
        !IsAdmin
            ? ForbiddenNonAdmin("Only LDRRMO Administrators may update account status.")
            : await governanceService.UpdateUserStatusAsync(id, AdminId, request.Status, ct) is var (success, error) && success
                ? Ok(new { message = $"User status updated to {request.Status}." })
                : BadRequest(new { message = error });

    [HttpGet("{id:guid}/captures/{kind}")]
    public async Task<IActionResult> GetCaptureAsync(Guid id, string kind, CancellationToken ct) =>
        !IsAdminOrOwner(id)
            ? Forbidden("You are not authorized to access biometric captures for this user.")
            : kind.ToLowerInvariant() switch
            {
                "id" or "front" => await ServeCaptureFileAsync(id, CaptureKind.Id, ct),
                "back" or "idback" => await ServeCaptureFileAsync(id, CaptureKind.IdBack, ct),
                "face" => await ServeCaptureFileAsync(id, CaptureKind.Face, ct),
                _ => BadRequest(new { message = "Invalid capture kind. Expected 'id', 'front', 'back', or 'face'." })
            };

    private async Task<IActionResult> ServeCaptureFileAsync(Guid id, CaptureKind kind, CancellationToken ct)
    {
        string? path = await governanceService.GetUserCapturePathAsync(id, kind, ct);
        if (string.IsNullOrWhiteSpace(path) || !System.IO.File.Exists(path))
            return File(CaptureStorageHelper.GenerateSyntheticFallbackPng(), "image/png");

        var (bytes, contentType) = await CaptureStorageHelper.ReadCaptureFileAsync(path, ct);
        return File(bytes, contentType);
    }
}
