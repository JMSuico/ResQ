// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines responder fleet operations, status updates, PCR submissions, blotters, and alarm telemetry contracts.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;

namespace Backend.Features.Services.Interfaces;

public interface IResponderOpsService
{
    Task<List<DutyUnitResponse>> GetRosterAsync(CancellationToken ct = default);
    Task<List<DutyUnitResponse>> GetRosterAsync(ResponderUnitType? agency, CancellationToken ct = default);
    Task<(bool Success, string? Error, DutyUnitResponse? Unit)> UpdateDutyStatusAsync(UpdateDutyStatusRequest request, Guid? userId = null, CancellationToken ct = default);
    Task<(bool Success, string? Error)> UpdateUnitStatusAsync(Guid unitId, DutyStatus status, CancellationToken ct = default);
    Task<(bool Success, string? Error, PcrResponse? Pcr)> SubmitPcrAsync(CreatePcrRequest request, Guid? userId = null, CancellationToken ct = default);
    Task<List<PcrResponse>> GetPcrRecordsAsync(Guid? reportId = null, CancellationToken ct = default);
    Task<(bool Success, string? Error, BlotterResponse? Blotter)> FileBlotterAsync(CreateBlotterRequest request, Guid? userId = null, CancellationToken ct = default);
    Task<List<BlotterResponse>> GetBlotterEntriesAsync(Guid? reportId = null, CancellationToken ct = default);
    Task<(bool Success, string? Error, AlarmLevelResponse? Alarm)> SetAlarmLevelAsync(SetAlarmLevelRequest request, Guid? userId = null, CancellationToken ct = default);
    Task<List<AlarmLevelResponse>> GetAlarmStatusesAsync(Guid? reportId = null, CancellationToken ct = default);
    Task<List<HydrantResponse>> GetHydrantsAsync(CancellationToken ct = default);
}
