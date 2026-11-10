// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contract for alert read tracking and state persistence.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Data.Models;

namespace Backend.Features.Repositories.Interfaces;

public interface IAlertRepository
{
    Task<List<AlertReadState>> GetUserAlertsAsync(Guid userId, CancellationToken ct = default);
    Task MarkAsReadAsync(Guid userId, Guid reportId, CancellationToken ct = default);
}
