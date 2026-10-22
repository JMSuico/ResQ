// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core 10 data access logic using universal lambda syntax (=>).
// DO NOT write multi-line block bodies when expression bodies (=>) can be used.

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

public class ReportRepository(AppDbContext db) : IReportRepository
{
    public Task<Report?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Reports.Include(r => r.AllocatedUnit).FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<List<Report>> GetAllAsync(CancellationToken ct = default) =>
        db.Reports.Include(r => r.AllocatedUnit).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);

    public Task<List<Report>> GetByReporterIdAsync(Guid reporterId, CancellationToken ct = default) =>
        db.Reports.Include(r => r.AllocatedUnit).Where(r => r.ReporterId == reporterId).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);

    public Task<List<Report>> GetByUnitAgencyAsync(ResponderUnitType agency, CancellationToken ct = default) =>
        db.Reports.Include(r => r.AllocatedUnit).Where(r => r.AllocatedUnit != null && r.AllocatedUnit.Agency == agency).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);

    public async Task AddAsync(Report report, CancellationToken ct = default)
    {
        await db.Reports.AddAsync(report, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Report report, CancellationToken ct = default)
    {
        db.Reports.Update(report);
        await db.SaveChangesAsync(ct);
    }
}

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

public class IncidentFixtureRepository(AppDbContext db) : IIncidentFixtureRepository
{
    public Task<List<IncidentFixture>> GetAllActiveAsync(CancellationToken ct = default) =>
        db.IncidentFixtures.Where(f => f.IsActive).OrderBy(f => f.Title).ToListAsync(ct);
}

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

public class SettingsRepository(AppDbContext db) : ISettingsRepository
{
    public Task<List<Settings>> GetAllAsync(CancellationToken ct = default) =>
        db.Settings.OrderBy(s => s.Category).ThenBy(s => s.Key).ToListAsync(ct);

    public Task<Settings?> GetByKeyAsync(string key, CancellationToken ct = default) =>
        db.Settings.FirstOrDefaultAsync(s => s.Key.ToLower() == key.Trim().ToLower(), ct);

    public async Task UpdateAsync(Settings setting, CancellationToken ct = default)
    {
        db.Settings.Update(setting);
        await db.SaveChangesAsync(ct);
    }
}

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
