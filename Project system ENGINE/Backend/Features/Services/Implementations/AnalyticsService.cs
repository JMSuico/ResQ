// [Layer: Backend/Services/Implementations]
// Responsibility: Implements incident analytics, Asia/Manila (UTC+8) volume telemetry, agency workloads, heatmap matrix, public overview, and role-scoped dashboards.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Backend.Features.Services.Implementations;

public class AnalyticsService(AppDbContext db) : IAnalyticsService
{
    private static readonly TimeSpan PhtOffset = TimeSpan.FromHours(8);

    private sealed record ScopedReportProjection(
        Guid Id,
        Guid ReporterId,
        IncidentCategory Category,
        IncidentSeverity Severity,
        ReportStatus Status,
        DateTime CreatedAt,
        ResponderUnitType? AllocatedAgency,
        string? AllocatedUnitCode,
        string? RecommendedAgencyUnit);

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

    public async Task<AnalyticsOverviewResponse> GetOverviewAsync(CancellationToken ct = default) =>
        await ExecuteGetOverviewAsync(ct);

    public async Task<RoleAnalyticsDashboardResponse> GetRoleDashboardAsync(
        UserRole role,
        Guid userId,
        ResponderUnitType callerUnit,
        string horizon = "30d",
        CancellationToken ct = default) =>
        await ExecuteGetRoleDashboardAsync(role, userId, callerUnit, horizon, ct);

    private static DateTime ToPht(DateTime utc) =>
        DateTime.SpecifyKind(utc, DateTimeKind.Utc).Add(PhtOffset);

    private static int MapDayOfWeekIndex(DayOfWeek dayOfWeek) =>
        dayOfWeek switch
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

    private async Task<AnalyticsSummaryResponse> ExecuteGetSummaryAsync(CancellationToken ct)
    {
        var totalIncidents = await db.Reports.CountAsync(ct);
        var activeDispatches = await db.Reports.CountAsync(
            r => r.Status != ReportStatus.Resolved && r.Status != ReportStatus.Rejected && r.Status != ReportStatus.Closed, ct);
        var criticalIncidents = await db.Reports.CountAsync(
            r => r.Severity == IncidentSeverity.Critical
                 && r.Status != ReportStatus.Resolved
                 && r.Status != ReportStatus.Closed
                 && r.Status != ReportStatus.Rejected,
            ct);
        var resolvedCount = await db.Reports.CountAsync(
            r => r.Status == ReportStatus.Resolved || r.Status == ReportStatus.Closed, ct);
        var totalResponders = await db.Users.CountAsync(
            u => u.Role == UserRole.Responder && !u.IsDeleted, ct);
        var onDutyResponders = await db.DutyUnits.CountAsync(
            d => d.Status == DutyStatus.OnDuty, ct);
        var registeredCivilians = await db.Users.CountAsync(
            u => u.Role == UserRole.Civilian && !u.IsDeleted, ct);

        return new AnalyticsSummaryResponse(
            totalIncidents,
            activeDispatches,
            criticalIncidents,
            resolvedCount,
            totalResponders,
            onDutyResponders,
            registeredCivilians);
    }

    private async Task<List<TelemetryDataPoint>> ExecuteGetVolume24hAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var timestamps = await db.Reports
            .AsNoTracking()
            .Where(r => r.CreatedAt >= cutoff)
            .Select(r => r.CreatedAt)
            .ToListAsync(ct);

