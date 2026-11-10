// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contract for tamper-evident SHA-256 chained audit logs.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Data.Models;

namespace Backend.Features.Repositories.Interfaces;

public interface IAuditLogRepository
{
    Task<string> GetLatestHashAsync(CancellationToken ct = default);
    Task AddAsync(AuditLog log, CancellationToken ct = default);
    Task<List<AuditLog>> GetRecentAsync(int count = 50, CancellationToken ct = default);
}
