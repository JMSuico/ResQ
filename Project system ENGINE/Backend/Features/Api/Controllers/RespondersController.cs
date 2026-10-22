// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes responder duty roster inspection and unit status updates.
// DO NOT permit unauthorized agencies to mutate other agencies' duty status.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/responders")]
public class RespondersController(IRespondersService respondersService) : ControllerBase
{
    [HttpGet("roster")]
    public async Task<IActionResult> GetRosterAsync(CancellationToken ct) =>
        Ok(await respondersService.GetRosterAsync(ct));

    [HttpPut("units/{id:guid}/status")]
    public async Task<IActionResult> UpdateUnitStatusAsync(Guid id, [FromBody] UpdateUnitStatusRequest request, CancellationToken ct)
    {
        var role = HttpContext.Items["UserRole"] as UserRole?;
        if (role != UserRole.LDRRMO_Admin && role != UserRole.Responder)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Unauthorized to update duty status." });

        var (success, error) = await respondersService.UpdateUnitStatusAsync(id, request.Status, ct);
        return success ? Ok(new { message = "Duty unit status updated." }) : BadRequest(new { message = error });
    }
}
