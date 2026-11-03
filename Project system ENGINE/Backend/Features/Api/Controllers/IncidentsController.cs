// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes command triage, static map fixtures, and emergency agency allocation.
// DO NOT allow non-admin users to verify reports or allocate responder units.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api")]
public class IncidentsController(ITriageService triageService, IReportService reportService) : ControllerBase
{
    private bool IsAuthorizedResponderOrAdmin =>
        HttpContext.Items["UserRole"] is UserRole role && (role == UserRole.LDRRMO_Admin || role == UserRole.Responder);

    private Guid CurrentUserId =>
        HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;

    [HttpGet("incidents")]
    public async Task<IActionResult> GetAllIncidentsAsync(CancellationToken ct) =>
        Ok(await reportService.GetAllReportsAsync(ct));

    [HttpGet("incidents/fixtures")]
    public async Task<IActionResult> GetFixturesAsync(CancellationToken ct) =>
        Ok(await triageService.GetActiveFixturesAsync(ct));

    [HttpPost("reports/{id:guid}/verify")]
    public async Task<IActionResult> VerifyReportAsync(Guid id, [FromBody] VerifyReportRequest request, CancellationToken ct) =>
        !IsAuthorizedResponderOrAdmin
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators and Responders may verify incidents." })
            : await triageService.VerifyReportAsync(id, CurrentUserId, request, ct) is var (success, error) && success
                ? Ok(new { message = "Incident status updated." })
                : BadRequest(new { message = error });

    [HttpPost("reports/{id:guid}/allocate")]
    [HttpPost("reports/{id:guid}/assign")]
    public async Task<IActionResult> AllocateUnitAsync(Guid id, [FromBody] AllocateReportRequest request, CancellationToken ct) =>
        !IsAuthorizedResponderOrAdmin
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators and Responders may allocate duty units." })
            : (request.UnitId ?? request.ResponderId) is not { } targetId
                ? BadRequest(new { message = "Target unitId or responderId is required." })
                : await triageService.AllocateUnitAsync(id, CurrentUserId, targetId, ct) is var (success, error) && success
                    ? Ok(new { message = "Unit successfully allocated.", reportId = id.ToString(), responderId = targetId.ToString() })
                    : BadRequest(new { message = error });

    [HttpPut("reports/{id:guid}/severity")]
    public async Task<IActionResult> UpdateSeverityAsync(Guid id, [FromBody] UpdateSeverityRequest request, CancellationToken ct) =>
        !IsAuthorizedResponderOrAdmin
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators and Responders may update incident severity." })
            : await triageService.UpdateReportSeverityAsync(id, CurrentUserId, request.Severity, ct) is var (success, error) && success
                ? Ok(new { message = "Severity updated successfully." })
                : BadRequest(new { message = error });
}
