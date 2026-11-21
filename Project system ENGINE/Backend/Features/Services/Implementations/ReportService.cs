// [Layer: Backend/Services/Implementations]
// Responsibility: Implements incident report ingestion, validation, agency routing, and image retrieval using Universal Lambdas (=>).
// Zero emojis.

using System.Text.Json;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.IncidentVision;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class ReportService(
    IReportRepository reportRepo,
    IUserRepository userRepo,
    IAuditLogRepository auditRepo,
    IIncidentSceneAiAnalysisStrategy? incidentVisionStrategy = null) : IReportService
{
    private readonly IIncidentSceneAiAnalysisStrategy _incidentVisionStrategy =
        incidentVisionStrategy ?? new DualStageIncidentSceneAiStrategy();

    public Task<IncidentImageAiAnalysisResponseDto> AnalyzeIncidentImageAsync(
        AnalyzeIncidentImageRequest request,
        CancellationToken ct = default) =>
        _incidentVisionStrategy.AnalyzeAsync(request, ct);

    public async Task<ReportResponse> CreateReportAsync(Guid reporterId, CreateReportRequest request, string reportsRootPath, CancellationToken ct = default, string? submittedIpAddress = null)
    {
        var reporter = await userRepo.GetByIdAsync(reporterId, ct);
        string? imagePath = await CaptureStorageHelper.SavePngDataUrlAsync(request.ImageDataUrl, reportsRootPath, "REPORT", ct);

        IncidentCategory safeCategory = Enum.IsDefined(request.Category) ? request.Category : IncidentCategory.VehicularAccident;
        IncidentSeverity safeSeverity = Enum.IsDefined(request.Severity) ? request.Severity : IncidentSeverity.Medium;

        IncidentImageAiAnalysisResponseDto? aiAnalysis = null;
        bool hasPreAnalyzedFields =
            !string.IsNullOrWhiteSpace(request.RoboflowPrediction) ||
            !string.IsNullOrWhiteSpace(request.ClaudeSituationSummary) ||
            !string.IsNullOrWhiteSpace(request.PointerIconType);

        if (!string.IsNullOrWhiteSpace(request.ImageDataUrl) && !hasPreAnalyzedFields)
        {
            aiAnalysis = await _incidentVisionStrategy.AnalyzeAsync(
                new AnalyzeIncidentImageRequest(
                    ImageDataUrl: request.ImageDataUrl,
                    TitleHint: request.Title,
                    NoteHint: request.Note,
                    CategoryHint: safeCategory.ToString()),
                ct);
        }

        string roboflowModelId = aiAnalysis?.RoboflowModelId ?? RoboflowServerlessAccidentDetectionStrategy.DefaultModelId;
        string? roboflowPrediction = SanitizeOptionalField(request.RoboflowPrediction ?? aiAnalysis?.RoboflowPrediction, 64);
        double? roboflowConfidence = request.RoboflowConfidence ?? aiAnalysis?.RoboflowConfidence;
        bool roboflowNeedsReview = request.RoboflowNeedsReview ?? aiAnalysis?.RoboflowNeedsReview ?? true;
        string? claudeModelUsed = SanitizeOptionalField(request.ClaudeModelUsed ?? aiAnalysis?.ClaudeModelUsed, 64);
        string? claudeIncidentCategory = SanitizeOptionalField(request.ClaudeIncidentCategory ?? aiAnalysis?.DetectedCategory ?? safeCategory.ToString(), 64);
        string? claudeSituationSummary = SanitizeOptionalField(request.ClaudeSituationSummary ?? aiAnalysis?.SituationDescription, 1000);
        string? claudeVisibleHazards = SanitizeOptionalField(request.ClaudeVisibleHazards ?? aiAnalysis?.VisibleHazards, 600);
        string? claudeUncertaintyNotes = SanitizeOptionalField(request.ClaudeUncertaintyNotes ?? aiAnalysis?.UncertaintyNotes, 600);
        string pointerIconType = SanitizeOptionalField(
            request.PointerIconType
            ?? aiAnalysis?.PointerIconType
            ?? ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon(claudeIncidentCategory ?? safeCategory.ToString()),
            40) ?? ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon(safeCategory.ToString());

        string? aiAnalysisJson = (aiAnalysis is not null || hasPreAnalyzedFields)
            ? JsonSerializer.Serialize(new
            {
                roboflowModelId,
                roboflowPrediction,
                roboflowConfidence,
                roboflowNeedsReview,
                claudeModelUsed,
                claudeIncidentCategory,
                claudeSituationSummary,
                claudeVisibleHazards,
                claudeUncertaintyNotes,
                pointerIconType,
                verificationStatus = "PENDING_REVIEW"
            })
            : null;

        string refCode = $"RESQ-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}"[..18].ToUpperInvariant();
        string recommendedAgency = DetermineRecommendedAgency(safeCategory, safeSeverity, request.Title, request.Note);

        string? sanitizedIp = SanitizeOptionalField(submittedIpAddress, 64);
        string? sanitizedContact = SanitizeOptionalField(request.ReporterContactNumber, 40);

        var report = new Report
        {
            ReferenceCode = refCode,
            ReporterId = reporterId,
            ReporterName = reporter?.FullName ?? "Anonymous Resident",
            ReporterRole = reporter?.Role ?? UserRole.Civilian,
            SubmittedIpAddress = sanitizedIp,
            ReporterContactNumber = sanitizedContact,
            Title = InputSanitizer.Sanitize(request.Title),
            Note = InputSanitizer.Sanitize(request.Note),
            Category = safeCategory,
            Severity = safeSeverity,
            Status = ReportStatus.Reported,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            GpsAccuracyMeters = request.GpsAccuracyMeters,
            IsHardwareGeolocated = request.IsHardwareGeolocated ?? false,
            IsBlurry = request.IsBlurry ?? false,
            RequiresManualVerification = true,
            RecommendedAgencyUnit = recommendedAgency,
            LocationLabel = InputSanitizer.Sanitize(request.LocationLabel),
            ImageCapturePath = imagePath,
            CreatedAt = DateTime.UtcNow,
            VerifiedAt = null,
            RoboflowModelId = roboflowModelId,
            RoboflowPrediction = roboflowPrediction,
            RoboflowConfidence = roboflowConfidence,
            RoboflowNeedsReview = roboflowNeedsReview,
            ClaudeModelUsed = claudeModelUsed,
            ClaudeIncidentCategory = claudeIncidentCategory,
            ClaudeSituationSummary = claudeSituationSummary,
            ClaudeVisibleHazards = claudeVisibleHazards,
            ClaudeUncertaintyNotes = claudeUncertaintyNotes,
            PointerIconType = pointerIconType,
            AiAnalysisJson = aiAnalysisJson
        };

        await reportRepo.AddAsync(report, ct);

        // Audit Log
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        const string action = "REPORT_CREATED";
        string payload = $"Report: {refCode}, Cat: {report.Category}, Sev: {report.Severity}, Loc: {report.Latitude:F4},{report.Longitude:F4}, Blurry: {report.IsBlurry}, RecAgency: {recommendedAgency}, IP: {sanitizedIp ?? "unknown"}";
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, reporterId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = reporterId,
            Action = action,
            TargetEntity = nameof(Report),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);

        return MapToResponse(report);
    }

    public async Task<List<ReportResponse>> GetAllReportsAsync(CancellationToken ct = default) =>
        (await reportRepo.GetAllAsync(ct)).Select(MapToResponse).ToList();

    public async Task<List<ReportResponse>> GetMyReportsAsync(Guid userId, CancellationToken ct = default) =>
        (await reportRepo.GetByReporterIdAsync(userId, ct)).Select(MapToResponse).ToList();

    public async Task<List<ReportResponse>> GetAgencyReportsAsync(ResponderUnitType agency, CancellationToken ct = default) =>
        (await reportRepo.GetByUnitAgencyAsync(agency, ct)).Select(MapToResponse).ToList();

    public async Task<string?> GetReportImagePathAsync(Guid reportId, CancellationToken ct = default) =>
        (await reportRepo.GetByIdAsync(reportId, ct))?.ImageCapturePath;

    public async Task<bool> RecordDistressBeaconAsync(Guid reportId, DistressBeaconRequest beacon, CancellationToken ct = default)
    {
        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report == null) return false;

        report.CurrentLatitude = beacon.Latitude;
        report.CurrentLongitude = beacon.Longitude;
        report.Latitude = beacon.Latitude;
        report.Longitude = beacon.Longitude;
        report.LastBeaconAt = DateTime.UtcNow;
        report.BeaconCount++;
        if (beacon.GpsAccuracyMeters.HasValue)
        {
            report.GpsAccuracyMeters = beacon.GpsAccuracyMeters.Value;
        }

        await reportRepo.UpdateAsync(report, ct);
        return true;
    }

    public async Task<Guid> ResolveReporterIdAsync(Guid? currentUserId, CancellationToken ct = default) =>
        currentUserId.HasValue && currentUserId.Value != Guid.Empty
            ? currentUserId.Value
            : (await userRepo.GetByEmailAsync("resident.juan@resqtrack.gov.ph", ct))?.Id
              ?? (await userRepo.SearchUsersAsync(null, UserRole.Civilian, null, null, 1, 1, ct)).FirstOrDefault()?.Id
              ?? (await userRepo.GetAllAsync(ct)).FirstOrDefault()?.Id
              ?? Guid.NewGuid();

    private static string DetermineRecommendedAgency(IncidentCategory category, IncidentSeverity severity, string title, string? note)
    {
        string text = $"{title} {note}".ToLowerInvariant();
        if (category == IncidentCategory.StructuralFire || text.Contains("fire") || text.Contains("smoke") || text.Contains("hazmat") || text.Contains("explosion") || text.Contains("gas"))
            return "FIRE (BFP)";
        if (category == IncidentCategory.MedicalEmergency || text.Contains("medical") || text.Contains("injury") || text.Contains("unconscious") || text.Contains("casualty") || text.Contains("bleeding"))
            return "RHU (Medical)";
        if (category == IncidentCategory.VehicularAccident || text.Contains("collision") || text.Contains("crash") || text.Contains("vehicle") || text.Contains("motorcycle"))
        {
            if (severity == IncidentSeverity.Critical || text.Contains("trapped") || text.Contains("fatal") || text.Contains("multiple"))
                return "Joint Dispatch: RHU + FIRE + PNP";
            return "PNP (Police Traffic)";
        }
        if (category == IncidentCategory.CrimeOrSecurity || text.Contains("fight") || text.Contains("assault") || text.Contains("robbery"))
            return "PNP (Police Sector)";

        return "LDRRMO Command Triage";
    }

    private static string? SanitizeOptionalField(string? value, int maxLength) =>
        InputSanitizer.Sanitize(value) is var sanitized && !string.IsNullOrWhiteSpace(sanitized)
            ? (sanitized.Length > maxLength ? sanitized[..maxLength] : sanitized)
            : null;

    private static ReportResponse MapToResponse(Report r) =>
        new(
            r.Id,
            r.ReferenceCode,
            r.ReporterId,
            r.ReporterName,
            r.ReporterRole,
            r.Title,
            r.Note,
            Enum.IsDefined(r.Category) ? r.Category : IncidentCategory.VehicularAccident,
            Enum.IsDefined(r.Severity) ? r.Severity : IncidentSeverity.Medium,
            Enum.IsDefined(r.Status) ? r.Status : ReportStatus.Reported,
            r.Latitude,
            r.Longitude,
            r.LocationLabel,
            !string.IsNullOrWhiteSpace(r.ImageCapturePath),
            !string.IsNullOrWhiteSpace(r.ImageCapturePath) ? $"/api/reports/{r.Id}/image" : null,
            r.AllocatedUnitId,
            r.AllocatedUnitCode,
            r.CreatedAt,
            r.VerifiedAt,
            r.ResolvedAt,
            r.GpsAccuracyMeters,
            r.IsHardwareGeolocated,
            r.IsBlurry,
            r.RequiresManualVerification,
            r.RecommendedAgencyUnit,
            r.CurrentLatitude ?? r.Latitude,
            r.CurrentLongitude ?? r.Longitude,
            r.LastBeaconAt,
            r.BeaconCount,
            r.SubmittedIpAddress,
            r.ReporterContactNumber,
            r.RoboflowModelId,
            r.RoboflowPrediction,
            r.RoboflowConfidence,
            r.RoboflowNeedsReview,
            r.ClaudeModelUsed,
            r.ClaudeIncidentCategory,
            r.ClaudeSituationSummary,
            r.ClaudeVisibleHazards,
            r.ClaudeUncertaintyNotes,
            r.PointerIconType ?? ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon(
                (Enum.IsDefined(r.Category) ? r.Category : IncidentCategory.VehicularAccident).ToString())
        );
}
