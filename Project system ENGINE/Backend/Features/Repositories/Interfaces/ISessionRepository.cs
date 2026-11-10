// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contract for user sessions and token revocations.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Data.Models;

namespace Backend.Features.Repositories.Interfaces;

public interface ISessionRepository
{
    Task<Session?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task AddAsync(Session session, CancellationToken ct = default);
    Task RevokeAsync(Guid sessionId, CancellationToken ct = default);
    Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default);
}
