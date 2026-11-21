// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes emergency report ingestion, incident listing, and image streaming endpoints.
// Universal Lambda Expressions (=>). Injects Services and Environment ONLY. Zero emojis.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController(IReportService reportService, IWebHostEnvironment env) : ControllerBase
{
    private string ReportsDirectory => Path.Combine(env.ContentRootPath, "server-data", "uploads", "reports");

    [HttpPost]
    public async Task<IActionResult> CreateReportAsync([FromBody] CreateReportRequest request, CancellationToken ct) =>
        await reportService.ResolveReporterIdAsync(HttpContext?.Items["UserId"] as Guid?, ct) is var reporterId
        && await reportService.CreateReportAsync(reporterId, request, ReportsDirectory, ct, submittedIpAddress: ClientNetworkHelper.ResolveClientIpAddress(HttpContext)) is var report
            ? StatusCode(StatusCodes.Status201Created, new { message = "Report submitted successfully.", report, @event = "resqtrack:report" })
            : BadRequest();

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

    [HttpPost("{id:guid}/beacon")]
    public async Task<IActionResult> PostDistressBeaconAsync(Guid id, [FromBody] DistressBeaconRequest beacon, CancellationToken ct) =>
        await reportService.RecordDistressBeaconAsync(id, beacon, ct)
            ? Ok(new { message = "Distress beacon recorded (1 BPM).", reportId = id, latitude = beacon.Latitude, longitude = beacon.Longitude })
            : NotFound();

    private bool IsAuthorizedAgencyOrAdmin(ResponderUnitType agency) =>
        HttpContext.Items["UserRole"] is UserRole role
        && (role == UserRole.LDRRMO_Admin
            || (role == UserRole.Responder && HttpContext.Items["UserUnit"] is ResponderUnitType unit && (unit == agency || agency == ResponderUnitType.None)));
}
