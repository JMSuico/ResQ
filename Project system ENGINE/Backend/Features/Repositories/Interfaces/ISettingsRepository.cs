// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contract for system platform settings.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Data.Models;

namespace Backend.Features.Repositories.Interfaces;

public interface ISettingsRepository
{
    Task<List<Settings>> GetAllAsync(CancellationToken ct = default);
    Task<Settings?> GetByKeyAsync(string key, CancellationToken ct = default);
    Task UpdateAsync(Settings setting, CancellationToken ct = default);
}
