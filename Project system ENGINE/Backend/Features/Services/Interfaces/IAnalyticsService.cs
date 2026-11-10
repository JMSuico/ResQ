// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines analytics summaries, triage curves, severity metrics, and heatmap telemetry contracts.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;

namespace Backend.Features.Services.Interfaces;

public interface IAnalyticsService
{
    Task<AnalyticsSummaryResponse> GetSummaryAsync(CancellationToken ct = default);
    Task<List<TelemetryDataPoint>> GetVolume24hAsync(CancellationToken ct = default);
    Task<List<SeverityBreakdownItem>> GetSeverityBreakdownAsync(CancellationToken ct = default);
    Task<List<AgencyWorkloadItem>> GetAgencyWorkloadAsync(CancellationToken ct = default);
    Task<HeatmapMatrixResponse> GetHeatmapMatrixAsync(CancellationToken ct = default);
}
