// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes telemetry, public non-PII overview, role-scoped dashboards, and dynamic database-driven analytics endpoints.
// DO NOT return hardcoded mock metrics.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/analytics")]
public class AnalyticsController(
    IAnalyticsService analyticsService,
    IUserRepository? userRepo = null) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverviewAsync(CancellationToken ct) =>
        Ok(await analyticsService.GetOverviewAsync(ct));

    [HttpGet("role-dashboard")]
    public async Task<IActionResult> GetRoleDashboardAsync([FromQuery] string horizon = "30d", CancellationToken ct = default)
    {
        if (HttpContext?.Items["UserRole"] is not UserRole role ||
            HttpContext.Items["UserId"] is not Guid userId ||
            userId == Guid.Empty)
        {
            return Unauthorized(new { message = "Authentication session required." });
        }

        ResponderUnitType callerUnit = await ResolveCallerUnitAsync(userId, ct);
        return Ok(await analyticsService.GetRoleDashboardAsync(role, userId, callerUnit, horizon, ct));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummaryAsync(CancellationToken ct) =>
        AuthorizeFleetTelemetry() ?? Ok(await analyticsService.GetSummaryAsync(ct));

    [HttpGet("volume-24h")]
    public async Task<IActionResult> GetVolume24hAsync(CancellationToken ct) =>
        AuthorizeFleetTelemetry() ?? Ok(await analyticsService.GetVolume24hAsync(ct));

    [HttpGet("severity-breakdown")]
    public async Task<IActionResult> GetSeverityBreakdownAsync(CancellationToken ct) =>
        AuthorizeFleetTelemetry() ?? Ok(await analyticsService.GetSeverityBreakdownAsync(ct));

    [HttpGet("agency-workload")]
    public async Task<IActionResult> GetAgencyWorkloadAsync(CancellationToken ct) =>
        AuthorizeFleetTelemetry() ?? Ok(await analyticsService.GetAgencyWorkloadAsync(ct));

    [HttpGet("heatmap-matrix")]
    public async Task<IActionResult> GetHeatmapMatrixAsync(CancellationToken ct) =>
        AuthorizeFleetTelemetry() ?? Ok(await analyticsService.GetHeatmapMatrixAsync(ct));

    private IActionResult? AuthorizeFleetTelemetry() =>
        HttpContext?.Items["UserRole"] is not UserRole role
            ? Unauthorized(new { message = "Authentication session required." })
            : role != UserRole.LDRRMO_Admin && role != UserRole.Responder
                ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Fleet-wide analytics are restricted to LDRRMO Administrators and Responders." })
                : null;

    private async Task<ResponderUnitType> ResolveCallerUnitAsync(Guid userId, CancellationToken ct)
    {
        if (HttpContext?.Items["UserUnit"] is ResponderUnitType unit && unit != ResponderUnitType.None)
            return unit;

        if (HttpContext?.Items["User"] is User ctxUser && ctxUser.Unit != ResponderUnitType.None)
            return ctxUser.Unit;

        if (userRepo is not null)
        {
            User? dbUser = await userRepo.GetByIdAsync(userId, ct);
            if (dbUser is not null)
                return dbUser.Unit;
        }

        return ResponderUnitType.None;
    }
}
