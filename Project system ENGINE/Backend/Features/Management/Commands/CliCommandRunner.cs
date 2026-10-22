// [Layer: Backend/Management/Commands]
// Responsibility: Handles CLI management operations (superadmin, custom admin, adduser, password reset, user listing, deletion).
// DO NOT start the ASP.NET HTTP pipeline when executing CLI management commands.

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;

namespace Backend.Features.Management.Commands;

public static class CliCommandRunner
{
    public static bool IsCliCommand(string[] args) =>
        args.Length > 0 &&
        !args[0].StartsWith("--") &&
        !args[0].StartsWith("/") &&
        args[0].TrimStart('-').ToLowerInvariant() switch
        {
            "createsuperadmin" or "createcustomsuperadmin" or "adduser" or
            "resetpassword" or "listcliusers" or "deletecliuser" or
            "deletesuperadmin" or "deleteallcliusers" => true,
            _ => false
        };

    public static async Task RunAsync(string[] rawArgs, AppDbContext db)
    {
        var args = rawArgs;
        if (args.Length > 0 && args[0] == "--")
        {
            args = args.Skip(1).ToArray();
        }

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
                    await HandleCreateSuperAdminAsync(args, db);
                    break;

                case "createcustomsuperadmin":
                    await HandleCreateCustomSuperAdminAsync(args, db);
                    break;

                case "adduser":
                    await HandleAddUserAsync(args, db);
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

    private static async Task HandleCreateSuperAdminAsync(string[] args, AppDbContext db)
    {
        if (args.Length < 4)
        {
            Console.WriteLine("[CLI_ERROR] Usage: createsuperadmin <email> <password> <fullName> [unit]");
            return;
        }

        string email = args[1].Trim();
        string password = args[2];
        string fullName = args[3].Trim();
        ResponderUnitType unit = args.Length > 4 ? ParseUnit(args[4], UserRole.LDRRMO_Admin) : ResponderUnitType.LDRRMO;

        if (string.IsNullOrWhiteSpace(password) || password.Length < 12)
        {
            Console.WriteLine("[CLI_ERROR] Password must be at least 12 characters long.");
            return;
        }

        var (hash, salt) = ScryptPasswordHelper.HashPassword(password);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

        if (user != null)
        {
            user.FullName = fullName;
            user.PasswordHash = hash;
            user.PasswordSalt = salt;
            user.Role = UserRole.LDRRMO_Admin;
            user.Unit = unit;
            user.Status = AccountStatus.Verified;
            user.FaceVerified = true;
            user.UpdatedAt = DateTime.UtcNow;

            db.Users.Update(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] Super Admin user '{email}' updated successfully.");
        }
        else
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                FullName = fullName,
                EmployeeOrResidentId = "LDRRMO-" + Guid.NewGuid().ToString("N")[..6].ToUpper(),
                PasswordHash = hash,
                PasswordSalt = salt,
                Role = UserRole.LDRRMO_Admin,
                Unit = unit,
                Status = AccountStatus.Verified,
                FaceVerified = true,
                DepartmentOrBarangay = "Command & Operations Center",
                RankOrTitle = "Executive Director",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await db.Users.AddAsync(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] Super Admin user '{email}' created successfully.");
        }
    }

    private static async Task HandleCreateCustomSuperAdminAsync(string[] args, AppDbContext db)
    {
        if (args.Length < 4)
        {
            Console.WriteLine("[CLI_ERROR] Usage: createcustomsuperadmin <email> <password> <fullName> [unit]");
            return;
        }

        string email = args[1].Trim();
        string password = args[2];
        string fullName = args[3].Trim();
        ResponderUnitType unit = args.Length > 4 ? ParseUnit(args[4], UserRole.Responder) : ResponderUnitType.RHU;
        UserRole role = unit == ResponderUnitType.LDRRMO ? UserRole.LDRRMO_Admin : UserRole.Responder;

        if (string.IsNullOrWhiteSpace(password) || password.Length < 12)
        {
            Console.WriteLine("[CLI_ERROR] Password must be at least 12 characters long.");
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
            user.Status = AccountStatus.Verified;
            user.FaceVerified = true;
            user.UpdatedAt = DateTime.UtcNow;

            db.Users.Update(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] Custom Admin user '{email}' (Role: {role}, Unit: {unit}) updated successfully.");
        }
        else
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                FullName = fullName,
                EmployeeOrResidentId = $"{unit}-ADMIN-" + Guid.NewGuid().ToString("N")[..6].ToUpper(),
                PasswordHash = hash,
                PasswordSalt = salt,
                Role = role,
                Unit = unit,
                Status = AccountStatus.Verified,
                FaceVerified = true,
                DepartmentOrBarangay = $"{unit} Unit Command",
                RankOrTitle = "Unit Officer / Administrator",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await db.Users.AddAsync(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] Custom Admin user '{email}' (Role: {role}, Unit: {unit}) created successfully.");
        }
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
        string employeeOrResidentId = args.Length > 6 ? args[6].Trim() : $"{role}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        if (string.IsNullOrWhiteSpace(password) || password.Length < 12)
        {
            Console.WriteLine("[CLI_ERROR] Password must be at least 12 characters long.");
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
            if (args.Length > 6) user.EmployeeOrResidentId = employeeOrResidentId;
            user.Status = AccountStatus.Verified;
            user.FaceVerified = true;
            user.UpdatedAt = DateTime.UtcNow;

            db.Users.Update(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] User '{email}' ({role}, Unit: {unit}) updated successfully.");
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
                DepartmentOrBarangay = role == UserRole.Civilian ? "Barangay Local" : $"{unit} Operations",
                RankOrTitle = role == UserRole.Civilian ? "Resident Citizen" : "Operational Personnel",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await db.Users.AddAsync(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] User '{email}' ({role}, Unit: {unit}) created successfully.");
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

        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 12)
        {
            Console.WriteLine("[CLI_ERROR] Password must be at least 12 characters long.");
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
        Console.WriteLine("  createsuperadmin <email> <password> <fullName> [unit]");
        Console.WriteLine("  createcustomsuperadmin <email> <password> <fullName> [unit]");
        Console.WriteLine("  adduser <email> <password> <fullName> <role> [unit] [employeeOrResidentId]");
        Console.WriteLine("  resetpassword <email> <newPassword>");
        Console.WriteLine("  listcliusers");
        Console.WriteLine("  deletecliuser <email>");
        Console.WriteLine("  deletesuperadmin <email>");
        Console.WriteLine("  deleteallcliusers");
    }
}
