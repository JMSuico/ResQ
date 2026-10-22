// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes alert notifications and per-user read tracking.
// DO NOT mutate reports from the alert read controller.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/alerts")]
public class AlertsController(IAlertRepository alertRepo, IReportRepository reportRepo) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAlertsAsync(CancellationToken ct)
    {
        Guid userId = HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;
        var reports = await reportRepo.GetAllAsync(ct);
        var readStates = await alertRepo.GetUserAlertsAsync(userId, ct);
        var readReportIds = readStates.Where(s => s.IsRead).Select(s => s.ReportId).ToHashSet();

        var alerts = reports.Take(25).Select(r => new AlertResponse(
            r.Id,
            r.ReferenceCode,
            r.Title,
            r.Category,
            r.Severity,
            r.Status,
            r.CreatedAt,
            readReportIds.Contains(r.Id),
            !string.IsNullOrWhiteSpace(r.ImageCapturePath),
            !string.IsNullOrWhiteSpace(r.ImageCapturePath) ? $"/api/reports/{r.Id}/image" : null
        )).ToList();

        return Ok(alerts);
    }

    [HttpPost("{reportId:guid}/read")]
    public async Task<IActionResult> MarkReadAsync(Guid reportId, CancellationToken ct)
    {
        if (HttpContext.Items["UserId"] is not Guid userId)
            return Unauthorized();

        await alertRepo.MarkAsReadAsync(userId, reportId, ct);
        return Ok(new { message = "Alert marked as read." });
    }
}
