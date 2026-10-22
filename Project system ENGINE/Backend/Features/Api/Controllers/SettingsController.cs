// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes system configuration settings and tamper-evident audit logs.
// DO NOT allow non-admins to modify core system settings or audit trails.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/settings")]
public class SettingsController(ISettingsService settingsService, IAuditLogRepository auditRepo) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSettingsAsync(CancellationToken ct) =>
        Ok(await settingsService.GetAllSettingsAsync(ct));

    [HttpPut("{key}")]
    public async Task<IActionResult> UpdateSettingAsync(string key, [FromBody] UpdateSettingRequest request, CancellationToken ct)
    {
        if (HttpContext.Items["UserRole"] is not UserRole role || role != UserRole.LDRRMO_Admin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators may update system settings." });

        Guid adminId = HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;
        bool success = await settingsService.UpdateSettingAsync(key, request.Value, adminId, ct);
        return success ? Ok(new { message = "Setting updated." }) : NotFound(new { message = "Setting key not found." });
    }

    [HttpGet("audit")]
    public async Task<IActionResult> GetAuditLogsAsync(CancellationToken ct)
    {
        if (HttpContext.Items["UserRole"] is not UserRole role || role != UserRole.LDRRMO_Admin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators may view audit trails." });

        return Ok(await auditRepo.GetRecentAsync(50, ct));
    }
}
