// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes emergency report ingestion, incident listing, and image streaming endpoints.
// Universal Lambda Expressions (=>). Injects Services and Environment ONLY. Zero emojis.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController(
    IReportService reportService,
    IWebHostEnvironment env,
    IUserRepository? userRepo = null) : ControllerBase
{
    private string ReportsDirectory => Path.Combine(env.ContentRootPath, "server-data", "uploads", "reports");
    private string EvidencesDirectory => Path.Combine(ReportsDirectory, "evidences");

    [HttpPost]
    public async Task<IActionResult> CreateReportAsync([FromBody] CreateReportRequest request, CancellationToken ct)
    {
        try
        {
            Guid reporterId = await reportService.ResolveReporterIdAsync(HttpContext?.Items["UserId"] as Guid?, ct);
            ReportResponse report = await reportService.CreateReportAsync(
                reporterId,
                request,
                ReportsDirectory,
                ct,
                submittedIpAddress: ClientNetworkHelper.ResolveClientIpAddress(HttpContext));
            return StatusCode(StatusCodes.Status201Created, new { message = "Report submitted successfully.", report, @event = "resqtrack:report" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
    }

    [HttpPost("analyze-image")]
    public async Task<IActionResult> AnalyzeIncidentImageAsync([FromBody] AnalyzeIncidentImageRequest request, CancellationToken ct) =>
        Ok(await reportService.AnalyzeIncidentImageAsync(request, ct));

    [HttpGet]
    public async Task<IActionResult> GetAllReportsAsync(CancellationToken ct) =>
        HttpContext?.Items["UserRole"] switch
        {
            UserRole.Civilian => HttpContext.Items["UserId"] is Guid uid && uid != Guid.Empty
                ? Ok(await reportService.GetMyReportsAsync(uid, ct))
                : Unauthorized(),
            UserRole.Responder or UserRole.LDRRMO_Admin => Ok(await reportService.GetAllReportsAsync(ct)),
            _ => Unauthorized()
        };

    [HttpGet("mine")]
    public async Task<IActionResult> GetMyReportsAsync(CancellationToken ct) =>
        HttpContext.Items["UserId"] is Guid uid
            ? Ok(await reportService.GetMyReportsAsync(uid, ct))
            : Unauthorized();

    [HttpGet("agency/{agency}")]
    public async Task<IActionResult> GetAgencyReportsAsync(ResponderUnitType agency, CancellationToken ct) =>
        IsAuthorizedAgencyOrAdmin(agency)
            ? Ok(await reportService.GetAgencyReportsAsync(agency, ct))
            : StatusCode(StatusCodes.Status403Forbidden, new { message = $"Access denied. Only {agency} personnel or LDRRMO Administrators may view {agency} agency reports." });

    [HttpGet("{id:guid}/image")]
    public async Task<IActionResult> GetReportImageAsync(Guid id, CancellationToken ct)
    {
        string? path = await reportService.GetReportImagePathAsync(id, ct);
        var (bytes, contentType) = await CaptureStorageHelper.ReadCaptureFileAsync(path, ct);
        return MediaStreamResponseHelper.CreateBytesOrRangeResponse(HttpContext, bytes, contentType);
    }

    [HttpGet("{id:guid}/evidences")]
    public async Task<IActionResult> GetReportEvidencesAsync(Guid id, CancellationToken ct) =>
        CurrentUserId == Guid.Empty && HttpContext?.Items["UserRole"] is not UserRole
            ? Unauthorized(new { message = "Authentication session required." })
            : Ok(await reportService.GetReportEvidencesAsync(id, ct));

    [HttpPost("{id:guid}/evidences")]
    public async Task<IActionResult> AddReportEvidenceAsync(Guid id, [FromBody] CreateReportEvidenceRequest request, CancellationToken ct) =>
        !IsAuthorizedResponderOrAdmin()
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only Responders and LDRRMO Administrators may upload incident evidences." })
            : await reportService.AddReportEvidenceAsync(
                id,
                request,
                CurrentUserId == Guid.Empty ? null : CurrentUserId,
                CurrentUserName,
                EvidencesDirectory,
                ct) switch
            {
                { NotFound: true, Error: var err } => NotFound(new { message = err }),
                { Success: false, Error: var err } => BadRequest(new { message = err }),
                { Evidence: var evidence } => StatusCode(StatusCodes.Status201Created, evidence)
            };

    [HttpGet("{reportId:guid}/evidences/{evidenceId:guid}")]
    public async Task<IActionResult> GetReportEvidenceFileAsync(Guid reportId, Guid evidenceId, CancellationToken ct)
    {
        ReportEvidenceRecord? evidence = await reportService.GetReportEvidenceRecordAsync(reportId, evidenceId, ct);
        if (evidence is null) return NotFound(new { message = "Evidence record not found." });

        var (bytes, contentType) = await CaptureStorageHelper.ReadCaptureFileAsync(evidence.FilePath, ct);
        return MediaStreamResponseHelper.CreateBytesOrRangeResponse(HttpContext, bytes, contentType);
    }

    [HttpGet("{id:guid}/feedback")]
    public async Task<IActionResult> GetReportFeedbackAsync(Guid id, CancellationToken ct) =>
        Ok(await reportService.GetReportFeedbackAsync(id, ct));

    [HttpPost("{id:guid}/feedback")]
    public async Task<IActionResult> SubmitReportFeedbackAsync(Guid id, [FromBody] SubmitReportFeedbackRequest request, CancellationToken ct) =>
        CurrentUserId == Guid.Empty
            ? Unauthorized(new { message = "Authentication required to submit feedback." })
            : await reportService.SubmitReportFeedbackAsync(id, CurrentUserId, request, ct) switch
            {
                { NotFound: true, Error: var err } => NotFound(new { message = err }),
                { Success: false, Error: var err } => BadRequest(new { message = err }),
                { Feedback: var feedback } => Ok(feedback)
            };

    [HttpPost("{id:guid}/beacon")]
    public async Task<IActionResult> PostDistressBeaconAsync(Guid id, [FromBody] DistressBeaconRequest beacon, CancellationToken ct) =>
        await reportService.RecordDistressBeaconAsync(id, beacon, ct)
            ? Ok(new { message = "Distress beacon recorded (1 BPM).", reportId = id, latitude = beacon.Latitude, longitude = beacon.Longitude })
            : NotFound();

    [HttpPost("{id:guid}/ai-auto-approve")]
    public async Task<IActionResult> AiAutoApproveReportAsync(Guid id, CancellationToken ct) =>
        !IsAuthorizedResponderOrAdmin()
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators and Responders may trigger AI auto-approval." })
            : await reportService.AutoApprovePendingReportWithAiAsync(id, CurrentUserId, ct) switch
            {
                { NotFound: true } => NotFound(new { message = "Report not found." }),
                var result => Ok(new
                {
                    autoApproved = result.AutoApproved,
                    status = result.Status,
                    aiVerificationStatus = result.AiVerificationStatus,
                    message = result.Message,
                    report = result.Report
                })
            };

    [HttpPost("{id:guid}/submit-closure-evidence")]
    public async Task<IActionResult> SubmitClosureEvidenceAsync(
        Guid id,
        [FromBody] SubmitClosureEvidenceRequest request,
        CancellationToken ct)
    {
        if (HttpContext?.Items["UserRole"] is not UserRole role)
            return Unauthorized(new { message = "Authentication session required." });

        if (role != UserRole.Responder && role != UserRole.LDRRMO_Admin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only Responders and LDRRMO Administrators may submit closure evidence." });

        var (actorUnit, actorName) = await ResolveCallerIdentityAsync(ct);
        return await reportService.SubmitClosureEvidenceAsync(
            id,
            request,
            CurrentUserId,
            role,
            actorUnit,
            actorName,
            EvidencesDirectory,
            ct) switch
        {
            { NotFound: true, Error: var err } => NotFound(new { message = err }),
            { Forbidden: true, Error: var err } => StatusCode(StatusCodes.Status403Forbidden, new { message = err }),
            { Success: false, Error: var err } => BadRequest(new { message = err }),
            { Result: var result } => Ok(result)
        };
    }

    [HttpPost("{id:guid}/approve-closure")]
    public async Task<IActionResult> ApproveClosureAsync(
        Guid id,
        [FromBody] ApproveClosureRequest request,
        CancellationToken ct)
    {
        if (HttpContext?.Items["UserRole"] is not UserRole role)
            return Unauthorized(new { message = "Authentication session required." });

        if (role != UserRole.Responder && role != UserRole.LDRRMO_Admin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only Responders and LDRRMO Administrators may approve incident closure." });

        var (_, actorName) = await ResolveCallerIdentityAsync(ct);
        return await reportService.ApproveClosureAsync(
            id,
            request,
            CurrentUserId,
            role,
            actorName,
            ct) switch
        {
            { NotFound: true, Error: var err } => NotFound(new { message = err }),
            { Forbidden: true, Error: var err } => StatusCode(StatusCodes.Status403Forbidden, new { message = err }),
            { Success: false, Error: var err } => BadRequest(new { message = err }),
            { Result: var result } => Ok(result)
        };
    }

    private async Task<(ResponderUnitType Unit, string? Name)> ResolveCallerIdentityAsync(CancellationToken ct)
    {
        ResponderUnitType unit = HttpContext?.Items["UserUnit"] is ResponderUnitType ctxUnit
            ? ctxUnit
            : ResponderUnitType.None;
        string? name = CurrentUserName;

        if ((unit == ResponderUnitType.None || string.IsNullOrWhiteSpace(name)) &&
            HttpContext?.Items["User"] is User ctxUser)
        {
            if (unit == ResponderUnitType.None) unit = ctxUser.Unit;
            if (string.IsNullOrWhiteSpace(name)) name = ctxUser.FullName;
        }

        if ((unit == ResponderUnitType.None || string.IsNullOrWhiteSpace(name)) &&
            CurrentUserId != Guid.Empty &&
            userRepo is not null)
        {
            User? dbUser = await userRepo.GetByIdAsync(CurrentUserId, ct);
            if (dbUser is not null)
            {
                if (unit == ResponderUnitType.None) unit = dbUser.Unit;
                if (string.IsNullOrWhiteSpace(name)) name = dbUser.FullName;
            }
        }

        return (unit, name);
    }

    private bool IsAuthorizedAgencyOrAdmin(ResponderUnitType agency) =>
        HttpContext?.Items["UserRole"] is UserRole role
        && (role == UserRole.LDRRMO_Admin
            || (role == UserRole.Responder && HttpContext.Items["UserUnit"] is ResponderUnitType unit && (unit == agency || agency == ResponderUnitType.None)));

    private bool IsAuthorizedResponderOrAdmin() =>
        HttpContext?.Items["UserRole"] is UserRole role
        && (role == UserRole.LDRRMO_Admin || role == UserRole.Responder);

    private Guid CurrentUserId =>
        HttpContext?.Items["UserId"] is Guid uid ? uid : Guid.Empty;

    private string? CurrentUserName =>
        HttpContext?.Items["User"] is User user && !string.IsNullOrWhiteSpace(user.FullName)
            ? user.FullName
            : null;
}
