// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes system configuration settings and tamper-evident audit logs via ISettingsService.
// Universal Lambda Expressions (=>). Injects Services ONLY. Under 35 lines. Zero emojis.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/settings")]
public class SettingsController(ISettingsService settingsService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSettingsAsync(CancellationToken ct) =>
        Ok(await settingsService.GetAllSettingsAsync(ct));

    [HttpPut("{key}")]
    public async Task<IActionResult> UpdateSettingAsync(string key, [FromBody] UpdateSettingRequest request, CancellationToken ct) =>
        HttpContext.Items["UserRole"] is not UserRole role || role != UserRole.LDRRMO_Admin
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators may update system settings." })
            : await settingsService.UpdateSettingAsync(key, request.Value, HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty, ct)
                ? Ok(new { message = "Setting updated." })
                : NotFound(new { message = "Setting key not found." });

    [HttpGet("audit")]
    public async Task<IActionResult> GetAuditLogsAsync(CancellationToken ct) =>
        HttpContext.Items["UserRole"] is not UserRole role || role != UserRole.LDRRMO_Admin
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators may view audit trails." })
            : Ok(await settingsService.GetRecentAuditLogsAsync(50, ct));
}
