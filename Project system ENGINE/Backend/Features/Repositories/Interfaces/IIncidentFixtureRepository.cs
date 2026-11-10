// [Layer: Backend/Repositories/Interfaces]
// Responsibility: Defines data access contract for tactical incident fixtures and map simulation markers.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Data.Models;

namespace Backend.Features.Repositories.Interfaces;

public interface IIncidentFixtureRepository
{
    Task<List<IncidentFixture>> GetAllActiveAsync(CancellationToken ct = default);
}
