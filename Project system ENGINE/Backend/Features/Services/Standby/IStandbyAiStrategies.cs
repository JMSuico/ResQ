// [Layer: Backend/Services/Standby]
// Responsibility: Defines Strategy Pattern contracts and DTOs for Standby AI Government ID Auto-Approval and Multi-Objective Responder Auto-Dispatch.
// Open/Closed Principle (OCP), Universal Lambda Expressions (=>), Zero Emojis.

global using ResQTrack.Backend.Features.Services.Standby;
global using ApplicationDbContext = Backend.Features.Data.AppDbContext;

namespace ResQTrack.Backend.Features.Services.Standby
{
    public record StandbyGovIdApprovalRequest(
        Guid UserId = default,
        string? GovernmentIdType = null,
        string? FrontIdImageUrl = null,
        string? BackIdImageUrl = null,
        string? FirstName = null,
        string? LastName = null,
        string? DateOfBirth = null,
        bool ApplyToDatabase = true);

    public record StandbyGovIdApprovalResult(
        bool Approved,
        string DecisionStatus,
        string StrategyName,
        string ProviderUsed,
        double ConfidenceScore,
        string Reasoning,
        Guid UserId,
        DateTime EvaluatedAtUtc);

    public record StandbyAutoDispatchRequest(
        int IncidentId = 0,
        double IncidentLat = 8.5136,
        double IncidentLng = 123.2856,
        string? IncidentType = null,
        string? Severity = null,
        string? RequiredAgencyType = null,
        bool ApplyDispatch = false);

    public record StandbyCandidateScoreDto(
        int ResponderUnitId,
        string UnitCode,
        string UnitName,
        string AgencyType,
        double DistanceKm,
        int HistoricalDispatchCount,
        bool NeverChosenBefore,
        double ProximityScore,
        double FairnessRotationScore,
        double WorkloadScore,
        double CompositeScore,
        string SelectionReason);

    public record StandbyAutoDispatchResult(
        bool Success,
        string StrategyName,
        string ProviderUsed,
        int IncidentId,
        StandbyCandidateScoreDto? SelectedUnit,
        IReadOnlyList<StandbyCandidateScoreDto> RankedCandidates,
        string TacticalAiReasoning,
        DateTime EvaluatedAtUtc);

    public interface IStandbyGovIdAutoApproveStrategy
    {
        string StrategyKey { get; }

        Task<StandbyGovIdApprovalResult> EvaluateAndApproveAsync(
            StandbyGovIdApprovalRequest request,
            CancellationToken ct = default);
    }

    public interface IStandbyResponderAutoDispatchStrategy
    {
        string StrategyKey { get; }

        Task<StandbyAutoDispatchResult> SelectAndDispatchOptimalUnitAsync(
            StandbyAutoDispatchRequest request,
            CancellationToken ct = default);
    }
}

namespace Backend.Features.Services.Standby
{
    // Namespace compatibility bridge so both Backend.Features.Services.Standby and ResQTrack.Backend.Features.Services.Standby resolve cleanly.
}
