// [Layer: Backend/Repositories/Implementations]
// Responsibility: Implements EF Core data access for active incident fixtures using Universal Lambdas (=>).
// Zero emojis.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;

namespace Backend.Features.Repositories.Implementations;

public class IncidentFixtureRepository(AppDbContext db) : IIncidentFixtureRepository
{
    public Task<List<IncidentFixture>> GetAllActiveAsync(CancellationToken ct = default) =>
        db.IncidentFixtures.Where(f => f.IsActive).OrderBy(f => f.Title).ToListAsync(ct);
}
