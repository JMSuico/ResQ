// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contract for incident reports, queries, and agency scopes.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;

namespace Backend.Features.Repositories.Interfaces;

public interface IReportRepository
{
    Task<Report?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<Report>> GetAllAsync(CancellationToken ct = default);
    Task<List<Report>> GetByReporterIdAsync(Guid reporterId, CancellationToken ct = default);
    Task<List<Report>> GetByUnitAgencyAsync(ResponderUnitType agency, CancellationToken ct = default);
    Task AddAsync(Report report, CancellationToken ct = default);
    Task UpdateAsync(Report report, CancellationToken ct = default);
}
