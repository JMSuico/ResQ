// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines user governance, account administration, RBAC status mutations, and profile editing contracts.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;

namespace Backend.Features.Services.Interfaces;

public interface IUserGovernanceService
{
    Task<List<UserResponse>> GetAllUsersAsync(CancellationToken ct = default);
    Task<PagedResult<UserResponse>> GetPagedUsersAsync(UserFilterParams filter, CancellationToken ct = default);
    Task<UserDetailResponse?> GetUserDetailAsync(Guid id, CancellationToken ct = default);
    Task<(bool Success, string? Error, UserResponse? User)> CreateUserAsync(CreateUserRequest request, Guid adminId, CancellationToken ct = default);
    Task<(bool Success, string? Error)> UpdateUserAsync(Guid id, UpdateUserRequest request, Guid adminId, CancellationToken ct = default);
    Task<(bool Success, string? Error)> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default);
    Task<(bool Success, string? Error)> DeleteUserAsync(Guid id, Guid adminId, string adminEmail, CancellationToken ct = default);
    Task<(bool Success, string? Error)> UpdateUserStatusAsync(Guid targetUserId, Guid adminId, AccountStatus status, CancellationToken ct = default);
    Task<string?> GetUserCapturePathAsync(Guid userId, CaptureKind kind, CancellationToken ct = default);
}
