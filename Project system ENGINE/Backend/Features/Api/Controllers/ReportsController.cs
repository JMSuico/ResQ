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
        await reportService.ResolveReporterIdAsync(HttpContext.Items["UserId"] as Guid?, ct) is var reporterId
        && await reportService.CreateReportAsync(reporterId, request, ReportsDirectory, ct) is var report
            ? StatusCode(StatusCodes.Status201Created, new { message = "Report submitted successfully.", report, @event = "resqtrack:report" })
            : BadRequest();

    [HttpGet]
    public async Task<IActionResult> GetAllReportsAsync(CancellationToken ct) =>
        Ok(await reportService.GetAllReportsAsync(ct));

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
    public async Task<IActionResult> GetReportImageAsync(Guid id, CancellationToken ct) =>
        await reportService.GetReportImagePathAsync(id, ct) is { } path && System.IO.File.Exists(path)
            ? File(await System.IO.File.ReadAllBytesAsync(path, ct), "image/png")
            : File(CaptureStorageHelper.GenerateSyntheticFallbackPng(), "image/png");

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
