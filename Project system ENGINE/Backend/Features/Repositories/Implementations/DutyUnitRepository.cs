// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core data access for duty units and responder fleet status using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Repositories.Implementations;

public class DutyUnitRepository(AppDbContext db) : IDutyUnitRepository
{
    public Task<DutyUnit?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.DutyUnits.FirstOrDefaultAsync(d => d.Id == id, ct);

    public Task<List<DutyUnit>> GetAllAsync(CancellationToken ct = default) =>
        db.DutyUnits.OrderBy(d => d.Agency).ThenBy(d => d.UnitName).ToListAsync(ct);

    public async Task UpdateStatusAsync(Guid id, DutyStatus status, CancellationToken ct = default)
    {
        var unit = await db.DutyUnits.FindAsync([id], ct);
        if (unit != null)
        {
            unit.Status = status;
            unit.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }
}
