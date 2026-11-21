// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines inter-agency dispatch request persistence and status transition contracts.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;

namespace Backend.Features.Services.Interfaces;

public interface IDispatchRequestService
{
    Task<List<DispatchRequestResponse>> GetAllAsync(CancellationToken ct = default);
    Task<DispatchRequestResponse> CreateAsync(CreateDispatchRequest request, Guid? actorUserId, string? actorName, string? ipAddress, CancellationToken ct = default);
    Task<(bool Success, string? Error, bool NotFound, DispatchRequestResponse? Record)> UpdateStatusAsync(string idOrCode, UpdateDispatchStatusRequest request, Guid? actorUserId, string? actorName, CancellationToken ct = default);
}
