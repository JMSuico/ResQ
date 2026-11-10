// [Layer: Backend/Services/Implementations]
// Responsibility: Implements system settings updates, reads, and audit trail retrieval.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Models;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class SettingsService(ISettingsRepository settingsRepo, IAuditLogRepository auditRepo) : ISettingsService
{
    public async Task<List<SettingResponse>> GetAllSettingsAsync(CancellationToken ct = default) =>
        (await settingsRepo.GetAllAsync(ct)).Select(s => new SettingResponse(
            s.Id, s.Key, s.Value, s.Category, s.Description, s.UpdatedAt
        )).ToList();

    public async Task<bool> UpdateSettingAsync(string key, string value, Guid adminId, CancellationToken ct = default) =>
        await ExecuteUpdateSettingAsync(key, value, adminId, ct);

    public async Task<List<AuditLog>> GetRecentAuditLogsAsync(int count = 50, CancellationToken ct = default) =>
        await auditRepo.GetRecentAsync(count, ct);

    private async Task<bool> ExecuteUpdateSettingAsync(string key, string value, Guid adminId, CancellationToken ct) =>
        await Task.Run(async () =>
        {
            var setting = await settingsRepo.GetByKeyAsync(key, ct);
            if (setting == null)
            {
                setting = new Settings
                {
                    Id = Guid.NewGuid(),
                    Key = key.Trim(),
                    Value = value,
                    Category = "Platform",
                    Description = $"Platform setting for {key}",
                    UpdatedByUserId = adminId == Guid.Empty ? null : adminId,
                    UpdatedAt = DateTime.UtcNow
                };
            }
            else
            {
                setting.Value = value;
                setting.UpdatedByUserId = adminId == Guid.Empty ? null : adminId;
                setting.UpdatedAt = DateTime.UtcNow;
            }

            await settingsRepo.UpdateAsync(setting, ct);
            return true;
        }, ct);
}
