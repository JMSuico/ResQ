// [Layer: Backend/Services/Implementations]
// Responsibility: Encapsulates alert notifications, system broadcasts, and read tracking using Universal Lambdas (=>).
// DO NOT expose raw repository or database references across service contracts. Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class AlertService(
    IAlertRepository alertRepo,
    IReportRepository reportRepo,
    IAuditLogRepository auditRepo,
    IUserRepository userRepo) : IAlertService
{
    public async Task<List<AlertResponse>> GetAlertsAsync(Guid userId, CancellationToken ct = default) =>
        await LoadAlertsInternalAsync(userId, ct);

    public async Task<object> CreateBroadcastAsync(Guid adminId, CreateAlertBroadcastRequest request, CancellationToken ct = default) =>
        await ExecuteBroadcastInternalAsync(adminId, request, ct);

    public async Task MarkReadAsync(Guid userId, string reportId, CancellationToken ct = default) =>
        await ExecuteMarkReadInternalAsync(userId, reportId, ct);

    private async Task<List<AlertResponse>> LoadAlertsInternalAsync(Guid userId, CancellationToken ct) =>
        await reportRepo.GetAllAsync(ct) is var reports
        && await alertRepo.GetUserAlertsAsync(userId, ct) is var readStates
        && readStates.Where(s => s.IsRead).Select(s => s.ReportId).ToHashSet() is var readReportIds
            ? reports.Take(25).Select(r => new AlertResponse(
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
            )).ToList()
            : [];

    private async Task<object> ExecuteBroadcastInternalAsync(Guid adminId, CreateAlertBroadcastRequest request, CancellationToken ct)
    {
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

        return new { message = "Broadcast successfully dispatched to all operational units and civilians.", alertId = reportId.ToString() };
    }

    private async Task ExecuteMarkReadInternalAsync(Guid userId, string reportId, CancellationToken ct)
    {
        if (Guid.TryParse(reportId, out var parsedGuid) && userId != Guid.Empty)
        {
            await alertRepo.MarkAsReadAsync(userId, parsedGuid, ct);
        }
    }
}
