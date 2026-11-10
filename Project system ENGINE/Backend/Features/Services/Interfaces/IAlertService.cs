// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines alert management contract for fetching alerts, broadcasting, and marking read.
// Universal Lambda Expressions across implementations. Zero emojis.

using Backend.Features.Api.DTOs;

namespace Backend.Features.Services.Interfaces;

public interface IAlertService
{
    Task<List<AlertResponse>> GetAlertsAsync(Guid userId, CancellationToken ct = default);
    Task<object> CreateBroadcastAsync(Guid adminId, CreateAlertBroadcastRequest request, CancellationToken ct = default);
    Task MarkReadAsync(Guid userId, string reportId, CancellationToken ct = default);
}
