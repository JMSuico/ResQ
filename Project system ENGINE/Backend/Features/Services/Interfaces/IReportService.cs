// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines incident reporting, retrieval, agency-scoped filtering, and reporter resolution service contracts.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;

namespace Backend.Features.Services.Interfaces;

public interface IReportService
{
    Task<IncidentImageAiAnalysisResponseDto> AnalyzeIncidentImageAsync(AnalyzeIncidentImageRequest request, CancellationToken ct = default);
    Task<ReportResponse> CreateReportAsync(Guid reporterId, CreateReportRequest request, string reportsRootPath, CancellationToken ct = default, string? submittedIpAddress = null);
    Task<List<ReportResponse>> GetAllReportsAsync(CancellationToken ct = default);
    Task<List<ReportResponse>> GetMyReportsAsync(Guid userId, CancellationToken ct = default);
    Task<List<ReportResponse>> GetAgencyReportsAsync(ResponderUnitType agency, CancellationToken ct = default);
    Task<string?> GetReportImagePathAsync(Guid reportId, CancellationToken ct = default);
    Task<Guid> ResolveReporterIdAsync(Guid? currentUserId, CancellationToken ct = default);
    Task<bool> RecordDistressBeaconAsync(Guid reportId, DistressBeaconRequest beacon, CancellationToken ct = default);
    Task<AiAutoApproveReportResult> AutoApprovePendingReportWithAiAsync(Guid reportId, Guid actorUserId, CancellationToken ct = default);
    Task<List<ReportEvidenceResponse>> GetReportEvidencesAsync(Guid reportId, CancellationToken ct = default);
    Task<(bool Success, bool NotFound, string? Error, ReportEvidenceResponse? Evidence)> AddReportEvidenceAsync(Guid reportId, CreateReportEvidenceRequest request, Guid? uploaderId, string? uploaderName, string reportsRootPath, CancellationToken ct = default);
    Task<ReportEvidenceRecord?> GetReportEvidenceRecordAsync(Guid reportId, Guid evidenceId, CancellationToken ct = default);
    Task<List<ReportFeedbackResponse>> GetReportFeedbackAsync(Guid reportId, CancellationToken ct = default);
    Task<(bool Success, bool NotFound, string? Error, ReportFeedbackResponse? Feedback)> SubmitReportFeedbackAsync(Guid reportId, Guid userId, SubmitReportFeedbackRequest request, CancellationToken ct = default);
    Task<(bool Success, bool NotFound, bool Forbidden, string? Error, ClosureEvidenceSubmissionResponse? Result)> SubmitClosureEvidenceAsync(Guid reportId, SubmitClosureEvidenceRequest request, Guid actorUserId, UserRole actorRole, ResponderUnitType actorUnit, string? actorName, string reportsRootPath, CancellationToken ct = default);
    Task<(bool Success, bool NotFound, bool Forbidden, string? Error, ClosureEvidenceSubmissionResponse? Result)> ApproveClosureAsync(Guid reportId, ApproveClosureRequest request, Guid actorUserId, UserRole actorRole, string? actorName, CancellationToken ct = default);
}
