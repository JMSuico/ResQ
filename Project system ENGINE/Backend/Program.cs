// [Layer: Backend]
// Responsibility: Configures dependency injection, EF Core database context, middleware pipeline, and OpenAPI.
// DO NOT bypass GlobalExceptionMiddleware or SessionVerificationMiddleware in the HTTP pipeline.

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Scalar.AspNetCore;
using Backend.Features.Api.Middleware;
using Backend.Features.Data;
using Backend.Features.DBInfrastructure;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Management.Commands;
using Backend.Features.Repositories.Implementations;
using Backend.Features.Repositories.Interfaces;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.IncidentVision;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;
using Backend.Features.Services.Vision;
using ResQTrack.Backend.Features.Services.Biometrics;
using ResQTrack.Backend.Features.Services.Standby;

RuntimePortabilityHelper.LoadOptionalDotEnv(
    Directory.GetCurrentDirectory(),
    AppContext.BaseDirectory);

var builder = WebApplication.CreateBuilder(args);
if (args.Length > 0 && CliCommandRunner.IsCliCommand(args))
{
    builder.Logging.ClearProviders();
}
string[] localConfigPaths =
[
    "appsettings.Local.json",
    Path.Combine("LocalConfig", "appsettings.Local.json")
];
foreach (string localConfigRelativePath in localConfigPaths)
{
    string localConfigFullPath = Path.Combine(builder.Environment.ContentRootPath, localConfigRelativePath);
    if (!Directory.Exists(localConfigFullPath) && File.Exists(localConfigFullPath))
    {
        builder.Configuration.AddJsonFile(localConfigRelativePath, optional: true, reloadOnChange: true);
    }
}
builder.Configuration.AddEnvironmentVariables();

// Honor explicit --urls / ASPNETCORE_URLS / PORT when set, otherwise bind Kestrel to 0.0.0.0:1999 for localhost + LAN/Docker access
string? fallbackBindUrl = RuntimePortabilityHelper.ResolveExplicitOrFallbackServerUrl(args, builder.Configuration);
if (!string.IsNullOrWhiteSpace(fallbackBindUrl))
{
    builder.WebHost.UseUrls(fallbackBindUrl);
}

// Add Controllers and JSON Options
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

builder.Services.AddMemoryCache();
builder.Services.AddHttpClient();
builder.Services.AddHttpClient("RoboflowServerless");

// Add OpenAPI
builder.Services.AddOpenApi();

// Configure EF Core with dynamic Enterprise RDBMS Provider
var dbProvider =
    Environment.GetEnvironmentVariable("DatabaseProvider")
    ?? Environment.GetEnvironmentVariable("DATABASE_PROVIDER")
    ?? builder.Configuration["DatabaseProvider"]
    ?? "SqlServer";

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));

    switch (dbProvider.ToLowerInvariant())
    {
        case "postgresql":
        case "postgres":
        case "npgsql":
            var pgConnection = builder.Configuration.GetConnectionString("PostgreSqlConnection");
            if (string.IsNullOrWhiteSpace(pgConnection))
            {
                pgConnection = builder.Configuration.GetConnectionString("PostgreSqlConnection_Docker");
            }
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
            var sqlConnection = RuntimePortabilityHelper.ResolveSqlServerConnectionString(builder.Configuration);
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

// Dependency Injection: Verification Strategy & Decorator Providers
builder.Services.Configure<VerificationProviderOptions>(
    builder.Configuration.GetSection(VerificationProviderOptions.SectionName));
builder.Services.AddScoped<IVerificationProviderResolver, VerificationProviderResolver>();
builder.Services.AddScoped<IIdentityVerificationProvider>(sp =>
    sp.GetRequiredService<IVerificationProviderResolver>().ResolveIdentityProvider());
builder.Services.AddScoped<IFacialVerificationProvider>(sp =>
    sp.GetRequiredService<IVerificationProviderResolver>().ResolveFacialProvider());

// Dependency Injection: Services
builder.Services.AddHttpClient<IClaudeMessagesClient, ClaudeMessagesClient>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddScoped<IIdentityAiService, IdentityAiService>();
builder.Services.AddScoped<ITriageService, TriageService>();
builder.Services.AddScoped<IResponderOpsService, RespondersService>();
builder.Services.AddScoped<IDispatchRequestService, DispatchRequestService>();
builder.Services.AddScoped<IUserGovernanceService, UserGovernanceService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();

// Dependency Injection: Verification Token Cache, Account Auto-Approval, Gov-ID Forensics & Standby AI Governance Strategies
builder.Services.AddOptions<VerificationTokenOptions>()
    .Bind(builder.Configuration.GetSection(VerificationTokenOptions.SectionName));
builder.Services.AddScoped<IVerificationTokenCacheStrategy, HmacVerificationTokenCacheStrategy>();
builder.Services.AddScoped<IAccountAutoApprovalStrategy, TokenVerifiedAutoApprovalStrategy>();
builder.Services.AddScoped<IGovIdAuthenticityEvaluator, SharedGovIdForensicsEvaluator>();
builder.Services.AddScoped<IFaceToGovIdMatchStrategy, ClaudeFaceToGovIdMatchStrategy>();
builder.Services.AddScoped<IStandbyGovIdAutoApproveStrategy, ClaudeAutoApproveGovIdStrategy>();
builder.Services.AddScoped<IStandbyResponderAutoDispatchStrategy, ClaudeAutoDispatchResponderStrategy>();
builder.Services.AddScoped<IClaudeBiometricIdentityStrategy, ClaudeCachedPoseIdentityStrategy>();
builder.Services.AddScoped<IBiometricLoginValidationStrategy, MultiLayerBiometricLoginStrategy>();
builder.Services.AddScoped<IRoboflowWorkflowStrategy, RoboflowServerlessWorkflowStrategy>();
builder.Services.AddScoped<IRoboflowAccidentDetectionStrategy, RoboflowServerlessAccidentDetectionStrategy>();
builder.Services.AddScoped<IClaudeIncidentVisionStrategy, ClaudeHaikuIncidentVisionStrategy>();
builder.Services.AddScoped<IIncidentSceneAiAnalysisStrategy, DualStageIncidentSceneAiStrategy>();
builder.Services.AddScoped<IIncidentAutoApprovalStrategy, ClaudeIncidentAutoApprovalStrategy>();
builder.Services.AddScoped<IIncidentClosureAiStrategy, ClaudeIncidentClosureAiStrategy>();
builder.Services.AddSingleton<IBiometricTrainingQueue, BiometricTrainingChannelQueue>();
builder.Services.AddHostedService<BiometricTrainingBackgroundService>();

// Configure Distributed Cache (Redis 7 Alpine with resilient In-Memory fallback)
var redisConnection = builder.Configuration.GetConnectionString("RedisConnection")
    ?? builder.Configuration["RedisConnection"]
    ?? Environment.GetEnvironmentVariable("REDIS_CONNECTION")
    ?? "localhost:6379";

if (!string.IsNullOrWhiteSpace(redisConnection) && !redisConnection.Equals("none", StringComparison.OrdinalIgnoreCase))
{
    try
    {
        var effectiveRedisConfig =
            !redisConnection.Contains("connectTimeout", StringComparison.OrdinalIgnoreCase)
            && !redisConnection.StartsWith("redis://", StringComparison.OrdinalIgnoreCase)
            && !redisConnection.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase)
                ? $"{redisConnection},connectTimeout=400,syncTimeout=400,asyncTimeout=400,connectRetry=0,abortConnect=false"
                : redisConnection;

        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = effectiveRedisConfig;
            options.InstanceName = "ResQTrack_";
        });
    }
    catch
    {
        builder.Services.AddDistributedMemoryCache();
    }
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

