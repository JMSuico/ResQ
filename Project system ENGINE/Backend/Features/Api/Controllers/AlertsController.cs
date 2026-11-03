// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes alert notifications, broadcast dispatches, and per-user read tracking using Universal Lambdas (=>).
// DO NOT mutate reports from the alert read controller.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/alerts")]
public class AlertsController(
    IAlertRepository alertRepo,
    IReportRepository reportRepo,
    IAuditLogRepository auditRepo,
    IUserRepository userRepo) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAlertsAsync(CancellationToken ct) =>
        await LoadAlertsAsync(ct);

    [HttpPost("broadcast")]
    public async Task<IActionResult> CreateBroadcastAsync([FromBody] CreateAlertBroadcastRequest request, CancellationToken ct) =>
        await ExecuteBroadcastAsync(request, ct);

    [HttpPost("{reportId}/read")]
    public async Task<IActionResult> MarkReadAsync(string reportId, CancellationToken ct) =>
        await ExecuteMarkReadAsync(reportId, ct);

    private async Task<IActionResult> LoadAlertsAsync(CancellationToken ct)
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

    private async Task<IActionResult> ExecuteBroadcastAsync(CreateAlertBroadcastRequest request, CancellationToken ct)
    {
        Guid adminId = HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;
        var adminUser = adminId != Guid.Empty ? await userRepo.GetByIdAsync(adminId, ct) : null;
        if (adminUser == null)
        {
            adminUser = (await userRepo.SearchUsersAsync(null, UserRole.LDRRMO_Admin, null, null, 1, 1, ct)).FirstOrDefault()
                        ?? (await userRepo.GetAllAsync(ct)).FirstOrDefault();
            adminId = adminUser?.Id ?? Guid.NewGuid();
        }

        var reportId = Guid.NewGuid();
        var sev = Enum.TryParse<IncidentSeverity>(request.Severity, true, out var parsedSev) ? parsedSev : IncidentSeverity.High;
        var report = new Report
        {
            Id = reportId,
            ReferenceCode = $"BRD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpperInvariant()}",
            ReporterId = adminId,
            ReporterName = adminUser?.FullName ?? "LDRRMO Command Center",
            ReporterRole = UserRole.LDRRMO_Admin,
            Title = request.Title.Trim(),
            Note = (request.Message + (!string.IsNullOrWhiteSpace(request.ExternalLink) ? $" (External: {request.ExternalLink})" : "")).Trim(),
            Category = IncidentCategory.NaturalDisaster,
            Severity = sev,
            Status = ReportStatus.Verified,
            Latitude = 14.5995,
            Longitude = 120.9842,
            LocationLabel = "Jurisdiction-wide Broadcast",
            CreatedAt = DateTime.UtcNow,
            VerifiedAt = DateTime.UtcNow
        };

        await reportRepo.AddAsync(report, ct);

        if (adminId != Guid.Empty)
        {
            await alertRepo.MarkAsReadAsync(adminId, reportId, ct);
        }

        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "ALERT_BROADCAST_DISPATCHED";
        string payload = $"AlertId: {reportId}, Code: {report.ReferenceCode}, Title: {report.Title}, Severity: {report.Severity}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, adminId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = adminId == Guid.Empty ? null : adminId,
            Action = action,
            TargetEntity = nameof(Report),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return Ok(new { message = "Broadcast successfully dispatched to all operational units and civilians.", alertId = reportId.ToString() });
    }

    private async Task<IActionResult> ExecuteMarkReadAsync(string reportId, CancellationToken ct)
    {
        if (Guid.TryParse(reportId, out var parsedGuid) && HttpContext.Items["UserId"] is Guid userId && userId != Guid.Empty)
        {
            await alertRepo.MarkAsReadAsync(userId, parsedGuid, ct);
        }
        return Ok(new { message = "Alert marked as read." });
    }
}
