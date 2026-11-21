// [Layer: Backend/Management/Commands]
// Responsibility: Handles CLI management operations (superadmin, custom admin, responder, civilian, adduser, password reset, user listing, deletion, and EF migrations).
// DO NOT start the ASP.NET HTTP pipeline when executing CLI management commands.

using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.DBInfrastructure;
using Backend.Features.Helpers.Infrastructure;

namespace Backend.Features.Management.Commands;

public static class CliCommandRunner
{
    public static string[] NormalizeArgs(string[] rawArgs)
    {
        var args = rawArgs ?? [];
        if (args.Length > 0 && args[0] == "--")
        {
            args = args.Skip(1).ToArray();
        }

        // Handle `docker compose run --rm resqtrack-backend dotnet Backend.dll <command>` where ENTRYPOINT is already `dotnet Backend.dll`
        if (args.Length >= 2 &&
            args[0].Equals("dotnet", StringComparison.OrdinalIgnoreCase) &&
            args[1].Equals("Backend.dll", StringComparison.OrdinalIgnoreCase))
        {
            args = args.Skip(2).ToArray();
        }

        if (args.Length > 0 && args[0] == "--")
        {
            args = args.Skip(1).ToArray();
        }

        return args;
    }

    public static string? NormalizeCommandName(string[] rawArgs)
    {
        var args = NormalizeArgs(rawArgs);
        if (args.Length == 0 || args[0].StartsWith("--") || args[0].StartsWith("/"))
        {
            return null;
        }

        return args[0].TrimStart('-').ToLowerInvariant();
    }

    public static bool IsCliCommand(string[] rawArgs) =>
        NormalizeCommandName(rawArgs) switch
        {
            "createsuperadmin" or "customcreatesuperadmin" or "createcustomsuperadmin" or
            "createresponder" or "createresponders" or "customcreateresponderuser" or "createcustomresponderuser" or "customcreateresponder" or "createcustomresponder" or
            "createcivilian" or "createcivilians" or "customercreatecivilianuser" or "customcreatecivilianuser" or "createcustomcivilianuser" or "createcustomcivilian" or "customcreatecivilian" or
            "adduser" or "edituser" or "resetpassword" or
            "listcliusers" or "deletecliuser" or "deletesuperadmin" or
            "deleteallcliusers" or "updatedatabase" or "addmigration" => true,
            _ => false
        };

    public static async Task RunAsync(string[] rawArgs, AppDbContext db)
    {
        var args = NormalizeArgs(rawArgs);
        if (args.Length == 0)
        {
            PrintUsage();
            return;
        }

        var command = args[0].TrimStart('-').ToLowerInvariant();

        try
        {
            switch (command)
            {
                case "createsuperadmin":
                case "customcreatesuperadmin":
                case "createcustomsuperadmin":
                    await HandleCreateSuperAdminAsync(args, db);
                    break;

                case "createresponder":
                case "createresponders":
                case "customcreateresponderuser":
                case "createcustomresponderuser":
                case "customcreateresponder":
                case "createcustomresponder":
                    await HandleCreateResponderAsync(args, db);
                    break;

                case "createcivilian":
                case "createcivilians":
                case "customercreatecivilianuser":
                case "customcreatecivilianuser":
                case "createcustomcivilianuser":
                case "createcustomcivilian":
                case "customcreatecivilian":
                    await HandleCreateCivilianAsync(args, db);
                    break;

                case "adduser":
                    await HandleAddUserAsync(args, db);
                    break;

                case "edituser":
                    await HandleEditUserAsync(args, db);
                    break;

                case "resetpassword":
                    await HandleResetPasswordAsync(args, db);
                    break;

                case "listcliusers":
                    await HandleListCliUsersAsync(db);
                    break;

                case "deletecliuser":
                    await HandleDeleteCliUserAsync(args, db);
                    break;

                case "deletesuperadmin":
                    await HandleDeleteSuperAdminAsync(args, db);
                    break;

                case "deleteallcliusers":
                    await HandleDeleteAllCliUsersAsync(db);
                    break;

                case "updatedatabase":
                    await HandleUpdateDatabaseAsync(db);
                    break;

                case "addmigration":
                    await HandleAddMigrationAsync(args);
                    break;

                case "help":
                case "h":
                case "?":
                    PrintUsage();
                    break;

                default:
                    Console.WriteLine($"[CLI_ERROR] Unknown command: '{args[0]}'");
                    PrintUsage();
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CLI_ERROR] Exception executing '{command}': {ex.Message}");
        }
    }