// CORS configuration for React 19 Frontend (Multi-Port Separation + Portable LAN / Docker Origin Support)
var isOriginAllowed = RuntimePortabilityHelper.BuildOriginPredicate(builder.Configuration);
builder.Services.AddCors(options => options.AddPolicy("AllowViteFrontend", policy =>
    policy.SetIsOriginAllowed(isOriginAllowed)
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials()));

var app = builder.Build();

// CLI Management Command Mode: Skip HTTP pipeline startup and execute directly
if (args.Length > 0 && CliCommandRunner.IsCliCommand(args))
{
    var normalizedCliCommand = CliCommandRunner.NormalizeCommandName(args);
    var isMigrationCommand = normalizedCliCommand is "addmigration" or "updatedatabase";

    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ddlLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

        if (!isMigrationCommand)
        {
            try
            {
                await db.Database.EnsureCreatedAsync();
                await StartupSchemaReconciler.ReconcileAsync(db, ddlLogger);
            }
            catch (Exception ex)
            {
                ddlLogger.LogError(ex, "CLI pre-command database initialization encountered an issue.");
            }
        }

        await CliCommandRunner.RunAsync(args, db);
    }

    Environment.Exit(0);
}

// Run Database Migrations & Initial Seeder
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var ddlLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        await StartupSchemaReconciler.ReconcileAsync(db, ddlLogger);

        if (db.Database.GetMigrations().Any())
        {
            try
            {
                await db.Database.MigrateAsync();
            }
            catch (Exception migrateEx)
            {
                ddlLogger.LogWarning(migrateEx, "EF Core MigrateAsync encountered pre-existing tables or transient condition; falling back safely via StartupSchemaReconciler.");
                await db.Database.EnsureCreatedAsync();
            }
        }
        else
        {
            await db.Database.EnsureCreatedAsync();
        }

        await StartupSchemaReconciler.ReconcileAsync(db, ddlLogger);
        await DatabaseSeeder.SeedAsync(db, app.Environment);
    }
    catch (Exception ex)
    {
        ddlLogger.LogError(ex, "Database initialization or seeding encountered an issue. Ensure database server is reachable.");
    }
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
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value;
    if (path == "/scalar/openapi/v1.json")
    {
        context.Response.Redirect("/openapi/v1.json", permanent: false);
        return;
    }
    if (path == "/scalar/v1/scalar.js")
    {
        context.Response.Redirect("/scalar/scalar.js", permanent: false);
        return;
    }
    if (path == "/scalar/v1/scalar.aspnetcore.js")
    {
        context.Response.Redirect("/scalar/scalar.aspnetcore.js", permanent: false);
        return;
    }
    await next();
});

app.UseCors("AllowViteFrontend");

// Session Verification Middleware (re-checks database status per request)
app.UseMiddleware<SessionVerificationMiddleware>();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    if (context.Request.Path.Value?.EndsWith(".mjs", StringComparison.OrdinalIgnoreCase) == true)
    {
        context.Response.ContentType = "text/javascript; charset=utf-8";
    }
    await next();
});

app.MapControllers();

app.Run();
