// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core data access for user sessions and revocation using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Repositories.Implementations;

public class SessionRepository(AppDbContext db) : ISessionRepository
{
    public Task<Session?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        db.Sessions.Include(s => s.User).FirstOrDefaultAsync(s => s.TokenHash == tokenHash && !s.IsRevoked && s.ExpiresAt > DateTime.UtcNow, ct);

    public async Task AddAsync(Session session, CancellationToken ct = default)
    {
        await db.Sessions.AddAsync(session, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task RevokeAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await db.Sessions.FindAsync([sessionId], ct);
        if (session != null)
        {
            session.IsRevoked = true;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var activeSessions = await db.Sessions.Where(s => s.UserId == userId && !s.IsRevoked).ToListAsync(ct);
        foreach (var s in activeSessions) s.IsRevoked = true;
        await db.SaveChangesAsync(ct);
    }
}
