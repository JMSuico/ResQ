// [Layer: Backend]
// Responsibility: Configures dependency injection, EF Core database context, middleware pipeline, and OpenAPI.
// DO NOT bypass GlobalExceptionMiddleware or SessionVerificationMiddleware in the HTTP pipeline.

using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using Backend.Features.Api.Middleware;
using Backend.Features.Data;
using Backend.Features.DBInfrastructure;
using Backend.Features.Management.Commands;
using Backend.Features.Repositories.Implementations;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Explicitly bind Kestrel to 0.0.0.0:5000 to listen on all interfaces (127.0.0.1 and localhost under IPv4/IPv6)
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// Add Controllers and JSON Options
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

// Add OpenAPI
builder.Services.AddOpenApi();

// Configure EF Core with dynamic Enterprise RDBMS Provider
var dbProvider = builder.Configuration["DatabaseProvider"] ?? "SqlServer";

builder.Services.AddDbContext<AppDbContext>(options =>
{
    switch (dbProvider.ToLowerInvariant())
    {
        case "postgresql":
        case "postgres":
        case "npgsql":
            var pgConnection = builder.Configuration.GetConnectionString("PostgreSqlConnection");
            if (string.IsNullOrWhiteSpace(pgConnection))
            {
                pgConnection = builder.Configuration.GetConnectionString("DefaultConnection");
            }
            if (string.IsNullOrWhiteSpace(pgConnection))
            {
                pgConnection = "Host=localhost;Port=5432;Database=ResQTrackDb;Username=postgres;Password=YourPassword123!;";
            }
            options.UseNpgsql(pgConnection, pg => pg.MigrationsAssembly("Backend"));
            break;

        case "mysql":
        case "mariadb":
            var mySqlConnection = builder.Configuration.GetConnectionString("MySqlConnection");
            if (string.IsNullOrWhiteSpace(mySqlConnection))
            {
                mySqlConnection = builder.Configuration.GetConnectionString("DefaultConnection");
            }
            if (string.IsNullOrWhiteSpace(mySqlConnection))
            {
                mySqlConnection = "Server=localhost;Port=3306;Database=ResQTrackDb;User=root;Password=;";
            }
            ServerVersion serverVersion;
            try
            {
                serverVersion = ServerVersion.AutoDetect(mySqlConnection);
            }
            catch
            {
                serverVersion = new MySqlServerVersion(new Version(8, 0, 36));
            }
            options.UseMySql(mySqlConnection, serverVersion, my => my.MigrationsAssembly("Backend"));
            break;

        case "sqlserver":
        case "mssql":
        default:
            var sqlConnection = builder.Configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(sqlConnection))
            {
                sqlConnection = builder.Configuration.GetConnectionString("SqlServer_SqlAuth");
            }
            if (string.IsNullOrWhiteSpace(sqlConnection))
            {
                sqlConnection = builder.Configuration.GetConnectionString("SqlServer_LocalDB");
            }
            if (string.IsNullOrWhiteSpace(sqlConnection))
            {
                sqlConnection = "Server=localhost;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;";
            }
            options.UseSqlServer(sqlConnection, sql => sql.MigrationsAssembly("Backend"));
            break;
    }
});

// Dependency Injection: Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<ISessionRepository, SessionRepository>();
builder.Services.AddScoped<IReportRepository, ReportRepository>();
builder.Services.AddScoped<IDutyUnitRepository, DutyUnitRepository>();
builder.Services.AddScoped<IIncidentFixtureRepository, IncidentFixtureRepository>();
builder.Services.AddScoped<IAlertRepository, AlertRepository>();
builder.Services.AddScoped<ISettingsRepository, SettingsRepository>();
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();

// Dependency Injection: Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ITriageService, TriageService>();
builder.Services.AddScoped<IRespondersService, RespondersService>();
builder.Services.AddScoped<IUserGovernanceService, UserGovernanceService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();

// CORS configuration for React 19 Frontend
builder.Services.AddCors(options => options.AddPolicy("AllowViteFrontend", policy =>
    policy.WithOrigins(
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000")
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials()));

var app = builder.Build();

// Run Database Migrations & Initial Seeder
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.EnsureCreatedAsync();
        try
        {
            await db.Database.ExecuteSqlRawAsync(@"
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='AuditLogs' AND COLUMN_NAME='PreviousHash')
                BEGIN
                    ALTER TABLE [AuditLogs] ALTER COLUMN [PreviousHash] NVARCHAR(128) NOT NULL;
                    ALTER TABLE [AuditLogs] ALTER COLUMN [CurrentHash] NVARCHAR(128) NOT NULL;
                END");
        }
        catch { }
        await DatabaseSeeder.SeedAsync(db, app.Environment);
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Database initialization or seeding encountered an issue. Ensure SQL Server is reachable.");
    }
}

// CLI Management Command Mode: Only execute and exit if genuine CLI management command is provided
if (args.Length > 0 && CliCommandRunner.IsCliCommand(args))
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await CliCommandRunner.RunAsync(args, db);
    }
    Environment.Exit(0);
}

// Exception Handling Middleware
app.UseMiddleware<GlobalExceptionMiddleware>();

// OpenAPI / Scalar Documentation (Always available for interactive API inspection & testing)
app.MapOpenApi();
app.MapScalarApiReference(options =>
{
    options.Title = "ResQTrack Multi-Agency Tactical Web API";
    options.Theme = ScalarTheme.Mars;
    options.WithOpenApiRoutePattern("/openapi/v1.json");
});

// Safety redirects for Scalar relative path resolution
app.MapGet("/scalar/openapi/v1.json", () => Results.Redirect("/openapi/v1.json"));
app.MapGet("/scalar/v1/scalar.js", () => Results.Redirect("/scalar/scalar.js"));
app.MapGet("/scalar/v1/scalar.aspnetcore.js", () => Results.Redirect("/scalar/scalar.aspnetcore.js"));

app.UseCors("AllowViteFrontend");

// Session Verification Middleware (re-checks database status per request)
app.UseMiddleware<SessionVerificationMiddleware>();

app.MapControllers();

app.Run();
