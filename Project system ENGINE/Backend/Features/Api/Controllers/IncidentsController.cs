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
public class IncidentsController(ITriageService triageService) : ControllerBase
{
    [HttpGet("incidents/fixtures")]
    public async Task<IActionResult> GetFixturesAsync(CancellationToken ct) =>
        Ok(await triageService.GetActiveFixturesAsync(ct));

    [HttpPost("reports/{id:guid}/verify")]
    public async Task<IActionResult> VerifyReportAsync(Guid id, [FromBody] VerifyReportRequest request, CancellationToken ct)
    {
        if (HttpContext.Items["UserRole"] is not UserRole role || role != UserRole.LDRRMO_Admin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators may verify incidents." });

        Guid adminId = HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;
        var (success, error) = await triageService.VerifyReportAsync(id, adminId, request, ct);
        return success ? Ok(new { message = "Incident status updated." }) : BadRequest(new { message = error });
    }

    [HttpPost("reports/{id:guid}/allocate")]
    public async Task<IActionResult> AllocateUnitAsync(Guid id, [FromBody] AllocateReportRequest request, CancellationToken ct)
    {
        if (HttpContext.Items["UserRole"] is not UserRole role || role != UserRole.LDRRMO_Admin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators may allocate duty units." });

        Guid adminId = HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;
        var (success, error) = await triageService.AllocateUnitAsync(id, adminId, request.UnitId, ct);
        return success ? Ok(new { message = "Unit successfully allocated." }) : BadRequest(new { message = error });
    }
}
