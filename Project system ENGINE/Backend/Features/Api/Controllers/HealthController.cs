// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes high-speed health status endpoint for container probes and uptime checkers.
// Universal Lambda Expressions (=>). Zero emojis.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Features.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/health")]
[Route("health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public IActionResult CheckHealth() =>
        Ok(new { status = "healthy", service = "ResQTrack Incident AI Detection Engine", timestamp = DateTime.UtcNow });
}
