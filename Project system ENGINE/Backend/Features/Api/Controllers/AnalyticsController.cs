// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes telemetry and dynamic database-driven analytics endpoints.
// DO NOT return hardcoded mock metrics.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/analytics")]
public class AnalyticsController(IAnalyticsService analyticsService) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummaryAsync(CancellationToken ct) =>
        Ok(await analyticsService.GetSummaryAsync(ct));

    [HttpGet("volume-24h")]
    public async Task<IActionResult> GetVolume24hAsync(CancellationToken ct) =>
        Ok(await analyticsService.GetVolume24hAsync(ct));

    [HttpGet("severity-breakdown")]
    public async Task<IActionResult> GetSeverityBreakdownAsync(CancellationToken ct) =>
        Ok(await analyticsService.GetSeverityBreakdownAsync(ct));

    [HttpGet("agency-workload")]
    public async Task<IActionResult> GetAgencyWorkloadAsync(CancellationToken ct) =>
        Ok(await analyticsService.GetAgencyWorkloadAsync(ct));

    [HttpGet("heatmap-matrix")]
    public async Task<IActionResult> GetHeatmapMatrixAsync(CancellationToken ct) =>
        Ok(await analyticsService.GetHeatmapMatrixAsync(ct));
}
