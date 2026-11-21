// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes alert notifications and broadcast dispatches via IAlertService.
// Universal Lambda Expressions (=>). Injects Services ONLY. Under 35 lines. Zero emojis.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/alerts")]
public class AlertsController(IAlertService alertService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAlertsAsync(CancellationToken ct) =>
        Ok(await alertService.GetAlertsAsync(HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty, ct));

    [HttpPost("broadcast")]
    public async Task<IActionResult> CreateBroadcastAsync([FromBody] CreateAlertBroadcastRequest request, CancellationToken ct) =>
        Ok(await alertService.CreateBroadcastAsync(HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty, request, ct));

    [HttpPost("{reportId}/read")]
    public async Task<IActionResult> MarkReadAsync(string reportId, CancellationToken ct)
    {
        await alertService.MarkReadAsync(HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty, reportId, ct);
        return Ok(new { message = "Alert marked as read." });
    }

    [HttpPost("mark-all-read")]
    public async Task<IActionResult> MarkAllReadAsync(CancellationToken ct) =>
        HttpContext.Items["UserId"] is not Guid uid || uid == Guid.Empty
            ? Unauthorized(new { message = "Authentication required to mark alerts as read." })
            : Ok(new
            {
                message = "All alerts marked as read.",
                markedCount = await alertService.MarkAllReadAsync(uid, ct)
            });
}
