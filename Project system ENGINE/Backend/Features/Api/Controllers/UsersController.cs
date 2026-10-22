// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes administrative user governance, account approval/suspension, and biometric capture streaming using Universal Lambdas (=>).
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
    private Guid AdminId => HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;
    private string AdminEmail => HttpContext.Items["UserEmail"] as string ?? "admin@resqtrack.gov.ph";
    private IActionResult ForbiddenNonAdmin(string message) => StatusCode(StatusCodes.Status403Forbidden, new { message });

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
        !IsAdmin
            ? ForbiddenNonAdmin("Only LDRRMO Administrators may inspect detailed user records.")
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
        !IsAdmin
            ? ForbiddenNonAdmin("Access to biometric captures is restricted to administrators.")
            : kind.ToLowerInvariant() switch
            {
                "id" => await ServeCaptureFileAsync(id, CaptureKind.Id, ct),
                "face" => await ServeCaptureFileAsync(id, CaptureKind.Face, ct),
                _ => BadRequest(new { message = "Invalid capture kind. Expected 'id' or 'face'." })
            };

    private async Task<IActionResult> ServeCaptureFileAsync(Guid id, CaptureKind kind, CancellationToken ct) =>
        await governanceService.GetUserCapturePathAsync(id, kind, ct) is { } path && System.IO.File.Exists(path)
            ? File(await System.IO.File.ReadAllBytesAsync(path, ct), "image/png")
            : File(CaptureStorageHelper.GenerateSyntheticFallbackPng(), "image/png");
}
