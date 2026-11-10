// [Layer: Backend/Services/Interfaces]
// Responsibility: Defines authentication, registration, session management, and credential verification service contracts.
// Universal lambda expressions (=>). Zero emojis.

using Backend.Features.Api.DTOs;
using Backend.Features.Data.Models;

namespace Backend.Features.Services.Interfaces;

public interface IAuthService
{
    Task<(bool Success, string? Error, User? User)> RegisterAsync(RegisterRequest request, string capturesRootPath, CancellationToken ct = default);
    Task<(bool Success, string? Error, string? RawToken, SessionResponse? Session)> LoginAsync(LoginRequest request, string ipAddress, string userAgent, CancellationToken ct = default);
    Task<SessionResponse?> GetSessionDetailsAsync(Guid userId, CancellationToken ct = default);
    Task RevokeSessionAsync(string rawToken, CancellationToken ct = default);
}
