// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contract for on-duty responder units and fleet status updates.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;

namespace Backend.Features.Repositories.Interfaces;

public interface IDutyUnitRepository
{
    Task<DutyUnit?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<DutyUnit>> GetAllAsync(CancellationToken ct = default);
    Task UpdateStatusAsync(Guid id, DutyStatus status, CancellationToken ct = default);
}
