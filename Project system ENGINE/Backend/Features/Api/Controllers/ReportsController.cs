// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes emergency report ingestion, incident listing, and image streaming endpoints.
// DO NOT bypass image magic byte validation or write uncompressed files outside server-data.

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
    public async Task<IActionResult> CreateReportAsync([FromBody] CreateReportRequest request, CancellationToken ct)
    {
        Guid reporterId = HttpContext.Items["UserId"] is Guid uid ? uid : Guid.NewGuid();
        var report = await reportService.CreateReportAsync(reporterId, request, ReportsDirectory, ct);
        return StatusCode(StatusCodes.Status201Created, new { message = "Report submitted successfully.", report, @event = "resqtrack:report" });
    }

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
        Ok(await reportService.GetAgencyReportsAsync(agency, ct));

    [HttpGet("{id:guid}/image")]
    public async Task<IActionResult> GetReportImageAsync(Guid id, CancellationToken ct)
    {
        string? path = await reportService.GetReportImagePathAsync(id, ct);
        if (string.IsNullOrWhiteSpace(path) || !System.IO.File.Exists(path))
            return File(CaptureStorageHelper.GenerateSyntheticFallbackPng(), "image/png");

        byte[] bytes = await System.IO.File.ReadAllBytesAsync(path, ct);
        return File(bytes, "image/png");
    }
}
