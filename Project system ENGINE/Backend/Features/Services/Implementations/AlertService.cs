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
    IUserRepository userRepo,
    IWebHostEnvironment? env = null) : IAlertService
{
    public async Task<List<AlertResponse>> GetAlertsAsync(Guid userId, CancellationToken ct = default) =>
        await LoadAlertsInternalAsync(userId, ct);

    public async Task<object> CreateBroadcastAsync(Guid adminId, CreateAlertBroadcastRequest request, CancellationToken ct = default) =>
        await ExecuteBroadcastInternalAsync(adminId, request, ct);

    public async Task MarkReadAsync(Guid userId, string reportId, CancellationToken ct = default) =>
        await ExecuteMarkReadInternalAsync(userId, reportId, ct);

    public async Task<int> MarkAllReadAsync(Guid userId, CancellationToken ct = default) =>
        userId == Guid.Empty
            ? 0
            : await alertRepo.MarkAllAsReadAsync(userId, (await reportRepo.GetAllAsync(ct)).Select(r => r.Id), ct);

    private async Task<List<AlertResponse>> LoadAlertsInternalAsync(Guid userId, CancellationToken ct) =>
        await reportRepo.GetAllAsync(ct) is var reports
        && await alertRepo.GetUserAlertsAsync(userId, ct) is var readStates
        && readStates.Where(s => s.IsRead).Select(s => s.ReportId).ToHashSet() is var readReportIds
            ? reports.Take(25).Select(r => new AlertResponse(
                r.Id,
                r.ReferenceCode,
                r.Title,
                Enum.IsDefined(r.Category) ? r.Category : IncidentCategory.VehicularAccident,
                Enum.IsDefined(r.Severity) ? r.Severity : IncidentSeverity.Medium,
                Enum.IsDefined(r.Status) ? r.Status : ReportStatus.Reported,
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
        string reportsDir = Path.Combine(env?.ContentRootPath ?? Directory.GetCurrentDirectory(), "server-data", "uploads", "reports");
        string? imagePath = !string.IsNullOrWhiteSpace(request.ImageDataUrl)
            ? await CaptureStorageHelper.SaveCaptureDataUrlAsync(request.ImageDataUrl, reportsDir, "BROADCAST", ct)
            : null;
        var sev = Enum.TryParse<IncidentSeverity>(request.Severity, true, out var parsedSev) ? parsedSev : IncidentSeverity.High;
        var report = new Report
        {
            Id = reportId,
            ReferenceCode = $"BRD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpperInvariant()}",
            ReporterId = adminId,
            ReporterName = adminUser?.FullName ?? "LDRRMO Command Center",
            ReporterRole = UserRole.LDRRMO_Admin,
            Title = InputSanitizer.Sanitize(request.Title.Trim()),
            Note = InputSanitizer.Sanitize((request.Message + (!string.IsNullOrWhiteSpace(request.ExternalLink) ? $" (External: {request.ExternalLink})" : "")).Trim()),
            Category = IncidentCategory.NaturalDisaster,
            Severity = sev,
            Status = ReportStatus.Verified,
            Latitude = 8.5147,
            Longitude = 123.2842,
            LocationLabel = "Katipunan Municipal Command Broadcast (7109)",
            ImageCapturePath = imagePath,
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
