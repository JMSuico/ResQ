// [Layer: Backend/Services/Standby]
// Responsibility: Implements Claude Standby AI Multi-Objective Responder Auto-Dispatch Strategy with Proximity, Fairness Rotation (Unchosen Unit Boost), and Workload Scoring.
// Strategy Pattern (OCP), Universal Lambda Expressions (=>), Resilient Deterministic Fallback, Zero Emojis.

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Interfaces;

namespace ResQTrack.Backend.Features.Services.Standby;

public class ClaudeAutoDispatchResponderStrategy(
    ApplicationDbContext db,
    IConfiguration? configuration = null,
    IHttpClientFactory? httpClientFactory = null,
    ILogger<ClaudeAutoDispatchResponderStrategy>? logger = null,
    IClaudeMessagesClient? claudeMessagesClient = null) : IStandbyResponderAutoDispatchStrategy
{
    private const double EarthRadiusKm = 6371.0;
    private const string FallbackProviderName = "DeterministicTacticalScorer";

    private IClaudeMessagesClient? MessagesClient { get; } =
        claudeMessagesClient ?? (configuration is not null
            ? new ClaudeMessagesClient(
                httpClientFactory?.CreateClient("ClaudeMessages") ?? new HttpClient(),
                configuration,
                NullLogger<ClaudeMessagesClient>.Instance)
            : null);

    public string StrategyKey => "ClaudeStandbyAutoDispatchResponders";

    public async Task<StandbyAutoDispatchResult> SelectAndDispatchOptimalUnitAsync(
        StandbyAutoDispatchRequest request,
        CancellationToken ct = default)
    {
        var units = await LoadOrInitializeCandidateUnitsAsync(ct);
        var reports = await db.Reports.AsNoTracking().ToListAsync(ct);

        var filteredUnits = FilterByRequiredAgency(units, request.RequiredAgencyType);
        var candidatePool = filteredUnits.Count > 0 ? filteredUnits : units;

        var scoredCandidates = candidatePool
            .Select((unit, idx) => ScoreCandidateUnit(unit, idx + 1, request.IncidentLat, request.IncidentLng, reports))
            .OrderByDescending(c => c.CompositeScore)
            .ThenByDescending(c => c.NeverChosenBefore)
            .ThenBy(c => c.DistanceKm)
            .ToList();

        var selected = scoredCandidates.FirstOrDefault();

        if (request.ApplyDispatch && selected != null)
        {
            var unitEntity = candidatePool.FirstOrDefault(u =>
                string.Equals(u.UnitCode, selected.UnitCode, StringComparison.OrdinalIgnoreCase));
            if (unitEntity != null)
            {
                unitEntity.Status = DutyStatus.Dispatched;
                unitEntity.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
            }
        }

        var (providerUsed, tacticalReasoning) = await GenerateTacticalReasoningAsync(
            request,
            selected,
            scoredCandidates,
            ct);

        return new StandbyAutoDispatchResult(
            Success: selected != null,
            StrategyName: StrategyKey,
            ProviderUsed: providerUsed,
            IncidentId: request.IncidentId,
            SelectedUnit: selected,
            RankedCandidates: scoredCandidates,
            TacticalAiReasoning: tacticalReasoning,
            EvaluatedAtUtc: DateTime.UtcNow);
    }

    private static StandbyCandidateScoreDto ScoreCandidateUnit(
        DutyUnit unit,
        int responderUnitId,
        double incidentLat,
        double incidentLng,
        IReadOnlyList<Report> allReports)
    {
        double distanceKm = ComputeHaversineKm(incidentLat, incidentLng, unit.BaseLatitude, unit.BaseLongitude);
        int historicalCount = CountHistoricalDispatches(unit, allReports);
        bool neverChosen = historicalCount == 0;

        double proximityScore = Math.Max(0.0, 100.0 * Math.Exp(-distanceKm / 8.0));
        double fairnessRotationScore = neverChosen
            ? 100.0
            : 100.0 / (1.0 + (historicalCount * 0.85));
        double workloadScore = ResolveWorkloadScore(unit.Status);

        double compositeScore =
            (0.45 * proximityScore) +
            (0.35 * fairnessRotationScore) +
            (0.20 * workloadScore);

        string reason = BuildCandidateSelectionReason(
            unit.UnitCode,
            distanceKm,
            historicalCount,
            neverChosen,
            proximityScore,
            fairnessRotationScore,
            workloadScore,
            compositeScore);

        return new StandbyCandidateScoreDto(
            ResponderUnitId: responderUnitId,
            UnitCode: unit.UnitCode,
            UnitName: unit.UnitName,
            AgencyType: unit.Agency.ToString(),
            DistanceKm: Math.Round(distanceKm, 3),
            HistoricalDispatchCount: historicalCount,
            NeverChosenBefore: neverChosen,
            ProximityScore: Math.Round(proximityScore, 2),
            FairnessRotationScore: Math.Round(fairnessRotationScore, 2),
            WorkloadScore: Math.Round(workloadScore, 2),
            CompositeScore: Math.Round(compositeScore, 2),
            SelectionReason: reason);
    }

    private static int CountHistoricalDispatches(DutyUnit unit, IReadOnlyList<Report> allReports) =>
        allReports.Count(r =>
            (r.AllocatedUnitId.HasValue && r.AllocatedUnitId.Value == unit.Id) ||
            (!string.IsNullOrWhiteSpace(r.AllocatedUnitCode) &&
             string.Equals(r.AllocatedUnitCode, unit.UnitCode, StringComparison.OrdinalIgnoreCase)));

    private static double ResolveWorkloadScore(DutyStatus status) =>
        status switch
        {
            DutyStatus.OnDuty or DutyStatus.Standby => 100.0,
            DutyStatus.Dispatched => 25.0,
            _ => 0.0
        };

    private static double ComputeHaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        double dLat = DegreesToRadians(lat2 - lat1);
        double dLon = DegreesToRadians(lon2 - lon1);
        double a =
            Math.Pow(Math.Sin(dLat / 2.0), 2.0) +
            Math.Cos(DegreesToRadians(lat1)) *
            Math.Cos(DegreesToRadians(lat2)) *
            Math.Pow(Math.Sin(dLon / 2.0), 2.0);
        double c = 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(Math.Max(0.0, 1.0 - a)));
        return EarthRadiusKm * c;
    }

    private static double DegreesToRadians(double deg) =>
        deg * (Math.PI / 180.0);

    private static List<DutyUnit> FilterByRequiredAgency(List<DutyUnit> units, string? requiredAgencyType) =>
        string.IsNullOrWhiteSpace(requiredAgencyType)
            ? units
            : units.Where(u => MatchesAgency(u.Agency, requiredAgencyType)).ToList();

    private static bool MatchesAgency(ResponderUnitType agency, string requested) =>
        requested.Trim().ToUpperInvariant() switch
        {
            var s when s.Contains("RHU") || s.Contains("MEDIC") || s.Contains("EMS") || s.Contains("HEALTH") => agency == ResponderUnitType.RHU,
            var s when s.Contains("FIRE") || s.Contains("BFP") => agency == ResponderUnitType.FIRE,
            var s when s.Contains("PNP") || s.Contains("POLICE") => agency == ResponderUnitType.PNP,
            var s when s.Contains("LDRRMO") || s.Contains("COMMAND") => agency == ResponderUnitType.LDRRMO,
            var s => string.Equals(agency.ToString(), s, StringComparison.OrdinalIgnoreCase)
        };

    private async Task<List<DutyUnit>> LoadOrInitializeCandidateUnitsAsync(CancellationToken ct)
    {
        if (!await db.DutyUnits.AnyAsync(ct))
        {
            var fallbackUnits = CreateDefaultTacticalUnits();
            await db.DutyUnits.AddRangeAsync(fallbackUnits, ct);
            await db.SaveChangesAsync(ct);
            return fallbackUnits;
        }

        var activeUnits = await db.DutyUnits
            .Where(u => u.Status != DutyStatus.OffDuty)
            .ToListAsync(ct);

        return activeUnits.Count > 0
            ? activeUnits
            : await db.DutyUnits.ToListAsync(ct);
    }

    private static List<DutyUnit> CreateDefaultTacticalUnits() =>
    [
        new DutyUnit
        {
            UnitCode = "RHU-ALPHA",
            UnitName = "RHU Katipunan Emergency Medical Unit Alpha",
            Agency = ResponderUnitType.RHU,
            CommanderName = "Dr. Maria Clara Santos",
            Status = DutyStatus.OnDuty,
            BaseLatitude = 8.5142,
            BaseLongitude = 123.2862,
            ContactHotline = "(065) 212-0112",
            ActivePersonnelCount = 6
        },
        new DutyUnit
        {
            UnitCode = "RHU-BRAVO",
            UnitName = "RHU Katipunan Mobile Trauma Unit Bravo",
            Agency = ResponderUnitType.RHU,
            CommanderName = "Dr. Rafael Gomez",
            Status = DutyStatus.Standby,
            BaseLatitude = 8.5150,
            BaseLongitude = 123.2870,
            ContactHotline = "(065) 212-0113",
            ActivePersonnelCount = 5
        },
        new DutyUnit
        {
            UnitCode = "BFP-ENGINE-01",
            UnitName = "BFP Katipunan Fire Suppression Company 1",
            Agency = ResponderUnitType.FIRE,
            CommanderName = "Capt. Gabriel Mendoza",
            Status = DutyStatus.Standby,
            BaseLatitude = 8.5128,
            BaseLongitude = 123.2848,
            ContactHotline = "160 / (065) 212-0160",
            ActivePersonnelCount = 8
        },
        new DutyUnit
        {
            UnitCode = "PNP-SECTOR-01",
            UnitName = "PNP Katipunan Tactical Patrol Sector 1",
            Agency = ResponderUnitType.PNP,
            CommanderName = "Lt. Col. Arthur Pendelton",
            Status = DutyStatus.OnDuty,
            BaseLatitude = 8.5160,
            BaseLongitude = 123.2835,
            ContactHotline = "117 / (065) 212-0117",
            ActivePersonnelCount = 10
        },
        new DutyUnit
        {
            UnitCode = "LDRRMO-HQ",
            UnitName = "LDRRMO Katipunan Central Command Rescue",
            Agency = ResponderUnitType.LDRRMO,
            CommanderName = "Dir. Alejandro Ramos",
            Status = DutyStatus.OnDuty,
            BaseLatitude = 8.5136,
            BaseLongitude = 123.2856,
            ContactHotline = "911 / (065) 212-0001",
            ActivePersonnelCount = 12
        }
    ];

    private async Task<(string ProviderUsed, string Reasoning)> GenerateTacticalReasoningAsync(
        StandbyAutoDispatchRequest request,
        StandbyCandidateScoreDto? selected,
        IReadOnlyList<StandbyCandidateScoreDto> ranked,
        CancellationToken ct)
    {
        if (selected == null)
        {
            return (FallbackProviderName, "No eligible responder units were available for dispatch.");
        }

        string deterministicSummary =
            $"Selected {selected.UnitCode} ({selected.UnitName}) with top CompositeScore {selected.CompositeScore:F2} " +
            $"[ProximityScore={selected.ProximityScore:F2} at {selected.DistanceKm:F2} km, " +
            $"FairnessRotationScore={selected.FairnessRotationScore:F2} (HistoricalDispatches={selected.HistoricalDispatchCount}, NeverChosenBefore={selected.NeverChosenBefore}), " +
            $"WorkloadScore={selected.WorkloadScore:F2}] among {ranked.Count} evaluated tactical units.";

        if (MessagesClient is null || !MessagesClient.IsConfigured)
        {
            return (FallbackProviderName, deterministicSummary);
        }

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(8));

            string prompt =
                $"Explain in 1 concise tactical sentence why responder unit {selected.UnitCode} ({selected.AgencyType}) " +
                $"was auto-selected for Incident #{request.IncidentId} ({request.IncidentType ?? "Emergency"}, Severity: {request.Severity ?? "High"}). " +
                $"Metrics: Distance={selected.DistanceKm:F2}km, ProximityScore={selected.ProximityScore:F2}, " +
                $"FairnessRotationScore={selected.FairnessRotationScore:F2} (NeverChosenBefore={selected.NeverChosenBefore}, HistoricalCount={selected.HistoricalDispatchCount}), " +
                $"CompositeScore={selected.CompositeScore:F2}.";

            var payload = new Dictionary<string, object>
            {
                ["max_tokens"] = 160,
                ["temperature"] = 0.1,
                ["messages"] = new object[]
                {
                    new { role = "user", content = prompt }
                }
            };

            ClaudeMessageAttemptResult result = await MessagesClient.SendMessagesAsync(payload, cts.Token);
            if (result.Success && !string.IsNullOrWhiteSpace(result.RawText))
            {
                string modelUsed = string.IsNullOrWhiteSpace(result.ModelUsed)
                    ? MessagesClient.PrimaryModel
                    : result.ModelUsed;
                return (modelUsed, result.RawText.Trim());
            }

            logger?.LogInformation(
                "Claude Standby dispatch reasoning fell back to deterministic scorer (Model={Model}, HttpStatus={StatusCode}, ErrorCode={ErrorCode}).",
                result.ModelUsed,
                result.HttpStatusCode,
                result.ErrorCode ?? "NONE");
        }
        catch (Exception ex)
        {
            logger?.LogInformation("Claude Standby dispatch reasoning fallback activated ({Message}).", ex.Message);
        }

        return (FallbackProviderName, deterministicSummary);
    }

    private static string BuildCandidateSelectionReason(
        string unitCode,
        double distanceKm,
        int historicalCount,
        bool neverChosen,
        double proximityScore,
        double fairnessScore,
        double workloadScore,
        double compositeScore) =>
        neverChosen
            ? $"{unitCode} prioritized with Unchosen Unit Rotation Boost (100.0 fairness, 0 prior dispatches) at {distanceKm:F2} km (Proximity={proximityScore:F1}, Workload={workloadScore:F1}, Composite={compositeScore:F2})."
            : $"{unitCode} evaluated with {historicalCount} prior dispatch(es) (Fairness={fairnessScore:F1}) at {distanceKm:F2} km (Proximity={proximityScore:F1}, Workload={workloadScore:F1}, Composite={compositeScore:F2}).";
}
