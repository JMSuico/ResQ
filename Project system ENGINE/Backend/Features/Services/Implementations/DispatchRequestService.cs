// [Layer: Backend/Services/Implementations]
// Responsibility: Implements PostgreSQL/EF Core persistence and audit logging for inter-agency dispatch requests using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class DispatchRequestService(
    AppDbContext db,
    IAuditLogRepository auditRepo,
    IUserRepository? userRepo = null) : IDispatchRequestService
{
    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "PENDING",
        "APPROVED",
        "DECLINED",
        "ACCEPTED",
        "DISPATCHED",
        "DEPLOY",
        "TO BE DEPLOYED",
        "RESPONDED",
        "CLOSED"
    };

    public async Task<List<DispatchRequestResponse>> GetAllAsync(CancellationToken ct = default) =>
        (await db.DispatchRequests
            .AsNoTracking()
            .OrderByDescending(d => d.CreatedAtUtc)
            .ToListAsync(ct))
            .Select(MapToResponse)
            .ToList();

    public async Task<DispatchRequestResponse> CreateAsync(
        CreateDispatchRequest request,
        Guid? actorUserId,
        string? actorName,
        string? ipAddress,
        CancellationToken ct = default)
    {
        DateTime now = DateTime.UtcNow;
        Guid effectiveUserId = actorUserId.HasValue && actorUserId.Value != Guid.Empty ? actorUserId.Value : Guid.Empty;
        string resolvedRequesterName = await ResolveActorDisplayNameAsync(effectiveUserId, request.RequestedByName ?? actorName, ct);

        string requestCode = Truncate(
            InputSanitizer.Sanitize(!string.IsNullOrWhiteSpace(request.RequestCode)
                ? request.RequestCode
                : $"DSP-{now:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}"),
            50);

        if (await db.DispatchRequests.AnyAsync(d => d.RequestCode == requestCode, ct))
        {
            string suffix = $"-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
            requestCode = Truncate(requestCode, 50 - suffix.Length) + suffix;
        }

        string initialStatus = !string.IsNullOrWhiteSpace(request.Status)
            && AllowedStatuses.Contains(request.Status.Trim())
                ? request.Status.Trim().ToUpperInvariant()
                : "PENDING";

        var record = new DispatchRequestRecord
        {
            RequestCode = requestCode,
            Direction = Truncate(InputSanitizer.Sanitize(string.IsNullOrWhiteSpace(request.Direction) ? "MEDIC_REQUEST" : request.Direction), 40),
            TargetUnit = Truncate(InputSanitizer.Sanitize(string.IsNullOrWhiteSpace(request.TargetUnit) ? "LDRRMO" : request.TargetUnit), 50),
            OriginUnit = Truncate(InputSanitizer.Sanitize(string.IsNullOrWhiteSpace(request.OriginUnit) ? "RHU" : request.OriginUnit), 50),
            Title = Truncate(InputSanitizer.Sanitize(string.IsNullOrWhiteSpace(request.Title) ? "Inter-Agency Dispatch Request" : request.Title), 200),
            Description = Truncate(InputSanitizer.Sanitize(request.Description ?? string.Empty), 2000),
            Severity = Truncate(InputSanitizer.Sanitize(string.IsNullOrWhiteSpace(request.Severity) ? "High" : request.Severity), 32),
            Status = Truncate(initialStatus, 32),
            LocationLabel = Truncate(InputSanitizer.Sanitize(request.LocationLabel ?? "Katipunan, Zamboanga del Norte (7109)"), 255),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            IpAddress = TruncateOptional(InputSanitizer.Sanitize(request.IpAddress ?? ipAddress), 64),
            RequestedByUserId = effectiveUserId == Guid.Empty ? null : effectiveUserId,
            RequestedByName = Truncate(resolvedRequesterName, 150),
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        await db.DispatchRequests.AddAsync(record, ct);
        await db.SaveChangesAsync(ct);

        await AppendAuditLogAsync(
            effectiveUserId == Guid.Empty ? null : effectiveUserId,
            "DISPATCH_REQUEST_CREATED",
            $"Code: {record.RequestCode}, Direction: {record.Direction}, Origin: {record.OriginUnit}, Target: {record.TargetUnit}, Title: {record.Title}",
            ct);

        return MapToResponse(record);
    }

    public async Task<(bool Success, string? Error, bool NotFound, DispatchRequestResponse? Record)> UpdateStatusAsync(
        string idOrCode,
        UpdateDispatchStatusRequest request,
        Guid? actorUserId,
        string? actorName,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(idOrCode))
            return (false, "Dispatch request identifier is required.", false, null);

        string normalizedStatus = request.Status?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!AllowedStatuses.Contains(normalizedStatus))
            return (false, "Invalid dispatch status. Expected APPROVED, DECLINED, ACCEPTED, or DISPATCHED.", false, null);

        string trimmedKey = idOrCode.Trim();
        DispatchRequestRecord? record = Guid.TryParse(trimmedKey, out Guid parsedId)
            ? await db.DispatchRequests.FirstOrDefaultAsync(d => d.Id == parsedId || d.RequestCode == trimmedKey, ct)
            : await db.DispatchRequests.FirstOrDefaultAsync(d => d.RequestCode.ToUpper() == trimmedKey.ToUpperInvariant(), ct);

        if (record is null)
            return (false, "Dispatch request not found.", true, null);

        Guid effectiveUserId = actorUserId.HasValue && actorUserId.Value != Guid.Empty ? actorUserId.Value : Guid.Empty;
        string responderName = await ResolveActorDisplayNameAsync(effectiveUserId, request.RespondedByName ?? actorName, ct);

        record.Status = Truncate(normalizedStatus, 32);
        record.RespondedByName = Truncate(responderName, 150);
        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            record.Description = Truncate(InputSanitizer.Sanitize(request.Notes), 2000);
        }
        record.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        await AppendAuditLogAsync(
            effectiveUserId == Guid.Empty ? null : effectiveUserId,
            "DISPATCH_REQUEST_STATUS_UPDATED",
            $"Code: {record.RequestCode}, Id: {record.Id}, Status: {record.Status}, RespondedBy: {record.RespondedByName}",
            ct);

        return (true, null, false, MapToResponse(record));
    }

    private async Task<string> ResolveActorDisplayNameAsync(Guid actorUserId, string? fallbackName, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(fallbackName))
            return InputSanitizer.Sanitize(fallbackName);

        if (actorUserId != Guid.Empty && userRepo is not null)
        {
            var user = await userRepo.GetByIdAsync(actorUserId, ct);
            if (!string.IsNullOrWhiteSpace(user?.FullName))
                return user.FullName;
        }

        return "Operational Command";
    }

    private async Task AppendAuditLogAsync(Guid? actorUserId, string action, string payload, CancellationToken ct)
    {
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, actorUserId ?? Guid.Empty, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = actorUserId,
            Action = action,
            TargetEntity = nameof(DispatchRequestRecord),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);
    }

    private static DispatchRequestResponse MapToResponse(DispatchRequestRecord d) =>
        new(
            d.Id,
            d.RequestCode,
            d.Direction,
            d.TargetUnit,
            d.OriginUnit,
            d.Title,
            d.Description,
            d.Severity,
            d.Status,
            d.LocationLabel,
            d.Latitude,
            d.Longitude,
            d.IpAddress,
            d.RequestedByUserId,
            d.RequestedByName,
            d.RespondedByName,
            d.CreatedAtUtc,
            d.UpdatedAtUtc);

    private static string Truncate(string value, int maxLength) =>
        value.Length > maxLength ? value[..maxLength] : value;

    private static string? TruncateOptional(string? value, int maxLength) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : (value.Length > maxLength ? value[..maxLength] : value);
}
