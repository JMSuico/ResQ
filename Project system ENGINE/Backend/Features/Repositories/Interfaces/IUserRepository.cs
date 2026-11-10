// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contract for users, filtering, pagination, and soft deletion.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;

namespace Backend.Features.Repositories.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetByIdWithDeletedAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<List<User>> GetAllAsync(CancellationToken ct = default);
    Task<List<User>> SearchUsersAsync(string? query, UserRole? role, ResponderUnitType? unit, AccountStatus? status, int page, int pageSize, CancellationToken ct = default);
    Task<int> CountUsersAsync(string? query, UserRole? role, ResponderUnitType? unit, AccountStatus? status, CancellationToken ct = default);
    Task<bool> ExistsEmailAsync(string email, CancellationToken ct = default);
    Task AddAsync(User user, CancellationToken ct = default);
    Task UpdateAsync(User user, CancellationToken ct = default);
    Task SoftDeleteAsync(Guid id, string adminEmail, CancellationToken ct = default);
}
