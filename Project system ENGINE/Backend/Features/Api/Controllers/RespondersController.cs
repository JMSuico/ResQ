// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes responder duty roster, tactical status telemetry, PCR vitals, police blotter, and alarm escalations.
// DO NOT permit unauthorized agencies to mutate other agencies' duty status.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/responder")]
[Route("api/responders")]
[Route("api/responder-ops")]
public class RespondersController(IResponderOpsService responderOpsService) : ControllerBase
{
    [HttpGet("roster")]
    public async Task<IActionResult> GetRosterAsync([FromQuery] ResponderUnitType? agency, CancellationToken ct) =>
        Ok(await responderOpsService.GetRosterAsync(agency, ct));

    [HttpPut("duty-status")]
    public async Task<IActionResult> UpdateDutyStatusAsync([FromBody] UpdateDutyStatusRequest request, CancellationToken ct) =>
        IsAuthorizedResponderOrAdmin()
            ? await responderOpsService.UpdateDutyStatusAsync(request, GetCurrentUserId(), ct) is { Success: true, Unit: { } unit }
                ? Ok(new { message = "Duty unit status updated.", data = unit })
                : BadRequest(new { message = "Failed to update duty unit status." })
            : StatusCode(StatusCodes.Status403Forbidden, new { message = "Unauthorized to update duty status." });

    [HttpPut("units/{id:guid}/status")]
    public async Task<IActionResult> UpdateUnitStatusAsync(Guid id, [FromBody] UpdateUnitStatusRequest request, CancellationToken ct) =>
        IsAuthorizedResponderOrAdmin()
            ? await responderOpsService.UpdateUnitStatusAsync(id, request.Status, ct) is { Success: true }
                ? Ok(new { message = "Duty unit status updated." })
                : BadRequest(new { message = "Failed to update duty unit status." })
            : StatusCode(StatusCodes.Status403Forbidden, new { message = "Unauthorized to update duty status." });

    [HttpPost("pcr")]
    public async Task<IActionResult> SubmitPcrAsync([FromBody] CreatePcrRequest request, CancellationToken ct) =>
        IsAuthorizedAgencyOrAdmin(ResponderUnitType.RHU)
            ? await responderOpsService.SubmitPcrAsync(request, GetCurrentUserId(), ct) is { Success: true, Pcr: { } pcr }
                ? Ok(new { message = "Patient Care Record stored successfully.", data = pcr })
                : BadRequest(new { message = "Failed to store Patient Care Record." })
            : StatusCode(StatusCodes.Status403Forbidden, new { message = "Only RHU Medic responders or LDRRMO Administrators may submit Patient Care Records." });

    [HttpGet("pcr")]
    public async Task<IActionResult> GetPcrRecordsAsync([FromQuery] Guid? reportId, CancellationToken ct) =>
        Ok(await responderOpsService.GetPcrRecordsAsync(reportId, ct));

    [HttpPost("blotter")]
    public async Task<IActionResult> FileBlotterAsync([FromBody] CreateBlotterRequest request, CancellationToken ct) =>
        IsAuthorizedAgencyOrAdmin(ResponderUnitType.PNP)
            ? await responderOpsService.FileBlotterAsync(request, GetCurrentUserId(), ct) is { Success: true, Blotter: { } blotter }
                ? Ok(new { message = "Police blotter entry created and cryptographically sealed.", data = blotter })
                : BadRequest(new { message = "Failed to file police blotter entry." })
            : StatusCode(StatusCodes.Status403Forbidden, new { message = "Only PNP Police responders or LDRRMO Administrators may file police blotter entries." });

    [HttpGet("blotter")]
    public async Task<IActionResult> GetBlotterEntriesAsync([FromQuery] Guid? reportId, CancellationToken ct) =>
        Ok(await responderOpsService.GetBlotterEntriesAsync(reportId, ct));

    [HttpPost("alarm-level")]
    public async Task<IActionResult> SetAlarmLevelAsync([FromBody] SetAlarmLevelRequest request, CancellationToken ct) =>
        IsAuthorizedAgencyOrAdmin(ResponderUnitType.FIRE)
            ? await responderOpsService.SetAlarmLevelAsync(request, GetCurrentUserId(), ct) is { Success: true, Alarm: { } alarm }
                ? Ok(new { message = "Fire alarm status updated.", data = alarm })
                : BadRequest(new { message = "Failed to update fire alarm level." })
            : StatusCode(StatusCodes.Status403Forbidden, new { message = "Only BFP Fire responders or LDRRMO Administrators may set fire alarm levels." });

    [HttpGet("alarm-level")]
    public async Task<IActionResult> GetAlarmStatusesAsync([FromQuery] Guid? reportId, CancellationToken ct) =>
        Ok(await responderOpsService.GetAlarmStatusesAsync(reportId, ct));

    [HttpGet("hydrants")]
    public async Task<IActionResult> GetHydrantsAsync(CancellationToken ct) =>
        Ok(await responderOpsService.GetHydrantsAsync(ct));

    private bool IsAuthorizedResponderOrAdmin() =>
        HttpContext.Items["UserRole"] is UserRole role
            ? role == UserRole.LDRRMO_Admin || role == UserRole.Responder
            : false;

    private bool IsAuthorizedAgencyOrAdmin(ResponderUnitType requiredAgency) =>
        HttpContext.Items["UserRole"] is UserRole role
        && (role == UserRole.LDRRMO_Admin
            || (role == UserRole.Responder && HttpContext.Items["UserUnit"] is ResponderUnitType unit && unit == requiredAgency));

    private Guid? GetCurrentUserId() =>
        HttpContext.Items["UserId"] is Guid uid ? uid : null;
}
