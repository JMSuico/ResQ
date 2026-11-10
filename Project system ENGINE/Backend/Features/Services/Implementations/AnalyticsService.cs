// [Layer: Backend/Services/Implementations]
// Responsibility: Implements incident analytics, 24-hour volume telemetry, agency workloads, and heatmap matrix calculations.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Backend.Features.Services.Implementations;

public class AnalyticsService(AppDbContext db) : IAnalyticsService
{
    public async Task<AnalyticsSummaryResponse> GetSummaryAsync(CancellationToken ct = default) =>
        await ExecuteGetSummaryAsync(ct);

    public async Task<List<TelemetryDataPoint>> GetVolume24hAsync(CancellationToken ct = default) =>
        await ExecuteGetVolume24hAsync(ct);

    public async Task<List<SeverityBreakdownItem>> GetSeverityBreakdownAsync(CancellationToken ct = default) =>
        await ExecuteGetSeverityBreakdownAsync(ct);

    public async Task<List<AgencyWorkloadItem>> GetAgencyWorkloadAsync(CancellationToken ct = default) =>
        await ExecuteGetAgencyWorkloadAsync(ct);

    public async Task<HeatmapMatrixResponse> GetHeatmapMatrixAsync(CancellationToken ct = default) =>
        await ExecuteGetHeatmapMatrixAsync(ct);

    private async Task<AnalyticsSummaryResponse> ExecuteGetSummaryAsync(CancellationToken ct)
    {
        var totalIncidents = await db.Reports.CountAsync(ct);
        var activeDispatches = await db.Reports.CountAsync(
            r => r.Status != ReportStatus.Resolved && r.Status != ReportStatus.Rejected && r.Status != ReportStatus.Closed, ct);
        var criticalIncidents = await db.Reports.CountAsync(
            r => r.Severity == IncidentSeverity.Critical, ct);
        var resolvedCount = await db.Reports.CountAsync(
            r => r.Status == ReportStatus.Resolved || r.Status == ReportStatus.Closed, ct);
        var totalResponders = await db.Users.CountAsync(
            u => u.Role == UserRole.Responder, ct);
        var onDutyResponders = await db.DutyUnits.CountAsync(
            d => d.Status == DutyStatus.OnDuty, ct);
        var registeredCivilians = await db.Users.CountAsync(
            u => u.Role == UserRole.Civilian, ct);

        return new AnalyticsSummaryResponse(
            totalIncidents,
            activeDispatches,
            criticalIncidents,
            resolvedCount,
            totalResponders,
            onDutyResponders,
            registeredCivilians
        );
    }

    private async Task<List<TelemetryDataPoint>> ExecuteGetVolume24hAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var timestamps = await db.Reports
            .Where(r => r.CreatedAt >= cutoff)
            .Select(r => r.CreatedAt)
            .ToListAsync(ct);

        var buckets = new Dictionary<string, int>
        {
            ["00:00"] = 0,
            ["04:00"] = 0,
            ["08:00"] = 0,
            ["12:00"] = 0,
            ["16:00"] = 0,
            ["20:00"] = 0
        };

        foreach (var ts in timestamps)
        {
            var bucketHour = (ts.Hour / 4) * 4;
            var key = $"{bucketHour:D2}:00";
            if (buckets.ContainsKey(key))
            {
                buckets[key]++;
            }
        }

        return buckets.Select(kv => new TelemetryDataPoint(kv.Key, kv.Value)).ToList();
    }

    private async Task<List<SeverityBreakdownItem>> ExecuteGetSeverityBreakdownAsync(CancellationToken ct)
    {
        var severityCounts = await db.Reports
            .GroupBy(r => r.Severity)
            .Select(g => new { Severity = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Severity, x => x.Count, ct);

        return
        [
            new SeverityBreakdownItem("Low", severityCounts.GetValueOrDefault(IncidentSeverity.Low, 0), "#10b981"),
            new SeverityBreakdownItem("Medium", severityCounts.GetValueOrDefault(IncidentSeverity.Medium, 0), "#f59e0b"),
            new SeverityBreakdownItem("High", severityCounts.GetValueOrDefault(IncidentSeverity.High, 0), "#ea580c"),
            new SeverityBreakdownItem("Critical", severityCounts.GetValueOrDefault(IncidentSeverity.Critical, 0), "#ef4444")
        ];
    }

    private async Task<List<AgencyWorkloadItem>> ExecuteGetAgencyWorkloadAsync(CancellationToken ct)
    {
        var reports = await db.Reports
            .Include(r => r.AllocatedUnit)
            .Where(r => r.AllocatedUnitId != null)
            .ToListAsync(ct);

        int rhuCount = 0;
        int fireCount = 0;
        int pnpCount = 0;

        foreach (var r in reports)
        {
            var agency = r.AllocatedUnit?.Agency;
            if (agency == ResponderUnitType.RHU || r.AllocatedUnitCode?.StartsWith("RHU", StringComparison.OrdinalIgnoreCase) == true)
            {
                rhuCount++;
            }
            else if (agency == ResponderUnitType.FIRE || r.AllocatedUnitCode?.StartsWith("BFP", StringComparison.OrdinalIgnoreCase) == true || r.AllocatedUnitCode?.StartsWith("FIRE", StringComparison.OrdinalIgnoreCase) == true)
            {
                fireCount++;
            }
            else if (agency == ResponderUnitType.PNP || r.AllocatedUnitCode?.StartsWith("PNP", StringComparison.OrdinalIgnoreCase) == true)
            {
                pnpCount++;
            }
        }

        int total = rhuCount + fireCount + pnpCount;
        double rhuPct = total > 0 ? Math.Round((double)rhuCount / total * 100.0, 1) : 0.0;
        double firePct = total > 0 ? Math.Round((double)fireCount / total * 100.0, 1) : 0.0;
        double pnpPct = total > 0 ? Math.Round((double)pnpCount / total * 100.0, 1) : 0.0;

        return
        [
            new AgencyWorkloadItem("RHU", rhuCount, "#0284c7", rhuPct),
            new AgencyWorkloadItem("FIRE", fireCount, "#ea580c", firePct),
            new AgencyWorkloadItem("PNP", pnpCount, "#3b82f6", pnpPct)
        ];
    }

    private async Task<HeatmapMatrixResponse> ExecuteGetHeatmapMatrixAsync(CancellationToken ct)
    {
        var days = new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };
        var hours = new List<string> { "00", "04", "08", "12", "16", "20" };

        int[][] matrix = new int[7][];
        for (int i = 0; i < 7; i++)
        {
            matrix[i] = new int[6];
        }

        var cutoff = DateTime.UtcNow.AddDays(-7);
        var recentTimestamps = await db.Reports
            .Where(r => r.CreatedAt >= cutoff)
            .Select(r => r.CreatedAt)
            .ToListAsync(ct);

        foreach (var ts in recentTimestamps)
        {
            int dayIndex = ts.DayOfWeek switch
            {
                DayOfWeek.Monday => 0,
                DayOfWeek.Tuesday => 1,
                DayOfWeek.Wednesday => 2,
                DayOfWeek.Thursday => 3,
                DayOfWeek.Friday => 4,
                DayOfWeek.Saturday => 5,
                DayOfWeek.Sunday => 6,
                _ => 0
            };

            int hourIndex = Math.Clamp(ts.Hour / 4, 0, 5);
            matrix[dayIndex][hourIndex]++;
        }

        return new HeatmapMatrixResponse(days, hours, matrix);
    }
}
