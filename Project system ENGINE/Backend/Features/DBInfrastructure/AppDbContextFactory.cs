// [Layer: Backend/DBInfrastructure]
// Responsibility: Provides design-time DbContext instantiation for EF Core migrations across multiple RDBMS providers.
// DO NOT hardcode sensitive connection credentials into source code.

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Backend.Features.Data;
using Backend.Features.Helpers.Infrastructure;

namespace Backend.Features.DBInfrastructure;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        RuntimePortabilityHelper.LoadOptionalDotEnv(
            Directory.GetCurrentDirectory(),
            AppContext.BaseDirectory);

        var basePath = ResolveConfigurationBasePath();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddJsonFile("appsettings.Local.json", optional: true)
            .AddJsonFile(Path.Combine("LocalConfig", "appsettings.Local.json"), optional: true)
            .AddEnvironmentVariables()
            .Build();

        var dbProvider =
            Environment.GetEnvironmentVariable("DatabaseProvider")
            ?? Environment.GetEnvironmentVariable("DATABASE_PROVIDER")
            ?? configuration["DatabaseProvider"]
            ?? "SqlServer";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.ConfigureWarnings(w =>
            w.Log(RelationalEventId.PendingModelChangesWarning));

        switch (dbProvider.ToLowerInvariant())
        {
            case "postgresql":
            case "postgres":
            case "npgsql":
                var pgConnection = ResolvePostgreSqlConnectionString(configuration);
                optionsBuilder.UseNpgsql(pgConnection, pg => pg.MigrationsAssembly("Backend"));
                break;

            case "mysql":
            case "mariadb":
                var mySqlConnection = configuration.GetConnectionString("MySqlConnection")
                    ?? configuration.GetConnectionString("DefaultConnection")
                    ?? "Server=localhost;Port=3306;Database=ResQTrackDb;User=root;Password=;";
                ServerVersion serverVersion;
                try
                {
                    serverVersion = ServerVersion.AutoDetect(mySqlConnection);
                }
                catch
                {
                    serverVersion = new MySqlServerVersion(new Version(8, 0, 36));
                }
                optionsBuilder.UseMySql(mySqlConnection, serverVersion, my => my.MigrationsAssembly("Backend"));
                break;

            case "sqlserver":
            case "mssql":
            default:
                var sqlConnection = RuntimePortabilityHelper.ResolveSqlServerConnectionString(configuration);
                optionsBuilder.UseSqlServer(sqlConnection, sql => sql.MigrationsAssembly("Backend"));
                break;
        }

        return new AppDbContext(optionsBuilder.Options);
    }

    private static string ResolveConfigurationBasePath()
    {
        string cwd = Directory.GetCurrentDirectory();
        if (File.Exists(Path.Combine(cwd, "appsettings.json")))
        {
            return cwd;
        }

        string nestedBackend = Path.Combine(cwd, "Project system ENGINE", "Backend");
        if (File.Exists(Path.Combine(nestedBackend, "appsettings.json")))
        {
            return nestedBackend;
        }

        if (File.Exists(Path.Combine(AppContext.BaseDirectory, "appsettings.json")))
        {
            return AppContext.BaseDirectory;
        }

        return cwd;
    }

    private static string ResolvePostgreSqlConnectionString(IConfiguration configuration)
    {
        string? explicitEnvPg = Environment.GetEnvironmentVariable("ConnectionStrings__PostgreSqlConnection");
        if (!string.IsNullOrWhiteSpace(explicitEnvPg))
        {
            return explicitEnvPg;
        }

        string? pgDb = Environment.GetEnvironmentVariable("POSTGRES_DB");
        string? pgUser = Environment.GetEnvironmentVariable("POSTGRES_USER");
        string? pgPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD");
        string? pgPort = Environment.GetEnvironmentVariable("POSTGRES_PORT");
        string? pgHost = Environment.GetEnvironmentVariable("POSTGRES_HOST");

        if (!string.IsNullOrWhiteSpace(pgDb) || !string.IsNullOrWhiteSpace(pgUser) || !string.IsNullOrWhiteSpace(pgPassword))
        {
            return $"Host={pgHost ?? "localhost"};Port={pgPort ?? "5432"};Database={pgDb ?? "ResQTrackDb"};Username={pgUser ?? "postgres"};Password={pgPassword ?? "YourPassword123!"};";
        }

        return configuration.GetConnectionString("PostgreSqlConnection")
            ?? configuration.GetConnectionString("PostgreSqlConnection_Docker")
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=ResQTrackDb;Username=postgres;Password=YourPassword123!;";
    }
}
