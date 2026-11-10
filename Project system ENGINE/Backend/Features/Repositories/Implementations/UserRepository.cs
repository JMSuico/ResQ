// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core data access for users, queries, search filters, and soft deletion using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Repositories.Implementations;

public class UserRepository(AppDbContext db) : IUserRepository
{
    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> GetByIdWithDeletedAsync(Guid id, CancellationToken ct = default) =>
        db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.Trim().ToLower(), ct);

    public Task<List<User>> GetAllAsync(CancellationToken ct = default) =>
        db.Users.OrderByDescending(u => u.CreatedAt).ToListAsync(ct);

    public Task<List<User>> SearchUsersAsync(string? query, UserRole? role, ResponderUnitType? unit, AccountStatus? status, int page, int pageSize, CancellationToken ct = default) =>
        BuildSearchQuery(query, role, unit, status)
            .OrderByDescending(u => u.CreatedAt)
            .Skip(Math.Max(0, page - 1) * Math.Max(1, pageSize))
            .Take(Math.Max(1, pageSize))
            .ToListAsync(ct);

    public Task<int> CountUsersAsync(string? query, UserRole? role, ResponderUnitType? unit, AccountStatus? status, CancellationToken ct = default) =>
        BuildSearchQuery(query, role, unit, status).CountAsync(ct);

    public Task<bool> ExistsEmailAsync(string email, CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.Email.ToLower() == email.Trim().ToLower(), ct);

    public async Task AddAsync(User user, CancellationToken ct = default)
    {
        await db.Users.AddAsync(user, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(User user, CancellationToken ct = default)
    {
        db.Users.Update(user);
        await db.SaveChangesAsync(ct);
    }

    public async Task SoftDeleteAsync(Guid id, string adminEmail, CancellationToken ct = default)
    {
        var user = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user != null)
        {
            user.SoftDelete(adminEmail);
            await db.SaveChangesAsync(ct);
        }
    }

    private IQueryable<User> BuildSearchQuery(string? query, UserRole? role, ResponderUnitType? unit, AccountStatus? status)
    {
        var q = db.Users.AsQueryable();
        if (!string.IsNullOrWhiteSpace(query))
        {
            var trimmed = query.Trim().ToLower();
            q = q.Where(u =>
                u.FullName.ToLower().Contains(trimmed) ||
                u.Email.ToLower().Contains(trimmed) ||
                u.EmployeeOrResidentId.ToLower().Contains(trimmed) ||
                u.PhoneNumber.ToLower().Contains(trimmed) ||
                u.Barangay.ToLower().Contains(trimmed) ||
                u.CityOrMunicipality.ToLower().Contains(trimmed) ||
                u.FirstName.ToLower().Contains(trimmed) ||
                u.Surname.ToLower().Contains(trimmed));
        }
        if (role.HasValue) q = q.Where(u => u.Role == role.Value);
        if (unit.HasValue) q = q.Where(u => u.Unit == unit.Value);
        if (status.HasValue) q = q.Where(u => u.Status == status.Value);
        return q;
    }
}
