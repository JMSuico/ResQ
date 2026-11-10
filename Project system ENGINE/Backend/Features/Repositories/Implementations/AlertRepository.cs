// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core data access for alert read tracking using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Repositories.Implementations;

public class AlertRepository(AppDbContext db) : IAlertRepository
{
    public Task<List<AlertReadState>> GetUserAlertsAsync(Guid userId, CancellationToken ct = default) =>
        db.AlertReadStates.Include(a => a.Report).Where(a => a.UserId == userId).ToListAsync(ct);

    public async Task MarkAsReadAsync(Guid userId, Guid reportId, CancellationToken ct = default)
    {
        var state = await db.AlertReadStates.FirstOrDefaultAsync(a => a.UserId == userId && a.ReportId == reportId, ct);
        if (state != null)
        {
            state.IsRead = true;
            state.ReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        else
        {
            await db.AlertReadStates.AddAsync(new AlertReadState
            {
                UserId = userId,
                ReportId = reportId,
                IsRead = true,
                ReadAt = DateTime.UtcNow
            }, ct);
            await db.SaveChangesAsync(ct);
        }
    }
}
