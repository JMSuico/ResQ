// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines business logic interfaces for authentication, incident reporting, triage, and governance.
// DO NOT expose raw repository or database references across service contracts.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;

namespace Backend.Features.Services.Interfaces;

public interface IAuthService
{
    Task<(bool Success, string? Error, User? User)> RegisterAsync(RegisterRequest request, string capturesRootPath, CancellationToken ct = default);
    Task<(bool Success, string? Error, string? RawToken, SessionResponse? Session)> LoginAsync(LoginRequest request, string ipAddress, string userAgent, CancellationToken ct = default);
    Task<SessionResponse?> GetSessionDetailsAsync(Guid userId, CancellationToken ct = default);
    Task RevokeSessionAsync(string rawToken, CancellationToken ct = default);
}

public interface IReportService
{
    Task<ReportResponse> CreateReportAsync(Guid reporterId, CreateReportRequest request, string reportsRootPath, CancellationToken ct = default);
    Task<List<ReportResponse>> GetAllReportsAsync(CancellationToken ct = default);
    Task<List<ReportResponse>> GetMyReportsAsync(Guid userId, CancellationToken ct = default);
    Task<List<ReportResponse>> GetAgencyReportsAsync(ResponderUnitType agency, CancellationToken ct = default);
    Task<string?> GetReportImagePathAsync(Guid reportId, CancellationToken ct = default);
}

public interface ITriageService
{
    Task<List<IncidentFixtureResponse>> GetActiveFixturesAsync(CancellationToken ct = default);
    Task<(bool Success, string? Error)> VerifyReportAsync(Guid reportId, Guid adminId, VerifyReportRequest request, CancellationToken ct = default);
    Task<(bool Success, string? Error)> AllocateUnitAsync(Guid reportId, Guid adminId, Guid unitId, CancellationToken ct = default);
}

public interface IRespondersService
{
    Task<List<DutyUnitResponse>> GetRosterAsync(CancellationToken ct = default);
    Task<(bool Success, string? Error)> UpdateUnitStatusAsync(Guid unitId, DutyStatus status, CancellationToken ct = default);
}

public interface IUserGovernanceService
{
    Task<List<UserResponse>> GetAllUsersAsync(CancellationToken ct = default);
    Task<PagedResult<UserResponse>> GetPagedUsersAsync(UserFilterParams filter, CancellationToken ct = default);
    Task<UserDetailResponse?> GetUserDetailAsync(Guid id, CancellationToken ct = default);
    Task<(bool Success, string? Error, UserResponse? User)> CreateUserAsync(CreateUserRequest request, Guid adminId, CancellationToken ct = default);
    Task<(bool Success, string? Error)> UpdateUserAsync(Guid id, UpdateUserRequest request, Guid adminId, CancellationToken ct = default);
    Task<(bool Success, string? Error)> DeleteUserAsync(Guid id, Guid adminId, string adminEmail, CancellationToken ct = default);
    Task<(bool Success, string? Error)> UpdateUserStatusAsync(Guid targetUserId, Guid adminId, AccountStatus status, CancellationToken ct = default);
    Task<string?> GetUserCapturePathAsync(Guid userId, CaptureKind kind, CancellationToken ct = default);
}

public interface ISettingsService
{
    Task<List<SettingResponse>> GetAllSettingsAsync(CancellationToken ct = default);
    Task<bool> UpdateSettingAsync(string key, string value, Guid adminId, CancellationToken ct = default);
}

public interface IAnalyticsService
{
    Task<AnalyticsSummaryResponse> GetSummaryAsync(CancellationToken ct = default);
    Task<List<TelemetryDataPoint>> GetVolume24hAsync(CancellationToken ct = default);
    Task<List<SeverityBreakdownItem>> GetSeverityBreakdownAsync(CancellationToken ct = default);
    Task<List<AgencyWorkloadItem>> GetAgencyWorkloadAsync(CancellationToken ct = default);
    Task<HeatmapMatrixResponse> GetHeatmapMatrixAsync(CancellationToken ct = default);
}
