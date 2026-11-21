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
            "createresponder" or "createresponders" or "customcreateresponders" or "customcreateresponderuser" or "createcustomresponderuser" or "customcreateresponder" or "createcustomresponder" or
            "createcivilian" or "createcivilians" or "customcreatecivilians" or "customercreatecivilianuser" or "customcreatecivilianuser" or "createcustomcivilianuser" or "createcustomcivilian" or "customcreatecivilian" or
            "adduser" or "useredit" or "edituser" or "resetpassword" or
            "listcliusers" or "userdelete" or "deleteuser" or "deletecliuser" or "deletesuperadmin" or
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
                case "customcreateresponders":
                case "customcreateresponderuser":
                case "createcustomresponderuser":
                case "customcreateresponder":
                case "createcustomresponder":
                    await HandleCreateResponderAsync(args, db);
                    break;

                case "createcivilian":
                case "createcivilians":
                case "customcreatecivilians":
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

                case "useredit":
                case "edituser":
                    await HandleUserEditAsync(args, db);
                    break;

                case "resetpassword":
                    await HandleResetPasswordAsync(args, db);
                    break;

                case "listcliusers":
                    await HandleListCliUsersAsync(db);
                    break;

                case "userdelete":
                case "deleteuser":
                case "deletecliuser":
                case "deletesuperadmin":
                    await HandleUserDeleteAsync(args, db);
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
            "1" or "rhu" or "medic" or "medics" or "medical" or "rhu/medics" or "rhu/medic" => ResponderUnitType.RHU,
            "2" or "bfp" or "fire" or "bfp/fire" or "fire/bfp" => ResponderUnitType.FIRE,
            "3" or "pnp" or "police" or "pnp/police" or "police/pnp" => ResponderUnitType.PNP,
            _ => null
        };
    }

    private static async Task HandleCreateSuperAdminAsync(string[] args, AppDbContext db)
    {
        string mode = string.Empty;
        string email = string.Empty;
        string password = string.Empty;
        string confirmPassword = string.Empty;
        bool requireConfirmPassword = false;
        string fullName = "LDRRMO Executive Admin";
        ResponderUnitType unit = ResponderUnitType.LDRRMO;

        if (args.Length > 1 && (args[1].Trim() == "1" || args[1].Trim() == "2"))
        {
            mode = args[1].Trim();
            email = args.Length > 2 ? args[2].Trim() : string.Empty;
            password = args.Length > 3 ? args[3] : string.Empty;
            if (mode == "2")
            {
                requireConfirmPassword = true;
                confirmPassword = args.Length > 4 ? args[4] : string.Empty;
            }
        }
        else if (args.Length > 1 && args[1].Contains('@'))
        {
            mode = "1";
            email = args[1].Trim();
            password = args.Length > 2 ? args[2] : string.Empty;

            if (args.Length == 4)
            {
                if (args[3] == password)
                {
                    requireConfirmPassword = true;
                    confirmPassword = args[3];
                }
                else if (!string.IsNullOrWhiteSpace(args[3]))
                {
                    fullName = args[3].Trim();
                }
            }
            else if (args.Length > 4)
            {
                if (!string.IsNullOrWhiteSpace(args[3]))
                {
                    fullName = args[3].Trim();
                }
                unit = ParseUnit(args[4], UserRole.LDRRMO_Admin);
            }
        }
        else if (args.Length > 1 && !string.IsNullOrWhiteSpace(args[1]))
        {
            Console.WriteLine("[CLI_ERROR] Invalid choice. Type 1 or 2.");
            return;
        }
        else
        {
            Console.WriteLine("============================================================");
            Console.WriteLine(" CREATE SUPERADMIN");
            Console.WriteLine("============================================================");
            Console.WriteLine("CHOOSE TO CREATE:");
            Console.WriteLine("  [1] CREATE DEFAULT SUPERADMIN (EMAIL AND PASSWORD - NO STATICS)");
            Console.WriteLine("  [2] CREATE CUSTOM SUPERADMIN (EMAIL, PASSWORD AND CONFIRM PASSWORD)");
            mode = PromptRequiredInput("TYPE 1 OR 2");
            if (mode != "1" && mode != "2")
            {
                Console.WriteLine("[CLI_ERROR] Invalid choice. Type 1 or 2.");
                return;
            }
            requireConfirmPassword = mode == "2";
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            email = PromptRequiredInput("INPUT EMAIL");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            password = PromptRequiredInput("INPUT PASSWORD");
        }

        if (requireConfirmPassword)
        {
            if (string.IsNullOrWhiteSpace(confirmPassword))
            {
                confirmPassword = PromptRequiredInput("INPUT CONFIRM PASSWORD");
            }

            if (password != confirmPassword)
            {
                Console.WriteLine("[CLI_ERROR] Password and Confirm Password do not match.");
                return;
            }
        }

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@') || string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine("[CLI_ERROR] Usage: createsuperadmin [1|2] <email> <password> [confirmPassword]");
            return;
        }

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
        string confirmPassword = string.Empty;
        bool hasConfirmPasswordArg = false;
        bool isInteractive = args.Length < 4;
        string? explicitFullName = null;

        if (args.Length >= 4)
        {
            var firstAsUnit = TryParseResponderPhaseOption(args[1]);
            if (firstAsUnit.HasValue && args[2].Contains('@'))
            {
                selectedUnit = firstAsUnit.Value;
                email = args[2].Trim();
                password = args[3];
                if (args.Length > 4)
                {
                    confirmPassword = args[4];
                    hasConfirmPasswordArg = true;
                }
            }
            else if (args[1].Contains('@'))
            {
                email = args[1].Trim();
                password = args[2];
                selectedUnit = TryParseResponderPhaseOption(args[3]) ?? ParseUnit(args[3], UserRole.Responder);
                if (args.Length > 4)
                {
                    explicitFullName = args[4];
                }
            }
            else
            {
                Console.WriteLine("[CLI_ERROR] Invalid responder option. Type 1 (RHU/MEDICS), 2 (BFP/FIRE), or 3 (PNP/POLICE).");
                return;
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
            else if (args[1].Contains('@'))
            {
                email = args[1].Trim();
                password = args[2];
            }
            else
            {
                Console.WriteLine("[CLI_ERROR] Invalid responder option. Type 1 (RHU/MEDICS), 2 (BFP/FIRE), or 3 (PNP/POLICE).");
                return;
            }
        }
        else if (args.Length == 2)
        {
            var firstAsUnit = TryParseResponderPhaseOption(args[1]);
            if (firstAsUnit.HasValue)
            {
                selectedUnit = firstAsUnit.Value;
            }
            else if (args[1].Contains('@'))
            {
                email = args[1].Trim();
            }
            else
            {
                Console.WriteLine("[CLI_ERROR] Invalid responder option. Type 1 (RHU/MEDICS), 2 (BFP/FIRE), or 3 (PNP/POLICE).");
                return;
            }
        }

        if (!selectedUnit.HasValue || selectedUnit.Value == ResponderUnitType.None || selectedUnit.Value == ResponderUnitType.LDRRMO)
        {
            Console.WriteLine("============================================================");
            Console.WriteLine(" CUSTOM CREATE RESPONDERS");
            Console.WriteLine("============================================================");
            Console.WriteLine("CHOOSE OPTION RESPONDERS:");
            Console.WriteLine("  1. RHU/MEDICS");
            Console.WriteLine("  2. BFP/FIRE");
            Console.WriteLine("  3. PNP/POLICE");
            string phaseChoice = PromptRequiredInput("CHOOSE OPTION RESPONDERS (1-3)");
            selectedUnit = TryParseResponderPhaseOption(phaseChoice);
            if (!selectedUnit.HasValue)
            {
                Console.WriteLine("[CLI_ERROR] Invalid responder option. Type 1 (RHU/MEDICS), 2 (BFP/FIRE), or 3 (PNP/POLICE).");
                return;
            }
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            email = PromptRequiredInput("INPUT EMAIL");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            password = PromptRequiredInput("INPUT PASSWORD");
        }

        if (isInteractive || hasConfirmPasswordArg)
        {
            if (!hasConfirmPasswordArg)
            {
                confirmPassword = PromptRequiredInput("INPUT CONFIRM PASSWORD");
            }

            if (password != confirmPassword)
            {
                Console.WriteLine("[CLI_ERROR] Password and Confirm Password do not match.");
                return;
            }
        }

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@') || string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine("[CLI_ERROR] Usage: createresponders <1|2|3|RHU|BFP|PNP> <email> <password> [confirmPassword]");
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
        bool isInteractive = args.Length < 3;
        string email = args.Length > 1 ? args[1].Trim() : string.Empty;
        string password = args.Length > 2 ? args[2] : string.Empty;
        bool hasConfirmPasswordArg = args.Length > 3;
        string confirmPassword = hasConfirmPasswordArg ? args[3] : string.Empty;

        if (isInteractive)
        {
            Console.WriteLine("============================================================");
            Console.WriteLine(" CUSTOM CREATE CIVILIANS");
            Console.WriteLine("============================================================");
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            email = PromptRequiredInput("INPUT EMAIL");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            password = PromptRequiredInput("INPUT PASSWORD");
        }

        if (isInteractive || hasConfirmPasswordArg)
        {
            if (!hasConfirmPasswordArg)
            {
                confirmPassword = PromptRequiredInput("INPUT CONFIRM PASSWORD");
            }

            if (password != confirmPassword)
            {
                Console.WriteLine("[CLI_ERROR] Password and Confirm Password do not match.");
                return;
            }
        }

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@') || string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine("[CLI_ERROR] Usage: createcivilians <email> <password> [confirmPassword]");
            return;
        }

        await UpsertCliUserAsync(
            db: db,
            email: email,
            password: password,
            fullName: "Resident Citizen",
            role: UserRole.Civilian,
            unit: ResponderUnitType.None,
            employeeOrResidentId: "CIV-" + Guid.NewGuid().ToString("N")[..6].ToUpper(),
            overrideEmployeeIdOnUpdate: false,
            departmentOrBarangay: "Katipunan Municipality",
            rankOrTitle: "Resident Citizen",
            barangay: null,
            label: "Civilian");
    }

    private static string SplitFirstName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return string.Empty;
        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[0] : string.Empty;
    }

    private static string SplitLastName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return string.Empty;
        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 1 ? string.Join(" ", parts.Skip(1)) : string.Empty;
    }

    private static bool IsDeleteAllOption(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return false;
        var normalized = input.Trim();
        return normalized.Equals("all", StringComparison.OrdinalIgnoreCase) ||
               normalized.Equals("a", StringComparison.OrdinalIgnoreCase) ||
               normalized.Equals("delete all", StringComparison.OrdinalIgnoreCase);
    }

    private static List<User> FilterUsersBySearchQuery(List<User> users, string rawQuery)
    {
        string query = rawQuery.Trim().ToLowerInvariant();
        return users.Where(u =>
            (u.Email?.ToLowerInvariant().Contains(query) ?? false) ||
            (u.FirstName?.ToLowerInvariant().Contains(query) ?? false) ||
            (u.Surname?.ToLowerInvariant().Contains(query) ?? false) ||
            (u.FullName?.ToLowerInvariant().Contains(query) ?? false) ||
            (u.EmployeeOrResidentId?.ToLowerInvariant().Contains(query) ?? false)).ToList();
    }

    private static void PrintFormattedUserList(List<User> users)
    {
        for (int i = 0; i < users.Count; i++)
        {
            var u = users[i];
            string first = !string.IsNullOrWhiteSpace(u.FirstName) ? u.FirstName : SplitFirstName(u.FullName);
            string last = !string.IsNullOrWhiteSpace(u.Surname) ? u.Surname : SplitLastName(u.FullName);
            Console.WriteLine($"  [{i + 1}] {first} {last} ({u.FullName}) | {u.Email} | Role: {u.Role} | Unit: {u.Unit}");
        }
    }

    private static async Task HandleUserEditAsync(string[] args, AppDbContext db)
    {
        // Backward-compatibility: non-interactive `edituser <currentEmail> [newPassword] [newEmail]`
        if (args.Length >= 3 && args[1].Contains('@'))
        {
            await HandleLegacyEditUserAsync(args, db);
            return;
        }

        Console.WriteLine("============================================================");
        Console.WriteLine(" USER EDIT");
        Console.WriteLine("============================================================");
        Console.WriteLine("CHOOSE USER:");
        Console.WriteLine("  1. Admin User");
        Console.WriteLine("  2. Responders");
        Console.WriteLine("  3. Civilians");

        string userTypeChoice = args.Length > 1 && (args[1].Trim() == "1" || args[1].Trim() == "2" || args[1].Trim() == "3")
            ? args[1].Trim()
            : PromptRequiredInput("CHOOSE USER (1-3)");

        IQueryable<User> userQuery;
        if (userTypeChoice == "1")
        {
            userQuery = db.Users.Where(u => !u.IsDeleted && u.Role == UserRole.LDRRMO_Admin);
        }
        else if (userTypeChoice == "2")
        {
            Console.WriteLine("CHOOSE OPTION RESPONDERS:");
            Console.WriteLine("  1. RHU/MEDICS");
            Console.WriteLine("  2. BFP/FIRE");
            Console.WriteLine("  3. PNP/POLICE");
            string responderChoice = args.Length > 2 && TryParseResponderPhaseOption(args[2]).HasValue
                ? args[2].Trim()
                : PromptRequiredInput("CHOOSE OPTION RESPONDERS (1-3)");
            var selectedUnit = TryParseResponderPhaseOption(responderChoice);
            if (!selectedUnit.HasValue)
            {
                Console.WriteLine("[CLI_ERROR] Invalid responder option. Type 1 (RHU/MEDICS), 2 (BFP/FIRE), or 3 (PNP/POLICE).");
                return;
            }
            userQuery = db.Users.Where(u => !u.IsDeleted && u.Role == UserRole.Responder && u.Unit == selectedUnit.Value);
        }
        else if (userTypeChoice == "3")
        {
            userQuery = db.Users.Where(u => !u.IsDeleted && u.Role == UserRole.Civilian);
        }
        else
        {
            Console.WriteLine("[CLI_ERROR] Invalid user type selection. Type 1 (Admin User), 2 (Responders), or 3 (Civilians).");
            return;
        }

        var users = await userQuery.OrderBy(u => u.Email).ToListAsync();
        if (users.Count == 0)
        {
            Console.WriteLine("[CLI_ERROR] No users found in selected category.");
            return;
        }

        PrintFormattedUserList(users);
        Console.Write("SEARCH OR SELECT USER (Type number 1-N, or enter search keyword, or 0 to cancel): ");
        string selectionInput = (Console.ReadLine() ?? string.Empty).Trim();

        if (selectionInput == "0")
        {
            Console.WriteLine("[CLI] User edit cancelled.");
            return;
        }

        User selectedUser;
        if (int.TryParse(selectionInput, out int selectedNumber) && selectedNumber >= 1 && selectedNumber <= users.Count)
        {
            selectedUser = users[selectedNumber - 1];
        }
        else
        {
            if (string.IsNullOrWhiteSpace(selectionInput))
            {
                Console.WriteLine("[CLI_ERROR] Invalid user selection.");
                return;
            }

            var filteredUsers = FilterUsersBySearchQuery(users, selectionInput);
            if (filteredUsers.Count == 0)
            {
                Console.WriteLine($"[CLI_ERROR] No users matched search '{selectionInput}'.");
                return;
            }

            PrintFormattedUserList(filteredUsers);
            Console.Write("SELECT USER NUMBER (1-M): ");
            string filteredSelection = (Console.ReadLine() ?? string.Empty).Trim();
            if (!int.TryParse(filteredSelection, out int filteredIndex) || filteredIndex < 1 || filteredIndex > filteredUsers.Count)
            {
                Console.WriteLine("[CLI_ERROR] Invalid user selection.");
                return;
            }

            selectedUser = filteredUsers[filteredIndex - 1];
        }

        string currentFirstName = !string.IsNullOrWhiteSpace(selectedUser.FirstName)
            ? selectedUser.FirstName
            : SplitFirstName(selectedUser.FullName);
        string currentLastName = !string.IsNullOrWhiteSpace(selectedUser.Surname)
            ? selectedUser.Surname
            : SplitLastName(selectedUser.FullName);

        selectedUser.FirstName = currentFirstName;
        selectedUser.Surname = currentLastName;

        Console.WriteLine($"Selected User: {selectedUser.Email} (FirstName: '{currentFirstName}', LastName: '{currentLastName}')");

        Console.Write($"INPUT FIRSTNAME [Enter to keep '{currentFirstName}']: ");
        string inputFirstName = (Console.ReadLine() ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(inputFirstName) && inputFirstName != "-")
        {
            selectedUser.FirstName = inputFirstName;
        }

        Console.Write($"INPUT LASTNAME [Enter to keep '{currentLastName}']: ");
        string inputLastName = (Console.ReadLine() ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(inputLastName) && inputLastName != "-")
        {
            selectedUser.Surname = inputLastName;
        }

        if (!string.IsNullOrWhiteSpace(selectedUser.FirstName) || !string.IsNullOrWhiteSpace(selectedUser.Surname))
        {
            selectedUser.FullName = $"{selectedUser.FirstName} {selectedUser.Surname}".Trim();
            selectedUser.DisplayName = selectedUser.FullName;
        }

        Console.Write($"INPUT EMAIL [Enter to keep '{selectedUser.Email}']: ");
        string inputEmail = (Console.ReadLine() ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(inputEmail) && inputEmail != "-" && !inputEmail.Equals(selectedUser.Email, StringComparison.OrdinalIgnoreCase))
        {
            var exists = await db.Users.AnyAsync(u => u.Email.ToLower() == inputEmail.ToLower() && u.Id != selectedUser.Id);
            if (exists)
            {
                Console.WriteLine($"[CLI_ERROR] Email '{inputEmail}' is already taken.");
                return;
            }
            selectedUser.Email = inputEmail;
        }

        Console.Write("Do you want to direct change password on this account? (Yes/No): ");
        string passwordChoice = (Console.ReadLine() ?? string.Empty).Trim();
        if (passwordChoice.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
            passwordChoice.Equals("y", StringComparison.OrdinalIgnoreCase))
        {
            Console.Write("NEW PASSWORD: ");
            string newPassword = (Console.ReadLine() ?? string.Empty).Trim();
            Console.Write("CONFIRM PASSWORD: ");
            string confirmPassword = (Console.ReadLine() ?? string.Empty).Trim();

            if (newPassword != confirmPassword)
            {
                Console.WriteLine("[CLI_ERROR] Password and Confirm Password do not match.");
                return;
            }

            if (newPassword.Length < ScryptPasswordHelper.MinimumPasswordLength)
            {
                Console.WriteLine($"[CLI_ERROR] Password must be at least {ScryptPasswordHelper.MinimumPasswordLength} characters long.");
                return;
            }

            var (hash, salt) = ScryptPasswordHelper.HashPassword(newPassword);
            selectedUser.PasswordHash = hash;
            selectedUser.PasswordSalt = salt;
        }

        selectedUser.UpdatedAt = DateTime.UtcNow;

        var activeSessions = await db.Sessions.Where(s => s.UserId == selectedUser.Id && !s.IsRevoked).ToListAsync();
        foreach (var s in activeSessions) s.IsRevoked = true;

        await db.SaveChangesAsync();
        Console.WriteLine($"[CLI] User '{selectedUser.Email}' updated successfully (FirstName: '{selectedUser.FirstName}', LastName: '{selectedUser.Surname}', Email: '{selectedUser.Email}').");
    }

    private static async Task HandleLegacyEditUserAsync(string[] args, AppDbContext db)
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

        string derivedFirstName = SplitFirstName(fullName);
        string derivedLastName = SplitLastName(fullName);

        string cliProvisionProvider = role == UserRole.LDRRMO_Admin
            ? "CliSuperAdminProvisioned"
            : "CliProvisioned";

        if (user != null)
        {
            user.FullName = fullName;
            if (string.IsNullOrWhiteSpace(user.FirstName)) user.FirstName = derivedFirstName;
            if (string.IsNullOrWhiteSpace(user.Surname)) user.Surname = derivedLastName;
            if (string.IsNullOrWhiteSpace(user.DisplayName)) user.DisplayName = fullName;
            user.PasswordHash = hash;
            user.PasswordSalt = salt;
            user.Role = role;
            user.Unit = unit;
            user.IdentityVerificationProvider = cliProvisionProvider;
            user.FacialVerificationProvider = cliProvisionProvider;
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
                DisplayName = fullName,
                FirstName = derivedFirstName,
                Surname = derivedLastName,
                EmployeeOrResidentId = employeeOrResidentId,
                PasswordHash = hash,
                PasswordSalt = salt,
                Role = role,
                Unit = unit,
                IdentityVerificationProvider = cliProvisionProvider,
                FacialVerificationProvider = cliProvisionProvider,
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

    private static async Task DeleteUserWithDependenciesAsync(User user, AppDbContext db)
    {
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
    }

    private static async Task HandleUserDeleteAsync(string[] args, AppDbContext db)
    {
        string cmdName = args.Length > 0 ? args[0].TrimStart('-').ToLowerInvariant() : "userdelete";

        // Backward-compatibility: `userdelete <email>`, `deleteuser <email>`, `deletecliuser <email>`, `deletesuperadmin <email>`
        if (args.Length >= 2 && args[1].Contains('@'))
        {
            if (cmdName == "deletesuperadmin")
            {
                await HandleDeleteSuperAdminAsync(args, db);
            }
            else
            {
                await HandleDeleteCliUserAsync(args, db);
            }
            return;
        }

        Console.WriteLine("============================================================");
        Console.WriteLine(" USER DELETE");
        Console.WriteLine("============================================================");
        Console.WriteLine("CHOOSE USER:");
        Console.WriteLine("  1. Admin User");
        Console.WriteLine("  2. Responders");
        Console.WriteLine("  3. Civilians");

        string userTypeChoice = args.Length > 1 && (args[1].Trim() == "1" || args[1].Trim() == "2" || args[1].Trim() == "3")
            ? args[1].Trim()
            : PromptRequiredInput("CHOOSE USER (1-3)");

        IQueryable<User> userQuery;
        if (userTypeChoice == "1")
        {
            userQuery = db.Users.Where(u => !u.IsDeleted && u.Role == UserRole.LDRRMO_Admin);
        }
        else if (userTypeChoice == "2")
        {
            Console.WriteLine("CHOOSE OPTION RESPONDERS:");
            Console.WriteLine("  1. RHU/MEDICS");
            Console.WriteLine("  2. BFP/FIRE");
            Console.WriteLine("  3. PNP/POLICE");
            string responderChoice = args.Length > 2 && TryParseResponderPhaseOption(args[2]).HasValue
                ? args[2].Trim()
                : PromptRequiredInput("CHOOSE OPTION RESPONDERS (1-3)");
            var selectedUnit = TryParseResponderPhaseOption(responderChoice);
            if (!selectedUnit.HasValue)
            {
                Console.WriteLine("[CLI_ERROR] Invalid responder option. Type 1 (RHU/MEDICS), 2 (BFP/FIRE), or 3 (PNP/POLICE).");
                return;
            }
            userQuery = db.Users.Where(u => !u.IsDeleted && u.Role == UserRole.Responder && u.Unit == selectedUnit.Value);
        }
        else if (userTypeChoice == "3")
        {
            userQuery = db.Users.Where(u => !u.IsDeleted && u.Role == UserRole.Civilian);
        }
        else
        {
            Console.WriteLine("[CLI_ERROR] Invalid user type selection. Type 1 (Admin User), 2 (Responders), or 3 (Civilians).");
            return;
        }

        var users = await userQuery.OrderBy(u => u.Email).ToListAsync();
        if (users.Count == 0)
        {
            Console.WriteLine("[CLI_ERROR] No users found in selected category.");
            return;
        }

        PrintFormattedUserList(users);
        Console.WriteLine($"  [ALL] DELETE ALL ({users.Count} users in this category)");
        Console.Write("SEARCH, SELECT USER (1-N), OR TYPE 'ALL' TO DELETE ALL (0 to cancel): ");
        string selectionInput = (Console.ReadLine() ?? string.Empty).Trim();

        if (selectionInput == "0")
        {
            Console.WriteLine("[CLI] User delete cancelled.");
            return;
        }

        if (!IsDeleteAllOption(selectionInput) &&
            !(int.TryParse(selectionInput, out int initialIndex) && initialIndex >= 1 && initialIndex <= users.Count))
        {
            if (string.IsNullOrWhiteSpace(selectionInput))
            {
                Console.WriteLine("[CLI_ERROR] Invalid user selection.");
                return;
            }

            var filteredUsers = FilterUsersBySearchQuery(users, selectionInput);
            if (filteredUsers.Count == 0)
            {
                Console.WriteLine($"[CLI_ERROR] No users matched search '{selectionInput}'.");
                return;
            }

            PrintFormattedUserList(filteredUsers);
            Console.WriteLine($"  [ALL] DELETE ALL ({filteredUsers.Count} matched users)");
            Console.Write("SELECT USER NUMBER (1-M) OR TYPE 'ALL': ");
            selectionInput = (Console.ReadLine() ?? string.Empty).Trim();
            users = filteredUsers;
        }

        if (IsDeleteAllOption(selectionInput))
        {
            Console.Write("DO YOU WANT TO DELETE ALL? (YES/NO): ");
            string confirmAll = (Console.ReadLine() ?? string.Empty).Trim();
            if (!confirmAll.Equals("yes", StringComparison.OrdinalIgnoreCase) &&
                !confirmAll.Equals("y", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine("[CLI] Delete all cancelled.");
                return;
            }

            Console.Write("INPUT ADMIN PASSWORD: ");
            string adminPass = (Console.ReadLine() ?? string.Empty).Trim();

            var admins = await db.Users.Where(u => !u.IsDeleted && u.Role == UserRole.LDRRMO_Admin).ToListAsync();
            bool isValidAdminPass = !string.IsNullOrWhiteSpace(adminPass) &&
                admins.Any(a => ScryptPasswordHelper.VerifyPassword(adminPass, a.PasswordHash, a.PasswordSalt));

            if (!isValidAdminPass)
            {
                Console.WriteLine("[CLI_ERROR] Invalid Admin password. Delete all aborted.");
                return;
            }

            int deletedCount = users.Count;
            foreach (var targetUser in users)
            {
                await DeleteUserWithDependenciesAsync(targetUser, db);
            }

            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] SUCCESSFUL: Deleted all ({deletedCount}) users in selected category.");
            return;
        }

        if (int.TryParse(selectionInput, out int finalIndex) && finalIndex >= 1 && finalIndex <= users.Count)
        {
            var target = users[finalIndex - 1];
            await DeleteUserWithDependenciesAsync(target, db);
            await db.SaveChangesAsync();
            Console.WriteLine($"[CLI] User '{target.Email}' deleted successfully.");
            return;
        }

        Console.WriteLine("[CLI_ERROR] Invalid user selection.");
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

        await DeleteUserWithDependenciesAsync(user, db);
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

        await DeleteUserWithDependenciesAsync(user, db);
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
        Console.WriteLine("  createsuperadmin [1|2] [email] [password] [confirmPassword]");
        Console.WriteLine("    [1] CREATE DEFAULT SUPERADMIN (INPUT EMAIL & INPUT PASSWORD - NO STATICS)");
        Console.WriteLine("    [2] CREATE CUSTOM SUPERADMIN (INPUT EMAIL, INPUT PASSWORD & INPUT CONFIRM PASSWORD)");
        Console.WriteLine("  createresponders [1|2|3|RHU|BFP|PNP] [email] [password] [confirmPassword]");
        Console.WriteLine("    1. RHU/MEDICS | 2. BFP/FIRE | 3. PNP/POLICE -> INPUT EMAIL, INPUT PASSWORD & INPUT CONFIRM PASSWORD");
        Console.WriteLine("  createcivilians [email] [password] [confirmPassword]");
        Console.WriteLine("    INPUT EMAIL, INPUT PASSWORD & INPUT CONFIRM PASSWORD");
        Console.WriteLine("  useredit (or edituser <email> [newPassword] [newEmail])");
        Console.WriteLine("    1. Admin User | 2. Responders (1. RHU/MEDICS, 2. BFP/FIRE, 3. PNP/POLICE) | 3. Civilians -> Search/Select -> FirstName, LastName, Email, Optional Password");
        Console.WriteLine("  userdelete (or deleteuser / deletecliuser <email> / deletesuperadmin <email> / deleteallcliusers)");
        Console.WriteLine("    1. Admin User | 2. Responders (1. RHU/MEDICS, 2. BFP/FIRE, 3. PNP/POLICE) | 3. Civilians -> Search/Select or ALL (Admin Password Required)");
        Console.WriteLine("  resetpassword <email> <newPassword>");
        Console.WriteLine("  listcliusers");
        Console.WriteLine("  updatedatabase");
        Console.WriteLine("  addmigration <MigrationName>");
    }
}
