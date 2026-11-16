// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Cross-PC runtime portability helpers for optional .env loading, dynamic Kestrel URL binding,
// resilient SQL Server instance resolution across Windows/Linux hosts, and LAN/Docker CORS origin evaluation.

using System.Net;
using System.Net.Sockets;

namespace Backend.Features.Helpers.Infrastructure;

public static class RuntimePortabilityHelper
{
    private const string FallbackListenUrl = "http://0.0.0.0:1999";

    /// <summary>
    /// Loads key=value entries from an optional .env file in the current directory or parent workspace directories
    /// without overriding variables already supplied by the OS process or test harness.
    /// </summary>
    public static void LoadOptionalDotEnv(params string[] probeStartPaths)
    {
        foreach (string startPath in probeStartPaths)
        {
            if (string.IsNullOrWhiteSpace(startPath))
            {
                continue;
            }

            string? current = Path.GetFullPath(startPath);
            for (int depth = 0; depth < 4 && !string.IsNullOrEmpty(current); depth++)
            {
                string candidate = Path.Combine(current, ".env");
                if (File.Exists(candidate))
                {
                    ApplyDotEnvFile(candidate);
                    return;
                }

                current = Directory.GetParent(current)?.FullName;
            }
        }
    }

    private static void ApplyDotEnvFile(string envFilePath)
    {
        foreach (string rawLine in File.ReadAllLines(envFilePath))
        {
            string line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            if (line.StartsWith("export ", StringComparison.OrdinalIgnoreCase))
            {
                line = line[7..].TrimStart();
            }

            int separatorIdx = line.IndexOf('=');
            if (separatorIdx <= 0)
            {
                continue;
            }

            string key = line[..separatorIdx].Trim();
            string value = line[(separatorIdx + 1)..].Trim();

            if (value.Length >= 2 &&
                ((value.StartsWith('"') && value.EndsWith('"')) ||
                 (value.StartsWith('\'') && value.EndsWith('\''))))
            {
                value = value[1..^1];
            }

            if (!string.IsNullOrEmpty(key) && Environment.GetEnvironmentVariable(key) is null)
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }

    /// <summary>
    /// Resolves listening URLs honoring explicit CLI --urls, ASPNETCORE_URLS, PORT, or Kestrel config before fallback.
    /// </summary>
    public static string? ResolveExplicitOrFallbackServerUrl(string[] args, IConfiguration configuration)
    {
        bool hasCliUrls = args.Any(a => a.StartsWith("--urls", StringComparison.OrdinalIgnoreCase));
        if (hasCliUrls)
        {
            return null;
        }

        string? envUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
        if (!string.IsNullOrWhiteSpace(envUrls))
        {
            return null;
        }

        string? configuredKestrelUrl = configuration["Kestrel:Endpoints:Http:Url"];
        if (!string.IsNullOrWhiteSpace(configuredKestrelUrl))
        {
            return configuredKestrelUrl;
        }

        string? portEnv = Environment.GetEnvironmentVariable("PORT");
        if (!string.IsNullOrWhiteSpace(portEnv) && int.TryParse(portEnv.Trim(), out int port) && port is > 0 and <= 65535)
        {
            return $"http://0.0.0.0:{port}";
        }

        return FallbackListenUrl;
    }

    /// <summary>
    /// Resolves a SQL Server connection string cleanly across Windows Integrated Auth, Express named instances, LocalDB, and Linux SQL auth.
    /// </summary>
    public static string ResolveSqlServerConnectionString(IConfiguration configuration)
    {
        string[] candidateKeys = OperatingSystem.IsWindows()
            ? ["DefaultConnection", "SqlServer_Express01", "SqlServer_Express", "SqlServer_SqlAuth", "SqlServer_LocalDB"]
            : ["SqlServer_SqlAuth", "DefaultConnection", "SqlServer_Express01", "SqlServer_Express"];

        foreach (string key in candidateKeys)
        {
            string? candidate = configuration.GetConnectionString(key);
            if (!string.IsNullOrWhiteSpace(candidate))
            {
                return candidate;
            }
        }

        return OperatingSystem.IsWindows()
            ? "Server=localhost;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;"
            : "Server=localhost;Database=ResQTrackDb;User Id=sa;Password=YourPassword123!;TrustServerCertificate=True;MultipleActiveResultSets=true;";
    }

    /// <summary>
    /// Parses explicit CORS origins and permits localhost, loopback, .local mDNS, and RFC1918 LAN HTTP/HTTPS origins on any PC.
    /// </summary>
    public static Func<string, bool> BuildOriginPredicate(IConfiguration configuration)
    {
        HashSet<string> explicitOrigins = ParseConfiguredOrigins(
            configuration["Cors:AllowedOrigins"],
            Environment.GetEnvironmentVariable("ALLOWED_ORIGINS"));

        return origin => IsAllowedOrigin(origin, explicitOrigins);
    }

    private static HashSet<string> ParseConfiguredOrigins(params string?[] rawValues)
    {
        HashSet<string> origins = new(StringComparer.OrdinalIgnoreCase);
        foreach (string? raw in rawValues)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                continue;
            }

            foreach (string token in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                origins.Add(token.TrimEnd('/'));
            }
        }

        return origins;
    }

    private static bool IsAllowedOrigin(string origin, HashSet<string> explicitOrigins)
    {
        if (string.IsNullOrWhiteSpace(origin))
        {
            return false;
        }

        string normalized = origin.Trim().TrimEnd('/');
        if (explicitOrigins.Contains("*") || explicitOrigins.Contains(normalized))
        {
            return true;
        }

        if (!Uri.TryCreate(normalized, UriKind.Absolute, out Uri? uri))
        {
            return false;
        }

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
        {
            return false;
        }

        string host = uri.Host;
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith(".local", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!IPAddress.TryParse(host, out IPAddress? ip))
        {
            return false;
        }

        if (IPAddress.IsLoopback(ip))
        {
            return true;
        }

        if (ip.AddressFamily != AddressFamily.InterNetwork)
        {
            return false;
        }

        byte[] bytes = ip.GetAddressBytes();
        return bytes[0] == 10 ||
               (bytes[0] == 172 && bytes[1] is >= 16 and <= 31) ||
               (bytes[0] == 192 && bytes[1] == 168);
    }
}
