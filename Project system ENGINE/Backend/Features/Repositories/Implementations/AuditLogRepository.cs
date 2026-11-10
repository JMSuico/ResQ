// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core data access for tamper-evident SHA-256 audit logs using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Repositories.Implementations;

public class AuditLogRepository(AppDbContext db) : IAuditLogRepository
{
    public async Task<string> GetLatestHashAsync(CancellationToken ct = default) =>
        (await db.AuditLogs.OrderByDescending(a => a.Timestamp).Select(a => a.CurrentHash).FirstOrDefaultAsync(ct))
        ?? "0000000000000000000000000000000000000000000000000000000000000000";

    public async Task AddAsync(AuditLog log, CancellationToken ct = default)
    {
        await db.AuditLogs.AddAsync(log, ct);
        await db.SaveChangesAsync(ct);
    }

    public Task<List<AuditLog>> GetRecentAsync(int count = 50, CancellationToken ct = default) =>
        db.AuditLogs.OrderByDescending(a => a.Timestamp).Take(count).ToListAsync(ct);
}
