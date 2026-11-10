// [Layer: Backend/Services/Implementations]
// Responsibility: Implements incident triage, verification, unit allocation, and severity escalation using Universal Lambdas (=>).
// Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class TriageService(
    IReportRepository reportRepo,
    IDutyUnitRepository unitRepo,
    IIncidentFixtureRepository fixtureRepo,
    IAuditLogRepository auditRepo,
    IUserRepository userRepo) : ITriageService
{
    public async Task<List<IncidentFixtureResponse>> GetActiveFixturesAsync(CancellationToken ct = default) =>
        (await fixtureRepo.GetAllActiveAsync(ct)).Select(f => new IncidentFixtureResponse(
            f.Id, f.FixtureCode, f.Title, f.Category, f.Severity, f.Latitude, f.Longitude, f.AssignedUnitType, f.IsActive, f.Description
        )).ToList();

    public async Task<(bool Success, string? Error)> VerifyReportAsync(Guid reportId, Guid adminId, VerifyReportRequest request, CancellationToken ct = default)
    {
        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report == null) return (false, "Report not found.");

        report.Status = request.Status;
        report.VerifiedAt = DateTime.UtcNow;
        if (adminId != Guid.Empty)
            report.VerifiedByAdminId = adminId;

        if (request.Severity.HasValue)
            report.Severity = request.Severity.Value;

        if (!string.IsNullOrWhiteSpace(request.AdminNote))
            report.Note = string.IsNullOrWhiteSpace(report.Note)
                ? request.AdminNote.Trim()
                : $"{report.Note} | Note: {request.AdminNote.Trim()}";

        if (request.Status == ReportStatus.Resolved || request.Status == ReportStatus.Closed)
            report.ResolvedAt = DateTime.UtcNow;

        await reportRepo.UpdateAsync(report, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "REPORT_VERIFIED";
        string payload = $"ReportId: {reportId}, Status: {request.Status}, Severity: {report.Severity}, VerifierId: {adminId}, Note: {request.AdminNote}";
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

        return (true, null);
    }

    public async Task<(bool Success, string? Error)> AllocateUnitAsync(Guid reportId, Guid adminId, Guid unitId, CancellationToken ct = default)
    {
        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report == null) return (false, "Report not found.");

        var unit = await unitRepo.GetByIdAsync(unitId, ct);
        if (unit == null)
        {
            var user = await userRepo.GetByIdAsync(unitId, ct);
            if (user != null && user.Unit != ResponderUnitType.None)
            {
                unit = (await unitRepo.GetAllAsync(ct)).FirstOrDefault(u => u.Agency == user.Unit);
            }
            unit ??= (await unitRepo.GetAllAsync(ct)).FirstOrDefault();
        }
        if (unit == null) return (false, "Duty unit not found.");

        report.AllocatedUnitId = unit.Id;
        report.AllocatedUnitCode = unit.UnitCode;
        report.Status = ReportStatus.Allocated;

        await reportRepo.UpdateAsync(report, ct);
        await unitRepo.UpdateStatusAsync(unit.Id, DutyStatus.Dispatched, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "UNIT_ALLOCATED";
        string payload = $"ReportId: {reportId}, AllocatedTo: {unit.UnitCode} ({unit.Agency}), AdminId: {adminId}";
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

        return (true, null);
    }

    public async Task<(bool Success, string? Error)> UpdateReportSeverityAsync(Guid reportId, Guid adminId, IncidentSeverity severity, CancellationToken ct = default)
    {
        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report == null) return (false, "Report not found.");

        report.Severity = severity;
        await reportRepo.UpdateAsync(report, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string action = "REPORT_SEVERITY_UPDATED";
        string payload = $"ReportId: {reportId}, Severity: {severity}, VerifierId: {adminId}";
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

        return (true, null);
    }
}
