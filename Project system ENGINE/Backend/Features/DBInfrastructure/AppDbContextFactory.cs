// [Layer: Backend/DBInfrastructure]
// Responsibility: Provides design-time DbContext instantiation for EF Core migrations across multiple RDBMS providers.
// DO NOT hardcode sensitive connection credentials into source code.

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Backend.Features.Data;

namespace Backend.Features.DBInfrastructure;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var basePath = Directory.GetCurrentDirectory();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var dbProvider = configuration["DatabaseProvider"] ?? "SqlServer";
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        switch (dbProvider.ToLowerInvariant())
        {
            case "postgresql":
            case "postgres":
            case "npgsql":
                var pgConnection = configuration.GetConnectionString("PostgreSqlConnection")
                    ?? configuration.GetConnectionString("DefaultConnection")
                    ?? "Host=localhost;Port=5432;Database=ResQTrackDb;Username=postgres;Password=YourPassword123!;";
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
                var sqlConnection = configuration.GetConnectionString("DefaultConnection")
                    ?? configuration.GetConnectionString("SqlServer_SqlAuth")
                    ?? configuration.GetConnectionString("SqlServer_LocalDB")
                    ?? "Server=localhost;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;";
                optionsBuilder.UseSqlServer(sqlConnection, sql => sql.MigrationsAssembly("Backend"));
                break;
        }

        return new AppDbContext(optionsBuilder.Options);
    }
}
