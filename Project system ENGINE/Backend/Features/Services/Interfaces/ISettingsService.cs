// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines system configuration settings and audit log retrieval contracts.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Models;

namespace Backend.Features.Services.Interfaces;

public interface ISettingsService
{
    Task<List<SettingResponse>> GetAllSettingsAsync(CancellationToken ct = default);
    Task<bool> UpdateSettingAsync(string key, string value, Guid adminId, CancellationToken ct = default);
    Task<List<AuditLog>> GetRecentAuditLogsAsync(int count = 50, CancellationToken ct = default);
}
