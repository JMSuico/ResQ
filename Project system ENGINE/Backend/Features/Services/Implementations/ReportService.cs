// [Layer: Backend/Services/Implementations]
// Responsibility: Implements incident report ingestion, validation, agency routing, and image retrieval using Universal Lambdas (=>).
// Zero emojis.

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Backend.Features.Api.DTOs;
using Backend.Features.Data;
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
    IIncidentSceneAiAnalysisStrategy? incidentVisionStrategy = null,
    IIncidentAutoApprovalStrategy? incidentAutoApprovalStrategy = null,
    AppDbContext? db = null,
    IIncidentClosureAiStrategy? closureAiStrategy = null) : IReportService
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

        List<TaggedColleagueDto> taggedColleagues = [];
        if (request.TaggedColleagueIds is { Count: > 0 })
        {
            var (colleaguesOk, colleaguesError, resolved) = await ValidateAndResolveTaggedColleaguesAsync(
                request.TaggedColleagueIds,
                reporter?.Role ?? UserRole.Civilian,
                reporter?.Unit ?? ResponderUnitType.None,
                expectedUnit: null,
                ct);
            if (!colleaguesOk)
                throw new UnauthorizedAccessException(colleaguesError ?? "Colleague tagging is strictly restricted to active same-unit responders.");

            taggedColleagues = resolved;
        }

        string? imagePath = await CaptureStorageHelper.SavePngDataUrlAsync(request.ImageDataUrl, reportsRootPath, "REPORT", ct);

        IncidentCategory safeCategory = Enum.IsDefined(request.Category) ? request.Category : IncidentCategory.VehicularAccident;
        IncidentSeverity safeSeverity = Enum.IsDefined(request.Severity) ? request.Severity : IncidentSeverity.Medium;

        IncidentImageAiAnalysisResponseDto? aiAnalysis = null;
        bool hasPreAnalyzedFields =
            !string.IsNullOrWhiteSpace(request.RoboflowPrediction) ||
            !string.IsNullOrWhiteSpace(request.ClaudeSituationSummary) ||
            !string.IsNullOrWhiteSpace(request.PointerIconType);

        if (!string.IsNullOrWhiteSpace(request.ImageDataUrl) &&
            (!hasPreAnalyzedFields || incidentAutoApprovalStrategy is not null))
        {
            aiAnalysis = await _incidentVisionStrategy.AnalyzeAsync(
                new AnalyzeIncidentImageRequest(
                    ImageDataUrl: request.ImageDataUrl,
                    TitleHint: request.Title,
                    NoteHint: request.Note,
                    CategoryHint: safeCategory.ToString()),
                ct);
        }

        bool preferServerAnalysis = incidentAutoApprovalStrategy is not null && aiAnalysis is not null;

        string roboflowModelId = aiAnalysis?.RoboflowModelId ?? RoboflowServerlessAccidentDetectionStrategy.DefaultModelId;
        string? roboflowPrediction = SanitizeOptionalField(
            preferServerAnalysis
                ? aiAnalysis!.RoboflowPrediction
                : (request.RoboflowPrediction ?? aiAnalysis?.RoboflowPrediction),
            64);
        double? roboflowConfidence = preferServerAnalysis
            ? aiAnalysis!.RoboflowConfidence
            : (request.RoboflowConfidence ?? aiAnalysis?.RoboflowConfidence);
        bool roboflowNeedsReview = preferServerAnalysis
            ? aiAnalysis!.RoboflowNeedsReview
            : (request.RoboflowNeedsReview ?? aiAnalysis?.RoboflowNeedsReview ?? true);
        string? claudeModelUsed = SanitizeOptionalField(
            preferServerAnalysis
                ? aiAnalysis!.ClaudeModelUsed
                : (request.ClaudeModelUsed ?? aiAnalysis?.ClaudeModelUsed),
            64);
        string? claudeIncidentCategory = SanitizeOptionalField(
            preferServerAnalysis
                ? aiAnalysis!.DetectedCategory
                : (request.ClaudeIncidentCategory ?? aiAnalysis?.DetectedCategory ?? safeCategory.ToString()),
            64);
        string? claudeSituationSummary = SanitizeOptionalField(
            preferServerAnalysis
                ? aiAnalysis!.SituationDescription
                : (request.ClaudeSituationSummary ?? aiAnalysis?.SituationDescription),
            1000);
        string? claudeVisibleHazards = SanitizeOptionalField(
            preferServerAnalysis
                ? aiAnalysis!.VisibleHazards
                : (request.ClaudeVisibleHazards ?? aiAnalysis?.VisibleHazards),
            600);
        string? claudeUncertaintyNotes = SanitizeOptionalField(
            preferServerAnalysis
                ? aiAnalysis!.UncertaintyNotes
                : (request.ClaudeUncertaintyNotes ?? aiAnalysis?.UncertaintyNotes),
            600);
        string pointerIconType = SanitizeOptionalField(
            preferServerAnalysis
                ? aiAnalysis!.PointerIconType
                : (request.PointerIconType
                   ?? aiAnalysis?.PointerIconType
                   ?? ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon(claudeIncidentCategory ?? safeCategory.ToString())),
            40) ?? ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon(safeCategory.ToString());

        IncidentAutoApprovalDecision? autoDecision = incidentAutoApprovalStrategy is not null && !string.IsNullOrWhiteSpace(imagePath)
            ? incidentAutoApprovalStrategy.Evaluate(new IncidentAutoApprovalContext(
                HasImage: true,
                IsBlurry: request.IsBlurry ?? false,
                IsGenuineIncident: aiAnalysis?.IsGenuineIncident ?? false,
                DetectedCategory: claudeIncidentCategory,
                RoboflowAuthTransport: aiAnalysis?.RoboflowAuthTransport,
                RoboflowPrediction: roboflowPrediction,
                RoboflowConfidence: roboflowConfidence,
                RoboflowNeedsReview: roboflowNeedsReview,
                ClaudeRanOnline: aiAnalysis?.ClaudeRanOnline ?? false,
                ClaudeModelUsed: claudeModelUsed,
                ClaudeSituationSummary: claudeSituationSummary,
                ClaudeUncertaintyNotes: claudeUncertaintyNotes))
            : null;

        bool aiAutoApproved = autoDecision?.AutoApproved ?? false;
        string aiVerificationStatus = autoDecision?.AiVerificationStatus ?? "AWAITING_MANUAL_REVIEW";

        string? aiAnalysisJson = (aiAnalysis is not null || hasPreAnalyzedFields || autoDecision is not null)
            ? SerializeAiAnalysisJson(
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
                aiVerificationStatus,
                aiAutoApproved)
            : null;

        string refCode = $"RESQ-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}"[..18].ToUpperInvariant();
        string recommendedAgency = DetermineRecommendedAgency(safeCategory, safeSeverity, request.Title, request.Note);

        string? sanitizedIp = SanitizeOptionalField(submittedIpAddress, 64);
        string? sanitizedContact = SanitizeOptionalField(request.ReporterContactNumber, 40);

        DateTime createdUtc = DateTime.UtcNow;
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
            Status = aiAutoApproved ? ReportStatus.Verified : ReportStatus.Reported,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            GpsAccuracyMeters = request.GpsAccuracyMeters,
            IsHardwareGeolocated = request.IsHardwareGeolocated ?? false,
            IsBlurry = request.IsBlurry ?? false,
            RequiresManualVerification = !aiAutoApproved,
            RecommendedAgencyUnit = recommendedAgency,
            LocationLabel = InputSanitizer.Sanitize(request.LocationLabel),
            ImageCapturePath = imagePath,
            CreatedAt = createdUtc,
            VerifiedAt = aiAutoApproved ? createdUtc : null,
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
            AiAnalysisJson = aiAnalysisJson,
            TaggedColleaguesJson = taggedColleagues.Count > 0 ? JsonSerializer.Serialize(taggedColleagues) : null
        };

        await reportRepo.AddAsync(report, ct);

        await AppendAuditLogAsync(
            reporterId,
            "REPORT_CREATED",
            $"Report: {refCode}, Cat: {report.Category}, Sev: {report.Severity}, Loc: {report.Latitude:F4},{report.Longitude:F4}, Blurry: {report.IsBlurry}, RecAgency: {recommendedAgency}, IP: {sanitizedIp ?? "unknown"}",
            ct);

        if (aiAutoApproved)
        {
            await AppendAuditLogAsync(
                reporterId,
                "REPORT_AI_AUTO_APPROVED",
                $"Report: {refCode}, Status: Verified, Category: {claudeIncidentCategory}, Reason: {autoDecision!.Reason}",
                ct);
        }

        return MapToResponse(report);
    }

    public async Task<AiAutoApproveReportResult> AutoApprovePendingReportWithAiAsync(
        Guid reportId,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report is null)
        {
            return new AiAutoApproveReportResult(
                AutoApproved: false,
                Status: ReportStatus.Reported,
                AiVerificationStatus: "NOT_FOUND",
                Message: "Report not found.",
                Report: null,
                NotFound: true);
        }

        if (report.Status != ReportStatus.Reported)
        {
            var (existingApproved, existingStatus) = ExtractAiApprovalMetadata(report);
            return new AiAutoApproveReportResult(
                AutoApproved: existingApproved || report.Status == ReportStatus.Verified,
                Status: report.Status,
                AiVerificationStatus: existingStatus,
                Message: $"Report {report.ReferenceCode} is already in {report.Status} status.",
                Report: MapToResponse(report));
        }

        if (string.IsNullOrWhiteSpace(report.ImageCapturePath) ||
            !CaptureStorageHelper.IsPathWithinAllowedRoots(report.ImageCapturePath) ||
            !File.Exists(report.ImageCapturePath))
        {
            return new AiAutoApproveReportResult(
                AutoApproved: false,
                Status: report.Status,
                AiVerificationStatus: ClaudeIncidentAutoApprovalStrategy.StatusPendingManualReview,
                Message: "Stored incident image capture is unavailable; manual verification required.",
                Report: MapToResponse(report));
        }

        var (bytes, contentType) = await CaptureStorageHelper.ReadCaptureFileAsync(report.ImageCapturePath, ct);
        if (bytes.Length == 0)
        {
            return new AiAutoApproveReportResult(
                AutoApproved: false,
                Status: report.Status,
                AiVerificationStatus: ClaudeIncidentAutoApprovalStrategy.StatusPendingManualReview,
                Message: "Stored incident image capture could not be decoded; manual verification required.",
                Report: MapToResponse(report));
        }

        string dataUrl = $"data:{contentType};base64,{Convert.ToBase64String(bytes)}";
        IncidentImageAiAnalysisResponseDto analysis = await _incidentVisionStrategy.AnalyzeAsync(
            new AnalyzeIncidentImageRequest(
                ImageDataUrl: dataUrl,
                TitleHint: report.Title,
                NoteHint: report.Note,
                CategoryHint: report.Category.ToString()),
            ct);

        var approvalStrategy = incidentAutoApprovalStrategy ?? new ClaudeIncidentAutoApprovalStrategy();
        IncidentAutoApprovalDecision decision = approvalStrategy.Evaluate(new IncidentAutoApprovalContext(
            HasImage: true,
            IsBlurry: report.IsBlurry,
            IsGenuineIncident: analysis.IsGenuineIncident,
            DetectedCategory: analysis.DetectedCategory,
            RoboflowAuthTransport: analysis.RoboflowAuthTransport,
            RoboflowPrediction: analysis.RoboflowPrediction,
            RoboflowConfidence: analysis.RoboflowConfidence,
            RoboflowNeedsReview: analysis.RoboflowNeedsReview,
            ClaudeRanOnline: analysis.ClaudeRanOnline,
            ClaudeModelUsed: analysis.ClaudeModelUsed,
            ClaudeSituationSummary: analysis.SituationDescription,
            ClaudeUncertaintyNotes: analysis.UncertaintyNotes));

        report.RoboflowModelId = analysis.RoboflowModelId;
        report.RoboflowPrediction = SanitizeOptionalField(analysis.RoboflowPrediction, 64);
        report.RoboflowConfidence = analysis.RoboflowConfidence;
        report.RoboflowNeedsReview = analysis.RoboflowNeedsReview;
        report.ClaudeModelUsed = SanitizeOptionalField(analysis.ClaudeModelUsed, 64);
        report.ClaudeIncidentCategory = SanitizeOptionalField(analysis.DetectedCategory, 64);
        report.ClaudeSituationSummary = SanitizeOptionalField(analysis.SituationDescription, 1000);
        report.ClaudeVisibleHazards = SanitizeOptionalField(analysis.VisibleHazards, 600);
        report.ClaudeUncertaintyNotes = SanitizeOptionalField(analysis.UncertaintyNotes, 600);
        report.PointerIconType = SanitizeOptionalField(analysis.PointerIconType, 40)
                                 ?? ClaudeHaikuIncidentVisionStrategy.MapCategoryToPointerIcon(analysis.DetectedCategory);

        if (decision.AutoApproved)
        {
            report.Status = ReportStatus.Verified;
            report.VerifiedAt = DateTime.UtcNow;
            report.RequiresManualVerification = false;
        }
        else
        {
            report.RequiresManualVerification = true;
        }

        report.AiAnalysisJson = SerializeAiAnalysisJson(
            report.RoboflowModelId,
            report.RoboflowPrediction,
            report.RoboflowConfidence,
            report.RoboflowNeedsReview,
            report.ClaudeModelUsed,
            report.ClaudeIncidentCategory,
            report.ClaudeSituationSummary,
            report.ClaudeVisibleHazards,
            report.ClaudeUncertaintyNotes,
            report.PointerIconType,
            decision.AiVerificationStatus,
            decision.AutoApproved);

        await reportRepo.UpdateAsync(report, ct);

        await AppendAuditLogAsync(
            actorUserId,
            decision.AutoApproved ? "REPORT_AI_AUTO_APPROVED" : "REPORT_AI_MANUAL_REVIEW_REQUIRED",
            $"Report: {report.ReferenceCode}, AutoApproved: {decision.AutoApproved}, Status: {decision.AiVerificationStatus}, Reason: {decision.Reason}",
            ct);

        return new AiAutoApproveReportResult(
            AutoApproved: decision.AutoApproved,
            Status: report.Status,
            AiVerificationStatus: decision.AiVerificationStatus,
            Message: decision.Reason,
            Report: MapToResponse(report));
    }

    public async Task<List<ReportResponse>> GetAllReportsAsync(CancellationToken ct = default) =>
        await MapReportsWithFeedbackAsync(await reportRepo.GetAllAsync(ct), ct);

    public async Task<List<ReportResponse>> GetMyReportsAsync(Guid userId, CancellationToken ct = default) =>
        await MapReportsWithFeedbackAsync(await reportRepo.GetByReporterIdAsync(userId, ct), ct);

    public async Task<List<ReportResponse>> GetAgencyReportsAsync(ResponderUnitType agency, CancellationToken ct = default) =>
        await MapReportsWithFeedbackAsync(await reportRepo.GetByUnitAgencyAsync(agency, ct), ct);

    public async Task<string?> GetReportImagePathAsync(Guid reportId, CancellationToken ct = default) =>
        (await reportRepo.GetByIdAsync(reportId, ct))?.ImageCapturePath;

    public async Task<List<ReportEvidenceResponse>> GetReportEvidencesAsync(Guid reportId, CancellationToken ct = default) =>
        db is null
            ? []
            : (await db.ReportEvidences
                .AsNoTracking()
                .Where(e => e.ReportId == reportId)
                .OrderByDescending(e => e.CreatedAtUtc)
                .ToListAsync(ct))
                .Select(MapToEvidenceResponse)
                .ToList();

    public async Task<(bool Success, bool NotFound, string? Error, ReportEvidenceResponse? Evidence)> AddReportEvidenceAsync(
        Guid reportId,
        CreateReportEvidenceRequest request,
        Guid? uploaderId,
        string? uploaderName,
        string reportsRootPath,
        CancellationToken ct = default)
    {
        if (db is null)
            return (false, false, "Evidence database context unavailable.", null);

        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report is null)
            return (false, true, "Report not found.", null);

        string? rawDataUrl = !string.IsNullOrWhiteSpace(request.ImageDataUrl) ? request.ImageDataUrl : request.DataUrl;
        string? savedPath = await CaptureStorageHelper.SaveCaptureDataUrlAsync(rawDataUrl, reportsRootPath, $"EVIDENCE_{reportId:N}", ct);
        if (string.IsNullOrWhiteSpace(savedPath))
            return (false, false, "Invalid or unsupported evidence image payload. Only PNG, JPEG, and WebP up to 5 MB are allowed.", null);

        string resolvedUploader = !string.IsNullOrWhiteSpace(uploaderName)
            ? InputSanitizer.Sanitize(uploaderName)
            : (uploaderId.HasValue && uploaderId.Value != Guid.Empty
                ? (await userRepo.GetByIdAsync(uploaderId.Value, ct))?.FullName ?? "Operational Responder"
                : "Operational Responder");

        var evidence = new ReportEvidenceRecord
        {
            ReportId = reportId,
            FilePath = savedPath,
            MediaType = SanitizeOptionalField(request.MediaType, 32) ?? "image",
            Caption = SanitizeOptionalField(request.Caption, 500) ?? string.Empty,
            UploadedByUserId = uploaderId.HasValue && uploaderId.Value != Guid.Empty ? uploaderId.Value : null,
            UploadedByName = resolvedUploader.Length > 150 ? resolvedUploader[..150] : resolvedUploader,
            CreatedAtUtc = DateTime.UtcNow
        };

        await db.ReportEvidences.AddAsync(evidence, ct);
        await db.SaveChangesAsync(ct);

        await AppendAuditLogAsync(
            uploaderId ?? Guid.Empty,
            "REPORT_EVIDENCE_ADDED",
            $"Report: {report.ReferenceCode}, EvidenceId: {evidence.Id}, UploadedBy: {evidence.UploadedByName}",
            ct);

        return (true, false, null, MapToEvidenceResponse(evidence));
    }

    public async Task<ReportEvidenceRecord?> GetReportEvidenceRecordAsync(Guid reportId, Guid evidenceId, CancellationToken ct = default) =>
        db is null
            ? null
            : await db.ReportEvidences.AsNoTracking().FirstOrDefaultAsync(e => e.ReportId == reportId && e.Id == evidenceId, ct);

    public async Task<List<ReportFeedbackResponse>> GetReportFeedbackAsync(Guid reportId, CancellationToken ct = default) =>
        db is null
            ? []
            : (await db.ReportFeedbacks
                .AsNoTracking()
                .Where(f => f.ReportId == reportId)
                .OrderByDescending(f => f.CreatedAtUtc)
                .ToListAsync(ct))
                .Select(MapToFeedbackResponse)
                .ToList();

    public async Task<(bool Success, bool NotFound, string? Error, ReportFeedbackResponse? Feedback)> SubmitReportFeedbackAsync(
        Guid reportId,
        Guid userId,
        SubmitReportFeedbackRequest request,
        CancellationToken ct = default)
    {
        if (db is null)
            return (false, false, "Feedback database context unavailable.", null);

        if (request.Rating < 1 || request.Rating > 5)
            return (false, false, "Feedback rating must be between 1 and 5.", null);

        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report is null)
            return (false, true, "Report not found.", null);

        string cleanComment = SanitizeOptionalField(request.Comment, 1000) ?? string.Empty;
        DateTime now = DateTime.UtcNow;

        ReportFeedbackRecord? existing = userId != Guid.Empty
            ? await db.ReportFeedbacks.FirstOrDefaultAsync(f => f.ReportId == reportId && f.UserId == userId, ct)
            : null;

        if (existing is not null)
        {
            existing.Rating = request.Rating;
            existing.Comment = cleanComment;
            existing.CreatedAtUtc = now;
        }
        else
        {
            existing = new ReportFeedbackRecord
            {
                ReportId = reportId,
                UserId = userId,
                Rating = request.Rating,
                Comment = cleanComment,
                CreatedAtUtc = now
            };
            await db.ReportFeedbacks.AddAsync(existing, ct);
        }

        await db.SaveChangesAsync(ct);

        await AppendAuditLogAsync(
            userId,
            "REPORT_FEEDBACK_SUBMITTED",
            $"Report: {report.ReferenceCode}, Rating: {existing.Rating}",
            ct);

        return (true, false, null, MapToFeedbackResponse(existing));
    }

    public async Task<(bool Success, bool NotFound, bool Forbidden, string? Error, ClosureEvidenceSubmissionResponse? Result)> SubmitClosureEvidenceAsync(
        Guid reportId,
        SubmitClosureEvidenceRequest request,
        Guid actorUserId,
        UserRole actorRole,
        ResponderUnitType actorUnit,
        string? actorName,
        string reportsRootPath,
        CancellationToken ct = default)
    {
        if (db is null)
            return (false, false, false, "Closure database context unavailable.", null);

        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report is null)
            return (false, true, false, "Report not found.", null);

        if (actorRole != UserRole.Responder && actorRole != UserRole.LDRRMO_Admin)
            return (false, false, true, "Only Responders and LDRRMO Administrators may submit closure evidence.", null);

        var (colleaguesOk, colleaguesError, taggedColleagues) = await ValidateAndResolveTaggedColleaguesAsync(
            request.TaggedColleagueIds,
            actorRole,
            actorUnit,
            report.AllocatedUnit?.Agency,
            ct);
        if (!colleaguesOk)
            return (false, false, true, colleaguesError ?? "Colleague tagging is strictly restricted to active same-unit responders.", null);

        string? savedPath = await CaptureStorageHelper.SaveCaptureDataUrlAsync(request.ImageDataUrl, reportsRootPath, $"CLOSURE_{reportId:N}", ct);
        if (string.IsNullOrWhiteSpace(savedPath))
            return (false, false, false, "Invalid or unsupported closure evidence image payload. Only PNG, JPEG, and WebP up to 5 MB are allowed.", null);

        string unitLabel = actorUnit != ResponderUnitType.None
            ? actorUnit.ToString()
            : report.AllocatedUnitCode ?? report.RecommendedAgencyUnit ?? "LDRRMO";

        IncidentClosureAiEvaluation eval = request.TriggerAiAutoApprove && closureAiStrategy is not null
            ? await closureAiStrategy.EvaluateClosureEvidenceAsync(
                new IncidentClosureAiInput(
                    ImageDataUrl: request.ImageDataUrl,
                    Notes: request.Notes,
                    RequestedOutcome: request.RequestedOutcome,
                    IncidentTitle: report.Title,
                    IncidentCategory: report.Category.ToString(),
                    ResponderUnit: unitLabel),
                ct)
            : new IncidentClosureAiEvaluation(
                Verdict: "ManualReviewRequired",
                EvidenceCategory: "FieldClosureEvidence",
                AutoApproved: false,
                Confidence: 0.0,
                Reasoning: "Manual command review requested.",
                ModelUsed: "manual-review",
                RanOnline: false);

        string resolvedUploader = !string.IsNullOrWhiteSpace(actorName)
            ? InputSanitizer.Sanitize(actorName)
            : (actorUserId != Guid.Empty
                ? (await userRepo.GetByIdAsync(actorUserId, ct))?.FullName ?? "Operational Responder"
                : "Operational Responder");

        DateTime now = DateTime.UtcNow;
        bool promotedToResolved = await ApplyClosureEvaluationToReportAsync(report, eval, actorUserId, request.Notes, taggedColleagues, now, ct);

        string colleagueIdsJson = JsonSerializer.Serialize(taggedColleagues.Select(c => c.UserId).ToList());
        string colleagueNamesJson = JsonSerializer.Serialize(taggedColleagues.Select(c => c.FullName).ToList());
        string safeOutcome = (eval.Verdict ?? "ManualReviewRequired").Length > 40 ? eval.Verdict![..40] : (eval.Verdict ?? "ManualReviewRequired");
        string safeReasoning = (eval.Reasoning ?? string.Empty).Length > 1000 ? eval.Reasoning![..1000] : (eval.Reasoning ?? string.Empty);

        var evidence = new ReportEvidenceRecord
        {
            ReportId = reportId,
            FilePath = savedPath,
            MediaType = "image",
            Caption = SanitizeOptionalField(request.Notes, 500) ?? string.Empty,
            UploadedByUserId = actorUserId != Guid.Empty ? actorUserId : null,
            UploadedByName = resolvedUploader.Length > 150 ? resolvedUploader[..150] : resolvedUploader,
            CreatedAtUtc = now,
            ClosureOutcome = safeOutcome,
            AiVerdict = safeOutcome,
            AiReasoning = safeReasoning,
            TaggedColleagueUserIdsJson = taggedColleagues.Count > 0 ? colleagueIdsJson : null,
            TaggedColleagueNamesJson = taggedColleagues.Count > 0 ? colleagueNamesJson : null,
            ApprovedByUserId = promotedToResolved && actorUserId != Guid.Empty ? actorUserId : null,
            ApprovedAtUtc = promotedToResolved ? now : null
        };

        await db.ReportEvidences.AddAsync(evidence, ct);
        await reportRepo.UpdateAsync(report, ct);

        await AppendAuditLogAsync(
            actorUserId,
            "REPORT_CLOSURE_EVIDENCE_SUBMITTED",
            $"Report: {report.ReferenceCode}, Verdict: {eval.Verdict}, AutoApproved: {eval.AutoApproved}, Mode: {report.ClosureApprovalMode}, Status: {report.Status}, Colleagues: {taggedColleagues.Count}",
            ct);

        string message = promotedToResolved
            ? "Closure evidence verified by AI; incident resolved."
            : string.Equals(eval.Verdict, "InProgress", StringComparison.OrdinalIgnoreCase)
                ? "Progress evidence verified; incident marked InProgress."
                : "Closure evidence recorded; awaiting manual LDRRMO approval.";

        return (true, false, false, null, new ClosureEvidenceSubmissionResponse(
            Success: true,
            Message: message,
            Verdict: eval.Verdict ?? "ManualReviewRequired",
            AutoApproved: eval.AutoApproved,
            ApprovalMode: report.ClosureApprovalMode ?? "AWAITING_MANUAL_APPROVE",
            ReportStatus: report.Status,
            AiReasoning: eval.Reasoning ?? string.Empty,
            ModelUsed: eval.ModelUsed ?? "unknown",
            Report: MapToResponse(report),
            Evidence: MapToEvidenceResponse(evidence)));
    }

    public async Task<(bool Success, bool NotFound, bool Forbidden, string? Error, ClosureEvidenceSubmissionResponse? Result)> ApproveClosureAsync(
        Guid reportId,
        ApproveClosureRequest request,
        Guid actorUserId,
        UserRole actorRole,
        string? actorName,
        CancellationToken ct = default)
    {
        if (db is null)
            return (false, false, false, "Closure database context unavailable.", null);

        var report = await reportRepo.GetByIdAsync(reportId, ct);
        if (report is null)
            return (false, true, false, "Report not found.", null);

        if (!request.UseAi && actorRole != UserRole.LDRRMO_Admin)
            return (false, false, true, "Only LDRRMO Administrators may manually approve incident closure.", null);

        if (request.UseAi && actorRole != UserRole.LDRRMO_Admin && actorRole != UserRole.Responder)
            return (false, false, true, "Only Responders and LDRRMO Administrators may trigger AI closure verification.", null);

        ReportEvidenceRecord? latestEvidence = await db.ReportEvidences
            .Where(e => e.ReportId == reportId)
            .OrderByDescending(e => e.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        DateTime now = DateTime.UtcNow;

        if (request.UseAi)
        {
            if (latestEvidence is null ||
                string.IsNullOrWhiteSpace(latestEvidence.FilePath) ||
                !CaptureStorageHelper.IsPathWithinAllowedRoots(latestEvidence.FilePath) ||
                !File.Exists(latestEvidence.FilePath))
            {
                return (false, false, false, "Photo evidence is required for AI closure verification.", null);
            }

            if (closureAiStrategy is null)
                return (false, false, false, "AI closure verification strategy is unavailable.", null);

            var (bytes, contentType) = await CaptureStorageHelper.ReadCaptureFileAsync(latestEvidence.FilePath, ct);
            if (bytes.Length == 0)
                return (false, false, false, "Photo evidence is required for AI closure verification.", null);

            string dataUrl = $"data:{contentType};base64,{Convert.ToBase64String(bytes)}";
            string unitLabel = report.AllocatedUnitCode ?? report.RecommendedAgencyUnit ?? "LDRRMO";

            IncidentClosureAiEvaluation eval = await closureAiStrategy.EvaluateClosureEvidenceAsync(
                new IncidentClosureAiInput(
                    ImageDataUrl: dataUrl,
                    Notes: request.AdminNote ?? latestEvidence.Caption,
                    RequestedOutcome: "Done",
                    IncidentTitle: report.Title,
                    IncidentCategory: report.Category.ToString(),
                    ResponderUnit: unitLabel),
                ct);

            bool promoted = await ApplyClosureEvaluationToReportAsync(report, eval, actorUserId, request.AdminNote, null, now, ct);

            string safeOutcome = (eval.Verdict ?? "ManualReviewRequired").Length > 40 ? eval.Verdict![..40] : (eval.Verdict ?? "ManualReviewRequired");
            string safeReasoning = (eval.Reasoning ?? string.Empty).Length > 1000 ? eval.Reasoning![..1000] : (eval.Reasoning ?? string.Empty);

            latestEvidence.ClosureOutcome = safeOutcome;
            latestEvidence.AiVerdict = safeOutcome;
            latestEvidence.AiReasoning = safeReasoning;
            if (promoted)
            {
                latestEvidence.ApprovedByUserId = actorUserId != Guid.Empty ? actorUserId : null;
                latestEvidence.ApprovedAtUtc = now;
            }

            await reportRepo.UpdateAsync(report, ct);

            await AppendAuditLogAsync(
                actorUserId,
                "REPORT_CLOSURE_AI_VERIFIED",
                $"Report: {report.ReferenceCode}, Verdict: {eval.Verdict}, AutoApproved: {eval.AutoApproved}, Status: {report.Status}",
                ct);

            return (true, false, false, null, new ClosureEvidenceSubmissionResponse(
                Success: true,
                Message: promoted
                    ? "Latest closure evidence verified by AI; incident resolved."
                    : string.Equals(eval.Verdict, "InProgress", StringComparison.OrdinalIgnoreCase)
                        ? "Latest evidence indicates ongoing work; incident marked InProgress."
                        : "AI could not auto-approve closure; manual LDRRMO approval required.",
                Verdict: eval.Verdict ?? "ManualReviewRequired",
                AutoApproved: eval.AutoApproved,
                ApprovalMode: report.ClosureApprovalMode ?? "AWAITING_MANUAL_APPROVE",
                ReportStatus: report.Status,
                AiReasoning: eval.Reasoning ?? string.Empty,
                ModelUsed: eval.ModelUsed ?? "unknown",
                Report: MapToResponse(report),
                Evidence: MapToEvidenceResponse(latestEvidence)));
        }

        ReportStatus targetStatus = request.TargetStatus is ReportStatus.Closed or ReportStatus.Resolved
            ? request.TargetStatus
            : ReportStatus.Resolved;

        report.Status = targetStatus;
        report.ResolvedAt ??= now;
        if (targetStatus == ReportStatus.Closed)
            report.ClosedAt ??= now;
        report.RequiresManualVerification = false;
        report.ClosureApprovalMode = "ADMIN_MANUAL_APPROVED_CLOSURE";
        if (!string.IsNullOrWhiteSpace(request.AdminNote))
            report.ClosureSummary = SanitizeOptionalField(request.AdminNote, 1000) ?? report.ClosureSummary;

        await ReleaseAllocatedUnitAsync(report, ct);

        if (latestEvidence is not null)
        {
            latestEvidence.ApprovedByUserId = actorUserId != Guid.Empty ? actorUserId : null;
            latestEvidence.ApprovedAtUtc = now;
            latestEvidence.ClosureOutcome = targetStatus.ToString();
            if (!string.IsNullOrWhiteSpace(request.AdminNote) && string.IsNullOrWhiteSpace(latestEvidence.AiReasoning))
                latestEvidence.AiReasoning = SanitizeOptionalField(request.AdminNote, 1000) ?? string.Empty;
        }

        await reportRepo.UpdateAsync(report, ct);

        await AppendAuditLogAsync(
            actorUserId,
            "REPORT_CLOSURE_MANUAL_APPROVED",
            $"Report: {report.ReferenceCode}, TargetStatus: {targetStatus}, AdminId: {actorUserId}, Note: {SanitizeOptionalField(request.AdminNote, 200)}",
            ct);

        ReportEvidenceResponse evidenceResponse = latestEvidence is not null
            ? MapToEvidenceResponse(latestEvidence)
            : new ReportEvidenceResponse(
                Guid.Empty,
                report.Id,
                string.Empty,
                "note",
                report.ClosureSummary ?? string.Empty,
                !string.IsNullOrWhiteSpace(actorName) ? InputSanitizer.Sanitize(actorName) : "LDRRMO Administrator",
                now,
                targetStatus.ToString(),
                "ManualApproval",
                report.ClosureSummary ?? "Manually approved by LDRRMO Administrator.",
                DeserializeTaggedColleagues(report.TaggedColleaguesJson),
                actorUserId != Guid.Empty ? actorUserId : null,
                now);

        return (true, false, false, null, new ClosureEvidenceSubmissionResponse(
            Success: true,
            Message: $"Incident manually approved as {targetStatus}.",
            Verdict: "ManualApproved",
            AutoApproved: false,
            ApprovalMode: "ADMIN_MANUAL_APPROVED_CLOSURE",
            ReportStatus: report.Status,
            AiReasoning: report.ClosureSummary ?? "Manually approved by LDRRMO Administrator.",
            ModelUsed: "manual-admin-approval",
            Report: MapToResponse(report),
            Evidence: evidenceResponse));
    }

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

    private async Task AppendAuditLogAsync(Guid actorUserId, string action, string payload, CancellationToken ct)
    {
        string prevHash = await auditRepo.GetLatestHashAsync(ct);
        DateTime now = DateTime.UtcNow;
        string newHash = AuditHelper.ComputeChainedHash(prevHash, now, actorUserId, action, payload);

        await auditRepo.AddAsync(new AuditLog
        {
            ActorUserId = actorUserId == Guid.Empty ? null : actorUserId,
            Action = action,
            TargetEntity = nameof(Report),
            Payload = payload,
            PreviousHash = prevHash,
            CurrentHash = newHash,
            Timestamp = now
        }, ct);
    }

    private static string SerializeAiAnalysisJson(
        string? roboflowModelId,
        string? roboflowPrediction,
        double? roboflowConfidence,
        bool roboflowNeedsReview,
        string? claudeModelUsed,
        string? claudeIncidentCategory,
        string? claudeSituationSummary,
        string? claudeVisibleHazards,
        string? claudeUncertaintyNotes,
        string? pointerIconType,
        string verificationStatus,
        bool autoApprovedByAi) =>
        JsonSerializer.Serialize(new
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
            verificationStatus,
            autoApprovedByAi
        });

    private static (bool AiAutoApproved, string AiVerificationStatus) ExtractAiApprovalMetadata(Report r)
    {
        if (!string.IsNullOrWhiteSpace(r.AiAnalysisJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(r.AiAnalysisJson);
                JsonElement root = doc.RootElement;
                bool approved = root.TryGetProperty("autoApprovedByAi", out JsonElement appProp) &&
                                appProp.ValueKind is JsonValueKind.True or JsonValueKind.False &&
                                appProp.GetBoolean();
                string status = root.TryGetProperty("verificationStatus", out JsonElement statusProp) &&
                                statusProp.ValueKind == JsonValueKind.String &&
                                !string.IsNullOrWhiteSpace(statusProp.GetString())
                    ? statusProp.GetString()!
                    : (approved ? ClaudeIncidentAutoApprovalStrategy.StatusAutoApproved : "AWAITING_MANUAL_REVIEW");
                return (approved, status);
            }
            catch (JsonException)
            {
                // Ignore malformed historical JSON and fall back cleanly
            }
        }

        return (false, "AWAITING_MANUAL_REVIEW");
    }

    private async Task<(bool Ok, string? Error, List<TaggedColleagueDto> Colleagues)> ValidateAndResolveTaggedColleaguesAsync(
        List<Guid>? requestedIds,
        UserRole actorRole,
        ResponderUnitType actorUnit,
        ResponderUnitType? expectedUnit,
        CancellationToken ct)
    {
        if (requestedIds is null || requestedIds.Count == 0)
            return (true, null, []);

        List<Guid> distinctIds = requestedIds.Where(id => id != Guid.Empty).Distinct().ToList();
        if (distinctIds.Count == 0)
            return (true, null, []);

        if (actorRole == UserRole.Civilian)
            return (false, "Colleague tagging is strictly restricted to active same-unit responders.", []);

        if (actorRole == UserRole.Responder && actorUnit == ResponderUnitType.None)
            return (false, "Colleague tagging is strictly restricted to active same-unit responders.", []);

        List<User> users = db is not null
            ? await db.Users
                .AsNoTracking()
                .Where(u => distinctIds.Contains(u.Id))
                .ToListAsync(ct)
            : (await Task.WhenAll(distinctIds.Select(id => userRepo.GetByIdAsync(id, ct))))
                .Where(u => u is not null)
                .Cast<User>()
                .ToList();

        if (users.Count != distinctIds.Count)
            return (false, "Colleague tagging is strictly restricted to active same-unit responders.", []);

        bool allValid = actorRole == UserRole.Responder
            ? users.All(u => u.Role == UserRole.Responder && u.Unit == actorUnit && !u.IsDeleted && u.Status == AccountStatus.Verified)
            : users.All(u =>
                u.Role == UserRole.Responder &&
                !u.IsDeleted &&
                u.Status == AccountStatus.Verified &&
                (!expectedUnit.HasValue || expectedUnit.Value == ResponderUnitType.None || u.Unit == expectedUnit.Value));

        if (!allValid)
            return (false, "Colleague tagging is strictly restricted to active same-unit responders.", []);

        List<TaggedColleagueDto> resolved = users
            .Select(u => new TaggedColleagueDto(u.Id, u.FullName, u.Unit.ToString(), u.RankOrTitle))
            .ToList();

        return (true, null, resolved);
    }

    private async Task<bool> ApplyClosureEvaluationToReportAsync(
        Report report,
        IncidentClosureAiEvaluation eval,
        Guid actorUserId,
        string? notes,
        List<TaggedColleagueDto>? taggedColleagues,
        DateTime now,
        CancellationToken ct)
    {
        string? sanitizedSummary = SanitizeOptionalField(notes, 1000) ?? SanitizeOptionalField(eval.Reasoning, 1000);
        if (!string.IsNullOrWhiteSpace(sanitizedSummary))
            report.ClosureSummary = sanitizedSummary;

        if (taggedColleagues is { Count: > 0 })
            report.TaggedColleaguesJson = JsonSerializer.Serialize(taggedColleagues);

        if (eval.AutoApproved && string.Equals(eval.Verdict, "Done", StringComparison.OrdinalIgnoreCase))
        {
            report.Status = ReportStatus.Resolved;
            report.ResolvedAt ??= now;
            report.RequiresManualVerification = false;
            report.ClosureApprovalMode = "AI_AUTO_APPROVED_CLOSURE";
            await ReleaseAllocatedUnitAsync(report, ct);
            return true;
        }

        if (string.Equals(eval.Verdict, "InProgress", StringComparison.OrdinalIgnoreCase))
        {
            report.Status = ReportStatus.InProgress;
            report.ResolvedAt = null;
            report.ClosureApprovalMode = "AI_WORKING_PROGRESS";
            return false;
        }

        report.ClosureApprovalMode = "AWAITING_MANUAL_APPROVE";
        return false;
    }

    private async Task ReleaseAllocatedUnitAsync(Report report, CancellationToken ct)
    {
        if (db is null || !report.AllocatedUnitId.HasValue)
            return;

        DutyUnit? unit = report.AllocatedUnit ?? await db.DutyUnits.FirstOrDefaultAsync(u => u.Id == report.AllocatedUnitId.Value, ct);
        if (unit is not null && unit.Status != DutyStatus.OnDuty)
        {
            unit.Status = DutyStatus.OnDuty;
            unit.UpdatedAt = DateTime.UtcNow;
        }
    }

    private static List<TaggedColleagueDto>? DeserializeTaggedColleagues(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            return JsonSerializer.Deserialize<List<TaggedColleagueDto>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static List<TaggedColleagueDto>? DeserializeEvidenceColleagues(string? idsJson, string? namesJson)
    {
        if (string.IsNullOrWhiteSpace(idsJson))
            return null;

        try
        {
            List<Guid>? ids = JsonSerializer.Deserialize<List<Guid>>(idsJson);
            if (ids is null || ids.Count == 0)
                return null;

            List<string>? names = !string.IsNullOrWhiteSpace(namesJson)
                ? JsonSerializer.Deserialize<List<string>>(namesJson)
                : null;

            return ids
                .Select((id, idx) => new TaggedColleagueDto(
                    id,
                    names is not null && idx < names.Count ? names[idx] : string.Empty,
                    string.Empty,
                    string.Empty))
                .ToList();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private async Task<List<ReportResponse>> MapReportsWithFeedbackAsync(List<Report> reports, CancellationToken ct)
    {
        if (reports.Count == 0) return [];
        if (db is null) return reports.Select(r => MapToResponse(r)).ToList();

        List<Guid> reportIds = reports.Select(r => r.Id).ToList();
        Dictionary<Guid, (int Rating, string Comment)> latestFeedbackByReport = (await db.ReportFeedbacks
            .AsNoTracking()
            .Where(f => reportIds.Contains(f.ReportId))
            .OrderByDescending(f => f.CreatedAtUtc)
            .ToListAsync(ct))
            .GroupBy(f => f.ReportId)
            .ToDictionary(g => g.Key, g => (g.First().Rating, g.First().Comment));

        return reports
            .Select(r => latestFeedbackByReport.TryGetValue(r.Id, out var fb)
                ? MapToResponse(r, fb.Rating, fb.Comment)
                : MapToResponse(r))
            .ToList();
    }

    private static ReportEvidenceResponse MapToEvidenceResponse(ReportEvidenceRecord e) =>
        new(
            e.Id,
            e.ReportId,
            $"/api/reports/{e.ReportId}/evidences/{e.Id}",
            e.MediaType,
            e.Caption,
            e.UploadedByName,
            e.CreatedAtUtc,
            e.ClosureOutcome,
            e.AiVerdict,
            e.AiReasoning,
            DeserializeEvidenceColleagues(e.TaggedColleagueUserIdsJson, e.TaggedColleagueNamesJson),
            e.ApprovedByUserId,
            e.ApprovedAtUtc);

    private static ReportFeedbackResponse MapToFeedbackResponse(ReportFeedbackRecord f) =>
        new(
            f.Id,
            f.ReportId,
            f.UserId,
            f.Rating,
            f.Comment,
            f.CreatedAtUtc);

    private static ReportResponse MapToResponse(Report r, int? feedbackRating = null, string? feedbackComment = null)
    {
        var (aiAutoApproved, aiVerificationStatus) = ExtractAiApprovalMetadata(r);
        return new(
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
                (Enum.IsDefined(r.Category) ? r.Category : IncidentCategory.VehicularAccident).ToString()),
            aiAutoApproved,
            aiVerificationStatus,
            feedbackRating,
            feedbackComment,
            r.ClosedAt,
            r.ClosureSummary,
            r.ClosureApprovalMode,
            DeserializeTaggedColleagues(r.TaggedColleaguesJson)
        );
    }
}
