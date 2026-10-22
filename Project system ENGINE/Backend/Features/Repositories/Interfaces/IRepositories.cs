// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contracts for users, sessions, reports, and system entities.
// DO NOT implement business logic or HTTP concerns in repository interfaces.

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

public interface ISessionRepository
{
    Task<Session?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task AddAsync(Session session, CancellationToken ct = default);
    Task RevokeAsync(Guid sessionId, CancellationToken ct = default);
    Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default);
}

public interface IReportRepository
{
    Task<Report?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<Report>> GetAllAsync(CancellationToken ct = default);
    Task<List<Report>> GetByReporterIdAsync(Guid reporterId, CancellationToken ct = default);
    Task<List<Report>> GetByUnitAgencyAsync(ResponderUnitType agency, CancellationToken ct = default);
    Task AddAsync(Report report, CancellationToken ct = default);
    Task UpdateAsync(Report report, CancellationToken ct = default);
}

public interface IDutyUnitRepository
{
    Task<DutyUnit?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<DutyUnit>> GetAllAsync(CancellationToken ct = default);
    Task UpdateStatusAsync(Guid id, DutyStatus status, CancellationToken ct = default);
}

public interface IIncidentFixtureRepository
{
    Task<List<IncidentFixture>> GetAllActiveAsync(CancellationToken ct = default);
}

public interface IAlertRepository
{
    Task<List<AlertReadState>> GetUserAlertsAsync(Guid userId, CancellationToken ct = default);
    Task MarkAsReadAsync(Guid userId, Guid reportId, CancellationToken ct = default);
}

public interface ISettingsRepository
{
    Task<List<Settings>> GetAllAsync(CancellationToken ct = default);
    Task<Settings?> GetByKeyAsync(string key, CancellationToken ct = default);
    Task UpdateAsync(Settings setting, CancellationToken ct = default);
}

public interface IAuditLogRepository
{
    Task<string> GetLatestHashAsync(CancellationToken ct = default);
    Task AddAsync(AuditLog log, CancellationToken ct = default);
    Task<List<AuditLog>> GetRecentAsync(int count = 50, CancellationToken ct = default);
}
