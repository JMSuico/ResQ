// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines incident triage, unit allocation, verification, and severity escalation service contracts.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;

namespace Backend.Features.Services.Interfaces;

public interface ITriageService
{
    Task<List<IncidentFixtureResponse>> GetActiveFixturesAsync(CancellationToken ct = default);
    Task<(bool Success, string? Error)> VerifyReportAsync(Guid reportId, Guid adminId, VerifyReportRequest request, CancellationToken ct = default);
    Task<(bool Success, string? Error)> AllocateUnitAsync(Guid reportId, Guid adminId, Guid unitId, CancellationToken ct = default);
    Task<(bool Success, string? Error)> UpdateReportSeverityAsync(Guid reportId, Guid adminId, IncidentSeverity severity, CancellationToken ct = default);
}
