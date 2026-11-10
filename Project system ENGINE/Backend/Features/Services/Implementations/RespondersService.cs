// [Layer: Backend/Services/Implementations]
// Responsibility: Implements responder fleet operations, status updates, PCR submissions, blotters, and alarm telemetry using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class RespondersService(
    IDutyUnitRepository unitRepo,
    IIncidentFixtureRepository fixtureRepo,
    IAuditLogRepository auditRepo,
    AppDbContext db) : IRespondersService
{
    public Task<List<DutyUnitResponse>> GetRosterAsync(CancellationToken ct = default) =>
        GetRosterAsync(null, ct);

    public async Task<List<DutyUnitResponse>> GetRosterAsync(ResponderUnitType? agency, CancellationToken ct = default) =>
        (await unitRepo.GetAllAsync(ct))
            .Where(d => agency == null || agency == ResponderUnitType.None || d.Agency == agency.Value)
            .Select(MapDutyUnitToResponse)
            .ToList();

    public async Task<(bool Success, string? Error, DutyUnitResponse? Unit)> UpdateDutyStatusAsync(UpdateDutyStatusRequest request, Guid? userId = null, CancellationToken ct = default) =>
        await ResolveUnitForUpdateAsync(request, userId, ct) is { } unit
            ? await MutateDutyStatusAsync(unit, request.Status, userId, ct)
            : (false, "Target duty unit could not be located.", null);

    public async Task<(bool Success, string? Error)> UpdateUnitStatusAsync(Guid unitId, DutyStatus status, CancellationToken ct = default) =>
        await unitRepo.GetByIdAsync(unitId, ct) is { } unit
            ? await MutateUnitStatusOnlyAsync(unit, status, ct)
            : (false, "Unit not found.");

    public async Task<(bool Success, string? Error, PcrResponse? Pcr)> SubmitPcrAsync(CreatePcrRequest request, Guid? userId = null, CancellationToken ct = default) =>
        await ExecutePcrSaveAsync(request, userId, ct);

    public async Task<List<PcrResponse>> GetPcrRecordsAsync(Guid? reportId = null, CancellationToken ct = default) =>
        (await db.PatientCareRecords
            .Where(p => reportId == null || p.ReportId == reportId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct))
            .Select(MapToPcrResponse)
            .ToList();

    public async Task<(bool Success, string? Error, BlotterResponse? Blotter)> FileBlotterAsync(CreateBlotterRequest request, Guid? userId = null, CancellationToken ct = default) =>
        await ExecuteBlotterSaveAsync(request, userId, ct);

    public async Task<List<BlotterResponse>> GetBlotterEntriesAsync(Guid? reportId = null, CancellationToken ct = default) =>
        (await db.PoliceBlotterEntries
            .Where(b => reportId == null || b.ReportId == reportId)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct))
            .Select(MapToBlotterResponse)
            .ToList();

    public async Task<(bool Success, string? Error, AlarmLevelResponse? Alarm)> SetAlarmLevelAsync(SetAlarmLevelRequest request, Guid? userId = null, CancellationToken ct = default) =>
        await ExecuteAlarmSaveAsync(request, userId, ct);

    public async Task<List<AlarmLevelResponse>> GetAlarmStatusesAsync(Guid? reportId = null, CancellationToken ct = default) =>
        (await db.FireAlarmStatuses
            .Where(f => reportId == null || f.ReportId == reportId)
            .OrderByDescending(f => f.UpdatedAt)
            .ToListAsync(ct))
            .Select(MapToAlarmResponse)
            .ToList();

    public async Task<List<HydrantResponse>> GetHydrantsAsync(CancellationToken ct = default) =>
        (await fixtureRepo.GetAllActiveAsync(ct))
            .Where(f => f.Category == IncidentCategory.HazardFixture && (f.AssignedUnitType == ResponderUnitType.FIRE || f.FixtureCode.StartsWith("HYD-", StringComparison.OrdinalIgnoreCase)))
            .Select(MapToHydrantResponse)
            .ToList();

    private async Task<DutyUnit?> ResolveUnitForUpdateAsync(UpdateDutyStatusRequest request, Guid? userId, CancellationToken ct) =>
        request.UnitId.HasValue
            ? await unitRepo.GetByIdAsync(request.UnitId.Value, ct)
            : !string.IsNullOrWhiteSpace(request.UnitCode)
                ? await db.DutyUnits.FirstOrDefaultAsync(u => u.UnitCode == request.UnitCode, ct)
                : userId.HasValue
                    ? await ResolveUnitByUserIdAsync(userId.Value, ct)
                    : await db.DutyUnits.FirstOrDefaultAsync(ct);

    private async Task<DutyUnit?> ResolveUnitByUserIdAsync(Guid userId, CancellationToken ct) =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) is { } user
            ? await db.DutyUnits.FirstOrDefaultAsync(d => d.Agency == user.Unit, ct)
            : null;

    private async Task<(bool Success, string? Error, DutyUnitResponse? Unit)> MutateDutyStatusAsync(DutyUnit unit, DutyStatus status, Guid? actorId, CancellationToken ct)
    {
        unit.Status = status;
        unit.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await AppendAuditLogAsync(actorId, "DUTY_STATUS_UPDATED", nameof(DutyUnit), $"Unit: {unit.UnitCode}, Status: {status}", ct);
        return (true, null, MapDutyUnitToResponse(unit));
    }

    private async Task<(bool Success, string? Error)> MutateUnitStatusOnlyAsync(DutyUnit unit, DutyStatus status, CancellationToken ct)
    {
        unit.Status = status;
        unit.UpdatedAt = DateTime.UtcNow;
        await unitRepo.UpdateStatusAsync(unit.Id, status, ct);
        await AppendAuditLogAsync(null, "DUTY_STATUS_UPDATED", nameof(DutyUnit), $"Unit: {unit.UnitCode}, Status: {status}", ct);
        return (true, null);
    }

    private async Task<(bool Success, string? Error, PcrResponse? Pcr)> ExecutePcrSaveAsync(CreatePcrRequest request, Guid? userId, CancellationToken ct)
    {
        var pcr = new PatientCareRecord
        {
            PcrReference = $"PCR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}",
            ReportId = request.ReportId,
            ResponderUserId = userId,
            MedicName = InputSanitizer.Sanitize(request.MedicName ?? "Field Medic"),
            UnitCode = InputSanitizer.Sanitize(request.UnitCode ?? "EMS-ALPHA"),
            PatientName = InputSanitizer.Sanitize(request.PatientName),
            Age = request.Age,
            Gender = InputSanitizer.Sanitize(request.Gender),
            WeightKg = request.WeightKg,
            LevelOfConsciousness = InputSanitizer.Sanitize(request.LevelOfConsciousness),
            BloodPressureSystolic = request.BloodPressureSystolic,
            BloodPressureDiastolic = request.BloodPressureDiastolic,
            HeartRateBpm = request.HeartRateBpm,
            RespiratoryRate = request.RespiratoryRate,
            SpO2Percent = request.SpO2Percent,
            BloodGlucoseMgDl = request.BloodGlucoseMgDl,
            TemperatureCelsius = request.TemperatureCelsius,
            InterventionsJson = System.Text.Json.JsonSerializer.Serialize(request.Interventions ?? []),
            AnatomicalInjuriesJson = System.Text.Json.JsonSerializer.Serialize(request.AnatomicalInjuries ?? []),
            ChiefComplaint = InputSanitizer.Sanitize(request.ChiefComplaint ?? string.Empty),
            Narrative = InputSanitizer.Sanitize(request.Narrative ?? string.Empty),
            CreatedAt = DateTime.UtcNow
        };

        await db.PatientCareRecords.AddAsync(pcr, ct);
        await db.SaveChangesAsync(ct);
        await AppendAuditLogAsync(userId, "PCR_SUBMITTED", nameof(PatientCareRecord), $"Ref: {pcr.PcrReference}, Patient: {pcr.PatientName}", ct);
        return (true, null, MapToPcrResponse(pcr));
    }

    private async Task<(bool Success, string? Error, BlotterResponse? Blotter)> ExecuteBlotterSaveAsync(CreateBlotterRequest request, Guid? userId, CancellationToken ct)
    {
        var blotterNum = $"BLOTTER-{DateTime.UtcNow:yyyy}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}";
        var incidentTime = request.IncidentDateTime ?? DateTime.UtcNow;
        var seal = ComputeBlotterSeal(blotterNum, incidentTime, request.NarrativeStatement, request.InvestigatingOfficerBadge ?? string.Empty);

        var entry = new PoliceBlotterEntry
        {
            BlotterNumber = blotterNum,
            ReportId = request.ReportId,
            IncidentClassification = InputSanitizer.Sanitize(request.IncidentClassification),
            ComplainantName = InputSanitizer.Sanitize(request.ComplainantName),
            ComplainantContact = InputSanitizer.Sanitize(request.ComplainantContact ?? string.Empty),
            ComplainantAddress = InputSanitizer.Sanitize(request.ComplainantAddress ?? string.Empty),
            SuspectName = InputSanitizer.Sanitize(request.SuspectName ?? string.Empty),
            SuspectDescription = InputSanitizer.Sanitize(request.SuspectDescription ?? string.Empty),
            Witnesses = InputSanitizer.Sanitize(request.Witnesses ?? string.Empty),
            NarrativeStatement = InputSanitizer.Sanitize(request.NarrativeStatement),
            IncidentLocation = InputSanitizer.Sanitize(request.IncidentLocation),
            IncidentDateTime = incidentTime,
            InvestigatingOfficerName = InputSanitizer.Sanitize(request.InvestigatingOfficerName ?? "Desk Officer"),
            InvestigatingOfficerBadge = InputSanitizer.Sanitize(request.InvestigatingOfficerBadge ?? "PNP-OFFICER"),
            Station = InputSanitizer.Sanitize(request.Station ?? "Dipolog City Police Station"),
            CryptographicSeal = seal,
            CreatedAt = DateTime.UtcNow
        };

        await db.PoliceBlotterEntries.AddAsync(entry, ct);
        await db.SaveChangesAsync(ct);
        await AppendAuditLogAsync(userId, "BLOTTER_ENTRY_FILED", nameof(PoliceBlotterEntry), $"Number: {entry.BlotterNumber}, Seal: {entry.CryptographicSeal}", ct);
        return (true, null, MapToBlotterResponse(entry));
    }

    private async Task<(bool Success, string? Error, AlarmLevelResponse? Alarm)> ExecuteAlarmSaveAsync(SetAlarmLevelRequest request, Guid? userId, CancellationToken ct)
    {
        var existing = request.ReportId.HasValue
            ? await db.FireAlarmStatuses.FirstOrDefaultAsync(f => f.ReportId == request.ReportId.Value, ct)
            : null;

        var status = existing ?? new FireAlarmStatusRecord { ReportId = request.ReportId };
        status.AlarmLevel = InputSanitizer.Sanitize(request.AlarmLevel);
        status.BuildingType = InputSanitizer.Sanitize(request.BuildingType ?? "Residential");
        status.TrappedOccupantsCount = Math.Max(0, request.TrappedOccupantsCount);
        status.CommanderName = InputSanitizer.Sanitize(request.CommanderName ?? "Ground Commander");
        status.ReportingUnit = InputSanitizer.Sanitize(request.ReportingUnit ?? "BFP-ALPHA");
        status.Remarks = InputSanitizer.Sanitize(request.Remarks ?? string.Empty);
        status.WaterSupplyGallons = Math.Max(0, request.WaterSupplyGallons);
        status.UpdatedAt = DateTime.UtcNow;

        if (existing == null)
            await db.FireAlarmStatuses.AddAsync(status, ct);

        await db.SaveChangesAsync(ct);
        await AppendAuditLogAsync(userId, "FIRE_ALARM_ESCALATED", nameof(FireAlarmStatusRecord), $"Alarm: {status.AlarmLevel}, Building: {status.BuildingType}, Trapped: {status.TrappedOccupantsCount}", ct);
        return (true, null, MapToAlarmResponse(status));
    }

    private async Task AppendAuditLogAsync(Guid? actorId, string action, string entity, string payload, CancellationToken ct)
    {
        var prevHash = await auditRepo.GetLatestHashAsync(ct);
        var now = DateTime.UtcNow;
        var newHash = AuditHelper.ComputeChainedHash(prevHash, now, actorId, action, payload);
        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = actorId,
            Action = action,
            TargetEntity = entity,
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);
    }

    private static string ComputeBlotterSeal(string blotterNum, DateTime dt, string narrative, string badge) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"{blotterNum}|{dt:O}|{narrative}|{badge}")
        )).ToLowerInvariant();

    private static DutyUnitResponse MapDutyUnitToResponse(DutyUnit d) =>
        new(d.Id, d.UnitCode, d.UnitName, d.Agency, d.CommanderName, d.Status,
            d.BaseLatitude, d.BaseLongitude, d.ContactHotline, d.ActivePersonnelCount,
            d.ShiftSchedule, d.UpdatedAt);

    private static PcrResponse MapToPcrResponse(PatientCareRecord p) =>
        new(p.Id, p.PcrReference, p.ReportId, p.ResponderUserId, p.MedicName, p.UnitCode,
            p.PatientName, p.Age, p.Gender, p.WeightKg, p.LevelOfConsciousness,
            p.BloodPressureSystolic, p.BloodPressureDiastolic, p.HeartRateBpm, p.RespiratoryRate,
            p.SpO2Percent, p.BloodGlucoseMgDl, p.TemperatureCelsius,
            DeserializeStringList(p.InterventionsJson),
            DeserializeStringList(p.AnatomicalInjuriesJson),
            p.ChiefComplaint, p.Narrative, p.CreatedAt);

    private static BlotterResponse MapToBlotterResponse(PoliceBlotterEntry b) =>
        new(b.Id, b.BlotterNumber, b.ReportId, b.IncidentClassification, b.ComplainantName,
            b.ComplainantContact, b.ComplainantAddress, b.SuspectName, b.SuspectDescription,
            b.Witnesses, b.NarrativeStatement, b.IncidentLocation, b.IncidentDateTime,
            b.InvestigatingOfficerName, b.InvestigatingOfficerBadge, b.Station,
            b.CryptographicSeal, b.CreatedAt);

    private static AlarmLevelResponse MapToAlarmResponse(FireAlarmStatusRecord a) =>
        new(a.Id, a.ReportId, a.AlarmLevel, a.BuildingType, a.TrappedOccupantsCount,
            a.CommanderName, a.ReportingUnit, a.Remarks, a.WaterSupplyGallons, a.UpdatedAt);

    private static HydrantResponse MapToHydrantResponse(IncidentFixture f) =>
        new(f.Id, f.FixtureCode, f.Title, f.Description, f.Latitude, f.Longitude,
            ParseFlowRate(f.Description), DetermineFlowClass(ParseFlowRate(f.Description)), f.IsActive);

    private static List<string> DeserializeStringList(string json) =>
        string.IsNullOrWhiteSpace(json)
            ? []
            : System.Text.Json.JsonSerializer.Deserialize<List<string>>(json) ?? [];

    private static int ParseFlowRate(string description) =>
        System.Text.RegularExpressions.Regex.Match(description, @"(\d+)\s*GPM", System.Text.RegularExpressions.RegexOptions.IgnoreCase) is { Success: true } match
            && int.TryParse(match.Groups[1].Value, out var gpm)
                ? gpm
                : 1000;

    private static string DetermineFlowClass(int gpm) =>
        gpm >= 1500 ? "Class AA (>=1500 GPM)" :
        gpm >= 1000 ? "Class A (1000-1499 GPM)" :
        gpm >= 500 ? "Class B (500-999 GPM)" : "Class C (<500 GPM)";
}
