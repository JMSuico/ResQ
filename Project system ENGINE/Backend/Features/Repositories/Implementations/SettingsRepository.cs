// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core data access for system configuration settings using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Repositories.Implementations;

public class SettingsRepository(AppDbContext db) : ISettingsRepository
{
    public Task<List<Settings>> GetAllAsync(CancellationToken ct = default) =>
        db.Settings.OrderBy(s => s.Category).ThenBy(s => s.Key).ToListAsync(ct);

    public Task<Settings?> GetByKeyAsync(string key, CancellationToken ct = default) =>
        db.Settings.FirstOrDefaultAsync(s => s.Key.ToLower() == key.Trim().ToLower(), ct);

    public async Task UpdateAsync(Settings setting, CancellationToken ct = default)
    {
        var existing = await db.Settings.FirstOrDefaultAsync(s => s.Id == setting.Id || s.Key.ToLower() == setting.Key.ToLower(), ct);
        if (existing != null)
        {
            existing.Value = setting.Value;
            if (!string.IsNullOrWhiteSpace(setting.Category)) existing.Category = setting.Category;
            if (!string.IsNullOrWhiteSpace(setting.Description)) existing.Description = setting.Description;
            existing.UpdatedByUserId = setting.UpdatedByUserId;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            await db.Settings.AddAsync(setting, ct);
        }
        await db.SaveChangesAsync(ct);
    }
}
