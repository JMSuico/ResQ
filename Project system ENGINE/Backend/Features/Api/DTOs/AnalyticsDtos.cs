// [Layer: Backend/Api/DTOs]
// Responsibility: Encapsulates outgoing JSON response contracts for dynamic database-driven analytics and telemetry.
// DO NOT hardcode mock telemetry numbers into response payloads.

namespace Backend.Features.Api.DTOs;

public record AnalyticsSummaryResponse(
    int TotalIncidents,
    int ActiveDispatches,
    int CriticalIncidents,
    int ResolvedCount,
    int TotalResponders,
    int OnDutyResponders,
    int RegisteredCivilians
);

public record TelemetryDataPoint(
    string Label,
    int Value
);

public record SeverityBreakdownItem(
    string Label,
    int Value,
    string Color
);

public record AgencyWorkloadItem(
    string Label,
    int Value,
    string Color,
    double Percentage
);

public record HeatmapMatrixResponse(
    List<string> Days,
    List<string> Hours,
    int[][] Matrix
);
