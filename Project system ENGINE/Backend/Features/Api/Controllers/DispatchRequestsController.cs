// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes inter-agency dispatch request endpoints backed by PostgreSQL persistence.
// Universal Lambda Expressions (=>). Injects Services ONLY. Zero emojis.

using Microsoft.AspNetCore.Mvc;
using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/dispatch-requests")]
public class DispatchRequestsController(IDispatchRequestService dispatchService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAllAsync(CancellationToken ct) =>
        !IsAuthorizedResponderOrAdmin()
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators and Responders may view dispatch requests." })
            : Ok(await dispatchService.GetAllAsync(ct));

    [HttpPost]
    public async Task<IActionResult> CreateAsync([FromBody] CreateDispatchRequest request, CancellationToken ct) =>
        !IsAuthorizedResponderOrAdmin()
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators and Responders may create dispatch requests." })
            : StatusCode(
                StatusCodes.Status201Created,
                await dispatchService.CreateAsync(
                    request,
                    CurrentUserId,
                    CurrentUserName,
                    ClientNetworkHelper.ResolveClientIpAddress(HttpContext),
                    ct));

    [HttpPut("{idOrCode}/status")]
    public async Task<IActionResult> UpdateStatusAsync(string idOrCode, [FromBody] UpdateDispatchStatusRequest request, CancellationToken ct) =>
        !IsAuthorizedResponderOrAdmin()
            ? StatusCode(StatusCodes.Status403Forbidden, new { message = "Only LDRRMO Administrators and Responders may update dispatch request status." })
            : await dispatchService.UpdateStatusAsync(idOrCode, request, CurrentUserId, CurrentUserName, ct) switch
            {
                { NotFound: true, Error: var err } => NotFound(new { message = err }),
                { Success: false, Error: var err } => BadRequest(new { message = err }),
                { Record: var record } => Ok(record)
            };

    private bool IsAuthorizedResponderOrAdmin() =>
        HttpContext?.Items["UserRole"] is UserRole role
        && (role == UserRole.LDRRMO_Admin || role == UserRole.Responder);

    private Guid? CurrentUserId =>
        HttpContext?.Items["UserId"] is Guid uid && uid != Guid.Empty ? uid : null;

    private string? CurrentUserName =>
        HttpContext?.Items["User"] is User user && !string.IsNullOrWhiteSpace(user.FullName)
            ? user.FullName
            : null;
}