        return Build24hPhtBuckets(timestamps);
    }

    private static List<TelemetryDataPoint> Build24hPhtBuckets(IEnumerable<DateTime> utcTimestamps)
    {
        var buckets = new Dictionary<string, int>
        {
            ["00:00"] = 0,
            ["04:00"] = 0,
            ["08:00"] = 0,
            ["12:00"] = 0,
            ["16:00"] = 0,
            ["20:00"] = 0
        };

        foreach (var utcTs in utcTimestamps)
        {
            DateTime pht = ToPht(utcTs);
            int bucketHour = (pht.Hour / 4) * 4;
            string key = $"{bucketHour:D2}:00";
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
            .AsNoTracking()
            .GroupBy(r => r.Severity)
            .Select(g => new { Severity = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Severity, x => x.Count, ct);

        return BuildSeverityBreakdown(severityCounts);
    }

    private static List<SeverityBreakdownItem> BuildSeverityBreakdown(IReadOnlyDictionary<IncidentSeverity, int> severityCounts) =>
        [
            new SeverityBreakdownItem("Low", severityCounts.GetValueOrDefault(IncidentSeverity.Low, 0), "#10b981"),
            new SeverityBreakdownItem("Medium", severityCounts.GetValueOrDefault(IncidentSeverity.Medium, 0), "#f59e0b"),
            new SeverityBreakdownItem("High", severityCounts.GetValueOrDefault(IncidentSeverity.High, 0), "#ea580c"),
            new SeverityBreakdownItem("Critical", severityCounts.GetValueOrDefault(IncidentSeverity.Critical, 0), "#ef4444")
        ];

    private async Task<List<AgencyWorkloadItem>> ExecuteGetAgencyWorkloadAsync(CancellationToken ct)
    {
        var reports = await db.Reports
            .AsNoTracking()
            .Where(r => r.Status != ReportStatus.Rejected)
            .OrderByDescending(r => r.CreatedAt)
            .Take(10000)
            .Select(r => new ScopedReportProjection(
                r.Id,
                r.ReporterId,
                r.Category,
                r.Severity,
                r.Status,
                r.CreatedAt,
                r.AllocatedUnit != null ? (ResponderUnitType?)r.AllocatedUnit.Agency : null,
                r.AllocatedUnitCode,
                r.RecommendedAgencyUnit))
            .ToListAsync(ct);

        return BuildAgencyWorkload(reports);
    }

    private static string ClassifyAgency(ScopedReportProjection r)
    {
        if (r.AllocatedAgency == ResponderUnitType.RHU) return "RHU";
        if (r.AllocatedAgency == ResponderUnitType.FIRE) return "FIRE";
        if (r.AllocatedAgency == ResponderUnitType.PNP) return "PNP";
        if (r.AllocatedAgency == ResponderUnitType.LDRRMO) return "LDRRMO";

        if (!string.IsNullOrWhiteSpace(r.AllocatedUnitCode))
        {
            if (r.AllocatedUnitCode.Contains("RHU", StringComparison.OrdinalIgnoreCase) ||
                r.AllocatedUnitCode.Contains("EMS", StringComparison.OrdinalIgnoreCase))
                return "RHU";
            if (r.AllocatedUnitCode.Contains("BFP", StringComparison.OrdinalIgnoreCase) ||
                r.AllocatedUnitCode.Contains("FIRE", StringComparison.OrdinalIgnoreCase))
                return "FIRE";
            if (r.AllocatedUnitCode.Contains("PNP", StringComparison.OrdinalIgnoreCase))
                return "PNP";
            if (r.AllocatedUnitCode.Contains("LDRRMO", StringComparison.OrdinalIgnoreCase))
                return "LDRRMO";
        }

        if (!string.IsNullOrWhiteSpace(r.RecommendedAgencyUnit))
        {
            if (r.RecommendedAgencyUnit.Contains("RHU", StringComparison.OrdinalIgnoreCase) ||
                r.RecommendedAgencyUnit.Contains("Medical", StringComparison.OrdinalIgnoreCase))
                return "RHU";
            if (r.RecommendedAgencyUnit.Contains("FIRE", StringComparison.OrdinalIgnoreCase) ||
                r.RecommendedAgencyUnit.Contains("BFP", StringComparison.OrdinalIgnoreCase))
                return "FIRE";
            if (r.RecommendedAgencyUnit.Contains("PNP", StringComparison.OrdinalIgnoreCase) ||
                r.RecommendedAgencyUnit.Contains("Police", StringComparison.OrdinalIgnoreCase))
                return "PNP";
            if (r.RecommendedAgencyUnit.Contains("LDRRMO", StringComparison.OrdinalIgnoreCase))
                return "LDRRMO";
        }

        return r.Category switch
        {
            IncidentCategory.MedicalEmergency => "RHU",
            IncidentCategory.StructuralFire => "FIRE",
            IncidentCategory.VehicularAccident or IncidentCategory.CrimeOrSecurity => "PNP",
            _ => "LDRRMO"
        };
    }

    private static List<AgencyWorkloadItem> BuildAgencyWorkload(IEnumerable<ScopedReportProjection> reports)
    {
        int rhuCount = 0;
        int fireCount = 0;
        int pnpCount = 0;
        int ldrrmoCount = 0;

        foreach (var r in reports)
        {
            switch (ClassifyAgency(r))
            {
                case "RHU": rhuCount++; break;
                case "FIRE": fireCount++; break;
                case "PNP": pnpCount++; break;
                default: ldrrmoCount++; break;
            }
        }

        int total = rhuCount + fireCount + pnpCount + ldrrmoCount;
        double[] pcts = total > 0
            ? [
                Math.Round((double)rhuCount / total * 100.0, 1),
                Math.Round((double)fireCount / total * 100.0, 1),
                Math.Round((double)pnpCount / total * 100.0, 1),
                Math.Round((double)ldrrmoCount / total * 100.0, 1)
            ]
            : [0.0, 0.0, 0.0, 0.0];

        if (total > 0)
        {
            double diff = Math.Round(100.0 - pcts.Sum(), 1);
            if (Math.Abs(diff) > 0.0)
            {
                int maxIdx = 0;
                for (int i = 1; i < pcts.Length; i++)
                {
                    if (pcts[i] > pcts[maxIdx]) maxIdx = i;
                }
                pcts[maxIdx] = Math.Round(pcts[maxIdx] + diff, 1);
            }
        }

        return
        [
            new AgencyWorkloadItem("RHU", rhuCount, "#0284c7", pcts[0]),
            new AgencyWorkloadItem("FIRE", fireCount, "#ea580c", pcts[1]),
            new AgencyWorkloadItem("PNP", pnpCount, "#3b82f6", pcts[2]),
            new AgencyWorkloadItem("LDRRMO", ldrrmoCount, "#670626", pcts[3])
        ];
    }

    private async Task<HeatmapMatrixResponse> ExecuteGetHeatmapMatrixAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddDays(-7);
        var recentTimestamps = await db.Reports
            .AsNoTracking()
            .Where(r => r.CreatedAt >= cutoff)
            .Select(r => r.CreatedAt)
            .ToListAsync(ct);

        return BuildHeatmapMatrix(recentTimestamps);
    }

    private static HeatmapMatrixResponse BuildHeatmapMatrix(IEnumerable<DateTime> utcTimestamps)
    {
        var days = new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };
        var hours = new List<string> { "00", "04", "08", "12", "16", "20" };

        int[][] matrix = new int[7][];
        for (int i = 0; i < 7; i++)
            matrix[i] = new int[6];

        foreach (var utcTs in utcTimestamps)
        {
            DateTime pht = ToPht(utcTs);
            int dayIndex = MapDayOfWeekIndex(pht.DayOfWeek);
            int hourIndex = Math.Clamp(pht.Hour / 4, 0, 5);
            matrix[dayIndex][hourIndex]++;
        }

        return new HeatmapMatrixResponse(days, hours, matrix);
    }

    private async Task<AnalyticsOverviewResponse> ExecuteGetOverviewAsync(CancellationToken ct)
    {
        var volumePoints = await ExecuteGetVolume24hAsync(ct);
        var activeIncidents = await db.Reports.CountAsync(
            r => r.Status != ReportStatus.Resolved && r.Status != ReportStatus.Closed && r.Status != ReportStatus.Rejected,
            ct);
        var resolvedIncidents = await db.Reports.CountAsync(
            r => r.Status == ReportStatus.Resolved || r.Status == ReportStatus.Closed,
            ct);
        var onDutyUnits = await db.DutyUnits.CountAsync(
            d => d.Status == DutyStatus.OnDuty,
            ct);

        return new AnalyticsOverviewResponse(
            VolumeSeries: volumePoints.Select(p => p.Value).ToList(),
            ActiveIncidents: activeIncidents,
            ResolvedIncidents: resolvedIncidents,
            OnDutyUnits: onDutyUnits,
            GeneratedAtUtc: DateTime.UtcNow);
    }

    private async Task<RoleAnalyticsDashboardResponse> ExecuteGetRoleDashboardAsync(
        UserRole role,
        Guid userId,
        ResponderUnitType callerUnit,
        string horizon,
        CancellationToken ct)
    {
        string normalizedHorizon = (horizon ?? "30d").Trim().ToLowerInvariant() switch
        {
            "24h" => "24h",
            "7d" => "7d",
            "30d" => "30d",
            "annual" => "annual",
            "all" => "all",
            _ => "30d"
        };

        DateTime nowUtc = DateTime.UtcNow;
        DateTime? cutoffUtc = normalizedHorizon switch
        {
            "24h" => nowUtc.AddHours(-24),
            "7d" => nowUtc.AddDays(-7),
            "30d" => nowUtc.AddDays(-30),
            "annual" => nowUtc.AddDays(-365),
            _ => null
        };

        IQueryable<Features.Data.Models.Report> baseQuery = db.Reports.AsNoTracking();
        if (cutoffUtc.HasValue)
            baseQuery = baseQuery.Where(r => r.CreatedAt >= cutoffUtc.Value);

        if (role == UserRole.Civilian)
            baseQuery = baseQuery.Where(r => r.ReporterId == userId);

        List<ScopedReportProjection> projected = await baseQuery
            .OrderByDescending(r => r.CreatedAt)
            .Take(10000)
            .Select(r => new ScopedReportProjection(
                r.Id,
                r.ReporterId,
                r.Category,
                r.Severity,
                r.Status,
                r.CreatedAt,
                r.AllocatedUnit != null ? (ResponderUnitType?)r.AllocatedUnit.Agency : null,
                r.AllocatedUnitCode,
                r.RecommendedAgencyUnit))
            .ToListAsync(ct);

        List<ScopedReportProjection> scoped = role switch
        {
            UserRole.LDRRMO_Admin => projected,
            UserRole.Civilian => projected,
            UserRole.Responder when callerUnit != ResponderUnitType.None => projected
                .Where(r =>
                    string.Equals(ClassifyAgency(r), callerUnit.ToString(), StringComparison.OrdinalIgnoreCase) ||
                    (r.AllocatedAgency is null &&
                     r.RecommendedAgencyUnit is not null &&
                     r.RecommendedAgencyUnit.Contains("Joint Dispatch", StringComparison.OrdinalIgnoreCase)))
                .ToList(),
            _ => []
        };

        int totalIncidents = scoped.Count;
        int activeDispatches = scoped.Count(r => r.Status != ReportStatus.Resolved && r.Status != ReportStatus.Closed && r.Status != ReportStatus.Rejected);
        int criticalIncidents = scoped.Count(r => r.Severity == IncidentSeverity.Critical && r.Status != ReportStatus.Resolved && r.Status != ReportStatus.Closed && r.Status != ReportStatus.Rejected);
        int resolvedCount = scoped.Count(r => r.Status == ReportStatus.Resolved || r.Status == ReportStatus.Closed);

        int totalResponders = role switch
        {
            UserRole.LDRRMO_Admin => await db.Users.CountAsync(u => u.Role == UserRole.Responder && !u.IsDeleted, ct),
            UserRole.Responder when callerUnit != ResponderUnitType.None => await db.Users.CountAsync(u => u.Role == UserRole.Responder && u.Unit == callerUnit && !u.IsDeleted, ct),
            _ => 0
        };

        int onDutyResponders = role switch
        {
            UserRole.Responder when callerUnit != ResponderUnitType.None => await db.DutyUnits.CountAsync(d => d.Status == DutyStatus.OnDuty && d.Agency == callerUnit, ct),
            _ => await db.DutyUnits.CountAsync(d => d.Status == DutyStatus.OnDuty, ct)
        };

        int registeredCivilians = role == UserRole.LDRRMO_Admin
            ? await db.Users.CountAsync(u => u.Role == UserRole.Civilian && !u.IsDeleted, ct)
            : 0;

        var summary = new AnalyticsSummaryResponse(
            totalIncidents,
            activeDispatches,
            criticalIncidents,
            resolvedCount,
            totalResponders,
            onDutyResponders,
            registeredCivilians);

        List<TelemetryDataPoint> volumeTrend = BuildVolumeTrendForHorizon(scoped.Select(r => r.CreatedAt), normalizedHorizon, nowUtc);

        Dictionary<IncidentSeverity, int> sevDict = scoped
            .GroupBy(r => r.Severity)
            .ToDictionary(g => g.Key, g => g.Count());
        List<SeverityBreakdownItem> severityBreakdown = BuildSeverityBreakdown(sevDict);

        List<AgencyWorkloadItem> agencyWorkload = BuildAgencyWorkload(scoped.Where(r => r.Status != ReportStatus.Rejected));
        HeatmapMatrixResponse heatmap = BuildHeatmapMatrix(scoped.Select(r => r.CreatedAt));

        Dictionary<IncidentCategory, int> catDict = scoped
            .GroupBy(r => r.Category)
            .ToDictionary(g => g.Key, g => g.Count());
        List<SeverityBreakdownItem> categoryBreakdown =
        [
            new SeverityBreakdownItem("Vehicular Accident", catDict.GetValueOrDefault(IncidentCategory.VehicularAccident, 0), "#3b82f6"),
            new SeverityBreakdownItem("Medical Emergency", catDict.GetValueOrDefault(IncidentCategory.MedicalEmergency, 0), "#10b981"),
            new SeverityBreakdownItem("Structural Fire", catDict.GetValueOrDefault(IncidentCategory.StructuralFire, 0), "#ea580c"),
            new SeverityBreakdownItem("Crime / Security", catDict.GetValueOrDefault(IncidentCategory.CrimeOrSecurity, 0), "#8b5cf6")
        ];

        string scopeLabel = role switch
        {
            UserRole.LDRRMO_Admin => "LDRRMO_Admin",
            UserRole.Responder => $"Responder:{callerUnit}",
            UserRole.Civilian => "Civilian",
            _ => "Unknown"
        };

        return new RoleAnalyticsDashboardResponse(
            Scope: scopeLabel,
            Summary: summary,
            VolumeTrend: volumeTrend,
            SeverityBreakdown: severityBreakdown,
            AgencyWorkload: agencyWorkload,
            HeatmapMatrix: heatmap,
            CategoryBreakdown: categoryBreakdown);
    }

    private static List<TelemetryDataPoint> BuildVolumeTrendForHorizon(
        IEnumerable<DateTime> utcTimestamps,
        string horizon,
        DateTime nowUtc)
    {
        List<DateTime> phtTimes = utcTimestamps.Select(ToPht).ToList();
        DateTime nowPht = ToPht(nowUtc);

        if (horizon == "24h")
            return Build24hPhtBuckets(utcTimestamps);

        if (horizon == "7d")
        {
            DateTime todayPht = nowPht.Date;
            var result = new List<TelemetryDataPoint>(7);
            for (int i = 6; i >= 0; i--)
            {
                DateTime day = todayPht.AddDays(-i);
                int count = phtTimes.Count(t => t.Date == day);
                result.Add(new TelemetryDataPoint(day.ToString("MMM dd"), count));
            }
            return result;
        }

        if (horizon == "30d")
        {
            DateTime todayPht = nowPht.Date;
            var result = new List<TelemetryDataPoint>(6);
            for (int i = 5; i >= 0; i--)
            {
                DateTime endDay = todayPht.AddDays(-(i * 5));
                DateTime startDay = endDay.AddDays(-4);
                int count = phtTimes.Count(t => t.Date >= startDay && t.Date <= endDay);
                result.Add(new TelemetryDataPoint($"{startDay:MMM dd}-{endDay:dd}", count));
            }
            return result;
        }

        if (horizon == "annual")
        {
            DateTime currentMonth = new(nowPht.Year, nowPht.Month, 1);
            var result = new List<TelemetryDataPoint>(12);
            for (int i = 11; i >= 0; i--)
            {
                DateTime monthStart = currentMonth.AddMonths(-i);
                int count = phtTimes.Count(t => t.Year == monthStart.Year && t.Month == monthStart.Month);
                result.Add(new TelemetryDataPoint(monthStart.ToString("MMM yy"), count));
            }
            return result;
        }

        // "all": 6 chronological intervals covering earliest report to now (or last 6 months if empty/single day)
        if (phtTimes.Count == 0)
        {
            DateTime currentMonth = new(nowPht.Year, nowPht.Month, 1);
            return Enumerable.Range(0, 6)
                .Select(i => new TelemetryDataPoint(currentMonth.AddMonths(-(5 - i)).ToString("MMM yy"), 0))
                .ToList();
        }

        DateTime minDate = phtTimes.Min().Date;
        DateTime maxDate = nowPht.Date >= phtTimes.Max().Date ? nowPht.Date : phtTimes.Max().Date;
        double totalDays = Math.Max(6, (maxDate - minDate).TotalDays + 1);
        double step = totalDays / 6.0;
        var allResult = new List<TelemetryDataPoint>(6);
        for (int i = 0; i < 6; i++)
        {
            DateTime segStart = minDate.AddDays(Math.Floor(i * step));
            DateTime segEnd = i == 5 ? maxDate : minDate.AddDays(Math.Floor((i + 1) * step) - 1);
            if (segEnd < segStart) segEnd = segStart;
            int count = phtTimes.Count(t => t.Date >= segStart && t.Date <= segEnd);
            allResult.Add(new TelemetryDataPoint($"{segStart:MMM dd}", count));
        }
        return allResult;
    }
}
