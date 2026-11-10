// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core data access for emergency incident reports using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Repositories.Implementations;

public class ReportRepository(AppDbContext db) : IReportRepository
{
    public Task<Report?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Reports.Include(r => r.AllocatedUnit).FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<List<Report>> GetAllAsync(CancellationToken ct = default) =>
        db.Reports.Include(r => r.AllocatedUnit).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);

    public Task<List<Report>> GetByReporterIdAsync(Guid reporterId, CancellationToken ct = default) =>
        db.Reports.Include(r => r.AllocatedUnit).Where(r => r.ReporterId == reporterId).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);

    public Task<List<Report>> GetByUnitAgencyAsync(ResponderUnitType agency, CancellationToken ct = default) =>
        db.Reports
            .Include(r => r.AllocatedUnit)
            .Where(r => (r.AllocatedUnit != null && r.AllocatedUnit.Agency == agency) ||
                        (r.AllocatedUnitId == null && r.RecommendedAgencyUnit != null &&
                         (r.RecommendedAgencyUnit.Contains(agency.ToString()) ||
                          (agency == ResponderUnitType.RHU && r.RecommendedAgencyUnit.Contains("Medical")) ||
                          (agency == ResponderUnitType.FIRE && r.RecommendedAgencyUnit.Contains("FIRE")) ||
                          (agency == ResponderUnitType.PNP && r.RecommendedAgencyUnit.Contains("Police")) ||
                          r.RecommendedAgencyUnit.Contains("Joint Dispatch"))))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

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
