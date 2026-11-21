// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Resolves and validates client IP addresses from X-Forwarded-For or remote socket connections, stripping spoofed/malformed headers.
// Universal lambda expressions (=>). Zero emojis.

using System.Net;
using Microsoft.AspNetCore.Http;

namespace Backend.Features.Helpers.Infrastructure;

public static class ClientNetworkHelper
{
    public static string? ResolveClientIpAddress(HttpContext? httpContext)
    {
        string? rawForwarded = httpContext?.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(rawForwarded))
        {
            string? candidate = rawForwarded
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .FirstOrDefault();

            if (!string.IsNullOrWhiteSpace(candidate) && IPAddress.TryParse(candidate, out var parsedForwarded))
            {
                return (parsedForwarded.IsIPv4MappedToIPv6 ? parsedForwarded.MapToIPv4() : parsedForwarded).ToString();
            }
        }

        if (httpContext?.Connection.RemoteIpAddress is { } remote)
        {
            return (remote.IsIPv4MappedToIPv6 ? remote.MapToIPv4() : remote).ToString();
        }

        return null;
    }
}