    private static string PromptRequiredInput(string promptLabel)
    {
        Console.Write($"{promptLabel}: ");
        return (Console.ReadLine() ?? string.Empty).Trim();
    }

    private static ResponderUnitType? TryParseResponderPhaseOption(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        return input.Trim().ToLowerInvariant() switch
        {
            "1" or "rhu" or "medic" or "medical" or "rhu/medic" => ResponderUnitType.RHU,
            "2" or "fire" or "bfp" or "fire/bfp" => ResponderUnitType.FIRE,
            "3" or "pnp" or "police" or "pnp/police" => ResponderUnitType.PNP,
            _ => null
        };
    }

    private static async Task HandleCreateSuperAdminAsync(string[] args, AppDbContext db)
    {
        string email = args.Length > 1 ? args[1].Trim() : string.Empty;
        string password = args.Length > 2 ? args[2] : string.Empty;

        if (string.IsNullOrWhiteSpace(email))
        {
            email = PromptRequiredInput("Input Email");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            password = PromptRequiredInput("Input Password");
        }

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine("[CLI_ERROR] Usage: customcreatesuperadmin <email> <password>");
            return;
        }

        string fullName = args.Length > 3 && !string.IsNullOrWhiteSpace(args[3]) ? args[3].Trim() : "LDRRMO Executive Admin";
        ResponderUnitType unit = args.Length > 4 ? ParseUnit(args[4], UserRole.LDRRMO_Admin) : ResponderUnitType.LDRRMO;

        await UpsertCliUserAsync(
            db: db,
            email: email,
            password: password,
            fullName: fullName,
            role: UserRole.LDRRMO_Admin,
            unit: unit,
            employeeOrResidentId: "LDRRMO-" + Guid.NewGuid().ToString("N")[..6].ToUpper(),
            overrideEmployeeIdOnUpdate: false,
            departmentOrBarangay: "Command & Operations Center",
            rankOrTitle: "Executive Director",
            barangay: null,
            label: "Super Admin");
    }

    private static async Task HandleCreateResponderAsync(string[] args, AppDbContext db)
    {
        ResponderUnitType? selectedUnit = null;
        string email = string.Empty;
        string password = string.Empty;
        string? explicitFullName = null;

        if (args.Length >= 4)
        {
            // Support either:
            //   1) customcreateresponderuser <1|2|3|RHU|FIRE|PNP> <email> <password>
            //   2) createresponder <email> <password> <1|2|3|RHU|FIRE|PNP> [fullName]
            var firstAsUnit = TryParseResponderPhaseOption(args[1]);
            if (firstAsUnit.HasValue && args[2].Contains('@'))
            {
                selectedUnit = firstAsUnit.Value;
                email = args[2].Trim();
                password = args[3];
                if (args.Length > 4) explicitFullName = args[4];
            }
            else
            {
                email = args[1].Trim();
                password = args[2];
                selectedUnit = TryParseResponderPhaseOption(args[3]) ?? ParseUnit(args[3], UserRole.Responder);
                if (args.Length > 4) explicitFullName = args[4];
            }
        }
        else if (args.Length == 3)
        {
            var firstAsUnit = TryParseResponderPhaseOption(args[1]);
            if (firstAsUnit.HasValue)
            {
                selectedUnit = firstAsUnit.Value;
                email = args[2].Trim();
            }
            else
            {
                email = args[1].Trim();
                password = args[2];
            }
        }
        else if (args.Length == 2)
        {
            var firstAsUnit = TryParseResponderPhaseOption(args[1]);
            if (firstAsUnit.HasValue)
            {
                selectedUnit = firstAsUnit.Value;
            }
            else
            {
                email = args[1].Trim();
            }
        }

        if (!selectedUnit.HasValue || selectedUnit.Value == ResponderUnitType.None || selectedUnit.Value == ResponderUnitType.LDRRMO)
        {
            Console.WriteLine("First Phase select Responders (1. RHU/MEDIC, 2. FIRE/BFP, 3. PNP/POLICE)");
            string phaseChoice = PromptRequiredInput("Select Responder (1-3)");
            selectedUnit = TryParseResponderPhaseOption(phaseChoice);
            if (!selectedUnit.HasValue)
            {
                Console.WriteLine("[CLI_ERROR] Invalid responder selection. Choose 1 (RHU/MEDIC), 2 (FIRE/BFP), or 3 (PNP/POLICE).");
                return;
            }
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            email = PromptRequiredInput("Input Email");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            password = PromptRequiredInput("Input Password");
        }

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine("[CLI_ERROR] Usage: customcreateresponderuser <1|2|3|RHU|FIRE|PNP> <email> <password>");
            return;
        }

        ResponderUnitType unit = selectedUnit.Value;
        string fullName = !string.IsNullOrWhiteSpace(explicitFullName) ? explicitFullName.Trim() : $"{unit} Duty Responder";

        await UpsertCliUserAsync(
            db: db,
            email: email,
            password: password,
            fullName: fullName,
            role: UserRole.Responder,
            unit: unit,
            employeeOrResidentId: $"{unit}-" + Guid.NewGuid().ToString("N")[..6].ToUpper(),
            overrideEmployeeIdOnUpdate: false,
            departmentOrBarangay: $"{unit} Operations Branch",
            rankOrTitle: $"{unit} Field Officer",
            barangay: null,
            label: $"Responder ({unit})");
    }

    private static async Task HandleCreateCivilianAsync(string[] args, AppDbContext db)
    {
        string email = args.Length > 1 ? args[1].Trim() : string.Empty;
        string password = args.Length > 2 ? args[2] : string.Empty;

        if (string.IsNullOrWhiteSpace(email))
        {
            email = PromptRequiredInput("Input Email");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            password = PromptRequiredInput("Input Password");
        }

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine("[CLI_ERROR] Usage: customercreatecivilianuser <email> <password>");
            return;
        }

        string fullName = args.Length > 3 && !string.IsNullOrWhiteSpace(args[3]) ? args[3].Trim() : "Resident Citizen";

        await UpsertCliUserAsync(
            db: db,
            email: email,
            password: password,
            fullName: fullName,
            role: UserRole.Civilian,
            unit: ResponderUnitType.None,
            employeeOrResidentId: "CIV-" + Guid.NewGuid().ToString("N")[..6].ToUpper(),
            overrideEmployeeIdOnUpdate: false,
            departmentOrBarangay: "Katipunan Municipality",
            rankOrTitle: "Resident Citizen",
            barangay: null,
            label: "Civilian");
    }

    private static async Task HandleEditUserAsync(string[] args, AppDbContext db)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("[CLI_ERROR] Usage: edituser <currentEmail> [newPassword] [newEmail]");
            return;
        }

        string currentEmail = args[1].Trim();
        string? newPassword = args.Length > 2 && args[2] != "-" && !args[2].Equals("keep", StringComparison.OrdinalIgnoreCase) ? args[2] : null;
        string? newEmail = args.Length > 3 && args[3] != "-" && !args[3].Equals("keep", StringComparison.OrdinalIgnoreCase) ? args[3].Trim() : null;

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == currentEmail.ToLower());
        if (user == null)
        {
            Console.WriteLine($"[CLI_ERROR] User with email '{currentEmail}' not found.");
            return;
        }

        if (!string.IsNullOrWhiteSpace(newPassword))
        {
            if (newPassword.Length < ScryptPasswordHelper.MinimumPasswordLength)
            {
                Console.WriteLine($"[CLI_ERROR] Password must be at least {ScryptPasswordHelper.MinimumPasswordLength} characters long.");
                return;
            }
            var (hash, salt) = ScryptPasswordHelper.HashPassword(newPassword);
            user.PasswordHash = hash;
            user.PasswordSalt = salt;
        }

        if (!string.IsNullOrWhiteSpace(newEmail) && !newEmail.Equals(currentEmail, StringComparison.OrdinalIgnoreCase))
        {
            var exists = await db.Users.AnyAsync(u => u.Email.ToLower() == newEmail.ToLower() && u.Id != user.Id);
            if (exists)
            {
                Console.WriteLine($"[CLI_ERROR] Email '{newEmail}' is already taken by another account.");
                return;
            }
            user.Email = newEmail;
        }

        user.UpdatedAt = DateTime.UtcNow;

        var sessions = await db.Sessions.Where(s => s.UserId == user.Id && !s.IsRevoked).ToListAsync();
        foreach (var s in sessions) s.IsRevoked = true;

        await db.SaveChangesAsync();
        Console.WriteLine($"[CLI] User '{currentEmail}' updated successfully. (Active Email: '{user.Email}')");
    }

    private static async Task HandleAddUserAsync(string[] args, AppDbContext db)
    {
        if (args.Length < 5)
        {
            Console.WriteLine("[CLI_ERROR] Usage: adduser <email> <password> <fullName> <role> [unit] [employeeOrResidentId]");
            return;
        }

        string email = args[1].Trim();
        string password = args[2];
        string fullName = args[3].Trim();
        UserRole role = ParseRole(args[4]);
        ResponderUnitType unit = args.Length > 5 ? ParseUnit(args[5], role) : ParseUnit(null, role);
        bool hasCustomId = args.Length > 6 && !string.IsNullOrWhiteSpace(args[6]);
        string employeeOrResidentId = hasCustomId ? args[6].Trim() : $"{role}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        await UpsertCliUserAsync(
            db: db,
            email: email,
            password: password,
            fullName: fullName,
            role: role,
            unit: unit,
            employeeOrResidentId: employeeOrResidentId,
            overrideEmployeeIdOnUpdate: hasCustomId,
            departmentOrBarangay: role == UserRole.Civilian ? "Barangay Local" : $"{unit} Operations",
            rankOrTitle: role == UserRole.Civilian ? "Resident Citizen" : "Operational Personnel",
            barangay: null,
            label: $"User ({role}, Unit: {unit})");
    }

    private static async Task UpsertCliUserAsync(
        AppDbContext db,
        string email,
        string password,
        string fullName,
        UserRole role,
        ResponderUnitType unit,
        string employeeOrResidentId,
        bool overrideEmployeeIdOnUpdate,
        string departmentOrBarangay,
        string rankOrTitle,
        string? barangay,
        string label)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < ScryptPasswordHelper.MinimumPasswordLength)
        {
            Console.WriteLine($"[CLI_ERROR] Password must be at least {ScryptPasswordHelper.MinimumPasswordLength} characters long.");
            return;
        }

        var (hash, salt) = ScryptPasswordHelper.HashPassword(password);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

        if (user != null)
        {
            user.FullName = fullName;
            user.PasswordHash = hash;
            user.PasswordSalt = salt;
            user.Role = role;
            user.Unit = unit;
            if (overrideEmployeeIdOnUpdate) user.EmployeeOrResidentId = employeeOrResidentId;
            if (!string.IsNullOrWhiteSpace(barangay))
            {
                user.Barangay = barangay;
                user.DepartmentOrBarangay = departmentOrBarangay;
            }
            user.Status = AccountStatus.Verified;
            user.FaceVerified = true;
            user.UpdatedAt = DateTime.UtcNow;

            db.Users.Update(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] {label} user '{email}' updated successfully.");
        }
        else
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                FullName = fullName,
                EmployeeOrResidentId = employeeOrResidentId,
                PasswordHash = hash,
                PasswordSalt = salt,
                Role = role,
                Unit = unit,
                Status = AccountStatus.Verified,
                FaceVerified = true,
                DepartmentOrBarangay = departmentOrBarangay,
                Barangay = barangay ?? string.Empty,
                RankOrTitle = rankOrTitle,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await db.Users.AddAsync(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] {label} user '{email}' created successfully.");
        }
    }

    private static async Task HandleResetPasswordAsync(string[] args, AppDbContext db)
    {
        if (args.Length < 3)
        {
            Console.WriteLine("[CLI_ERROR] Usage: resetpassword <email> <newPassword>");
            return;
        }

        string email = args[1].Trim();
        string newPassword = args[2];

        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < ScryptPasswordHelper.MinimumPasswordLength)
        {
            Console.WriteLine($"[CLI_ERROR] Password must be at least {ScryptPasswordHelper.MinimumPasswordLength} characters long.");
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
        if (user == null)
        {
            Console.WriteLine($"[CLI_ERROR] User with email '{email}' not found.");
            return;
        }

        var (hash, salt) = ScryptPasswordHelper.HashPassword(newPassword);
        user.PasswordHash = hash;
        user.PasswordSalt = salt;
        user.UpdatedAt = DateTime.UtcNow;

        // Revoke active sessions for security
        var activeSessions = await db.Sessions.Where(s => s.UserId == user.Id && !s.IsRevoked).ToListAsync();
        foreach (var session in activeSessions)
        {
            session.IsRevoked = true;
        }

        await db.SaveChangesAsync();
        Console.WriteLine($"[CLI] Password for user '{email}' reset successfully.");
    }

    private static async Task HandleListCliUsersAsync(AppDbContext db)
    {
        var users = await db.Users.AsNoTracking().OrderBy(u => u.CreatedAt).ToListAsync();

        var userDtos = users.Select(u => new
        {
            id = u.Id.ToString(),
            email = u.Email,
            fullName = u.FullName,
            role = u.Role.ToString(),
            roleId = (int)u.Role,
            unit = u.Unit.ToString(),
            unitId = (int)u.Unit,
            status = u.Status.ToString(),
            statusId = (int)u.Status,
            faceVerified = u.FaceVerified,
            employeeOrResidentId = u.EmployeeOrResidentId,
            phoneNumber = u.PhoneNumber,
            departmentOrBarangay = u.DepartmentOrBarangay,
            rankOrTitle = u.RankOrTitle,
            createdAt = u.CreatedAt.ToString("o"),
            updatedAt = u.UpdatedAt.ToString("o")
        }).ToList();

        var json = JsonSerializer.Serialize(userDtos, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        Console.WriteLine("[CLI_USERS_JSON_BEGIN]");
        Console.WriteLine(json);
        Console.WriteLine("[CLI_USERS_JSON_END]");
    }

    private static async Task HandleDeleteCliUserAsync(string[] args, AppDbContext db)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("[CLI_ERROR] Usage: deletecliuser <email>");
            return;
        }

        string email = args[1].Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
        if (user == null)
        {
            Console.WriteLine($"[CLI_ERROR] User with email '{email}' not found.");
            return;
        }

        // Clean up foreign-key dependent rows
        var sessions = await db.Sessions.Where(s => s.UserId == user.Id).ToListAsync();
        if (sessions.Count > 0) db.Sessions.RemoveRange(sessions);

        var alertStates = await db.AlertReadStates.Where(a => a.UserId == user.Id).ToListAsync();
        if (alertStates.Count > 0) db.AlertReadStates.RemoveRange(alertStates);

        var reports = await db.Reports.Where(r => r.ReporterId == user.Id).ToListAsync();
        if (reports.Count > 0) db.Reports.RemoveRange(reports);

        var verifiedReports = await db.Reports.Where(r => r.VerifiedByAdminId == user.Id).ToListAsync();
        foreach (var r in verifiedReports) r.VerifiedByAdminId = null;

        var settings = await db.Settings.Where(s => s.UpdatedByUserId == user.Id).ToListAsync();
        foreach (var s in settings) s.UpdatedByUserId = null;

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        Console.WriteLine($"[CLI] User '{email}' deleted successfully.");
    }

    private static async Task HandleDeleteSuperAdminAsync(string[] args, AppDbContext db)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("[CLI_ERROR] Usage: deletesuperadmin <email>");
            return;
        }

        string email = args[1].Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
        if (user == null)
        {
            Console.WriteLine($"[CLI_ERROR] Super Admin user with email '{email}' not found.");
            return;
        }

        db.Sessions.RemoveRange(await db.Sessions.Where(s => s.UserId == user.Id).ToListAsync());
        db.AlertReadStates.RemoveRange(await db.AlertReadStates.Where(a => a.UserId == user.Id).ToListAsync());

        var verifiedReports = await db.Reports.Where(r => r.VerifiedByAdminId == user.Id).ToListAsync();
        foreach (var r in verifiedReports)
        {
            r.VerifiedByAdminId = null;
        }

        var settings = await db.Settings.Where(s => s.UpdatedByUserId == user.Id).ToListAsync();
        foreach (var s in settings)
        {
            s.UpdatedByUserId = null;
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        Console.WriteLine($"[CLI] Super Admin user '{email}' deleted successfully.");
    }

    private static async Task HandleDeleteAllCliUsersAsync(AppDbContext db)
    {
        var sessions = await db.Sessions.ToListAsync();
        if (sessions.Count > 0) db.Sessions.RemoveRange(sessions);

        var alertStates = await db.AlertReadStates.ToListAsync();
        if (alertStates.Count > 0) db.AlertReadStates.RemoveRange(alertStates);

        var reports = await db.Reports.ToListAsync();
        if (reports.Count > 0) db.Reports.RemoveRange(reports);

        var users = await db.Users.ToListAsync();
        if (users.Count > 0) db.Users.RemoveRange(users);

        await db.SaveChangesAsync();
        Console.WriteLine($"[CLI] All {users.Count} users deleted successfully.");
    }

    private static async Task HandleUpdateDatabaseAsync(AppDbContext db)
    {
        var migrations = db.Database.GetMigrations().ToList();
        if (migrations.Count > 0)
        {
            try
            {
                await db.Database.MigrateAsync();
                await StartupSchemaReconciler.ReconcileAsync(db, NullLogger.Instance);
                Console.WriteLine($"[CLI] Database migrations applied ({migrations.Count} registered) and schema reconciled successfully.");
                return;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CLI_WARN] MigrateAsync fell back to schema reconciliation ({ex.Message}).");
            }
        }

        await db.Database.EnsureCreatedAsync();
        await StartupSchemaReconciler.ReconcileAsync(db, NullLogger.Instance);
        Console.WriteLine("[CLI] Database schema ensured and reconciled successfully.");
    }

    private static async Task HandleAddMigrationAsync(string[] args)
    {
        if (args.Length < 2 || string.IsNullOrWhiteSpace(args[1]))
        {
            Console.WriteLine("[CLI_ERROR] Usage: addmigration <MigrationName>");
            return;
        }

        string migrationName = args[1].Trim();
        if (!Regex.IsMatch(migrationName, "^[A-Za-z_][A-Za-z0-9_]*$"))
        {
            Console.WriteLine("[CLI_ERROR] Invalid migration name. Use alphanumeric characters and underscores only.");
            return;
        }

        string? projectDir = ResolveBackendProjectDirectory();
        if (projectDir == null)
        {
            Console.WriteLine("[CLI_ERROR] 'addmigration' requires Backend.csproj and the .NET SDK. Run '.\\start.ps1 addmigration <Name>' or 'dotnet ef migrations add <Name>' inside 'Project system ENGINE/Backend'.");
            return;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = "dotnet",
            Arguments = $"ef migrations add {migrationName}",
            WorkingDirectory = projectDir,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };

        using var process = Process.Start(startInfo);
        if (process == null)
        {
            Console.WriteLine("[CLI_ERROR] Failed to launch 'dotnet ef migrations add'. Ensure dotnet-ef is installed.");
            return;
        }

        string stdout = await process.StandardOutput.ReadToEndAsync();
        string stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        if (!string.IsNullOrWhiteSpace(stdout)) Console.WriteLine(stdout.TrimEnd());
        if (!string.IsNullOrWhiteSpace(stderr)) Console.WriteLine(stderr.TrimEnd());

        Console.WriteLine(process.ExitCode == 0
            ? $"[CLI] Migration '{migrationName}' created successfully."
            : $"[CLI_ERROR] 'dotnet ef migrations add {migrationName}' failed with exit code {process.ExitCode}.");
    }

    private static string? ResolveBackendProjectDirectory()
    {
        string[] probeRoots = [Directory.GetCurrentDirectory(), AppContext.BaseDirectory];
        foreach (string root in probeRoots)
        {
            string? current = Path.GetFullPath(root);
            for (int depth = 0; depth < 5 && !string.IsNullOrEmpty(current); depth++)
            {
                if (File.Exists(Path.Combine(current, "Backend.csproj")))
                {
                    return current;
                }

                string nested = Path.Combine(current, "Project system ENGINE", "Backend");
                if (File.Exists(Path.Combine(nested, "Backend.csproj")))
                {
                    return nested;
                }

                current = Directory.GetParent(current)?.FullName;
            }
        }

        return null;
    }

    private static UserRole ParseRole(string roleStr)
    {
        var trimmed = roleStr.Trim().ToLowerInvariant();
        return trimmed switch
        {
            "1" or "admin" or "superadmin" or "ldrrmo_admin" or "ldrrmo" => UserRole.LDRRMO_Admin,
            "2" or "responder" or "medic" or "fire" or "police" or "pnp" => UserRole.Responder,
            "3" or "civilian" or "resident" or "citizen" => UserRole.Civilian,
            _ => Enum.TryParse<UserRole>(roleStr, true, out var parsed) ? parsed : UserRole.Civilian
        };
    }

    private static ResponderUnitType ParseUnit(string? unitStr, UserRole role = UserRole.Civilian)
    {
        if (string.IsNullOrWhiteSpace(unitStr))
        {
            return role switch
            {
                UserRole.LDRRMO_Admin => ResponderUnitType.LDRRMO,
                UserRole.Responder => ResponderUnitType.RHU,
                _ => ResponderUnitType.None
            };
        }

        var trimmed = unitStr.Trim().ToLowerInvariant();
        return trimmed switch
        {
            "0" or "none" => ResponderUnitType.None,
            "1" or "ldrrmo" => ResponderUnitType.LDRRMO,
            "2" or "rhu" or "medical" or "medic" => ResponderUnitType.RHU,
            "3" or "fire" or "bfp" => ResponderUnitType.FIRE,
            "4" or "pnp" or "police" => ResponderUnitType.PNP,
            "5" or "security" => ResponderUnitType.Security,
            _ => Enum.TryParse<ResponderUnitType>(unitStr, true, out var parsed) ? parsed : ResponderUnitType.None
        };
    }

    private static void PrintUsage()
    {
        Console.WriteLine("ResQTrack Backend CLI Management Commands:");
        Console.WriteLine("  customcreatesuperadmin [email] [password]              (Prompts Input Email & Input Password only)");
        Console.WriteLine("  createsuperadmin <email> <password>                    (Alias for customcreatesuperadmin)");
        Console.WriteLine("  customcreateresponderuser [1|2|3] [email] [password]   (Phase 1: 1. RHU/MEDIC, 2. FIRE/BFP, 3. PNP/POLICE -> Input Email & Input Password only)");
        Console.WriteLine("  createresponder <1|2|3|RHU|FIRE|PNP> <email> <password>");
        Console.WriteLine("  customercreatecivilianuser [email] [password]          (Prompts Input Email & Input Password only)");
        Console.WriteLine("  createcivilian <email> <password>                      (Alias for customercreatecivilianuser)");
        Console.WriteLine("  edituser <email> [newPassword] [newEmail]");
        Console.WriteLine("  resetpassword <email> <newPassword>");
        Console.WriteLine("  listcliusers");
        Console.WriteLine("  deletecliuser <email>");
        Console.WriteLine("  deletesuperadmin <email>");
        Console.WriteLine("  deleteallcliusers");
        Console.WriteLine("  updatedatabase");
        Console.WriteLine("  addmigration <MigrationName>");
    }
}
