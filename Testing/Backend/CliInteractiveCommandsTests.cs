// [Layer: Testing/Backend]
// Responsibility: xUnit tests for merged and rearranged interactive CLI commands (createsuperadmin, createresponders, createcivilians, useredit, userdelete).
// Invariant: C# .NET 10, xUnit 2.9.3, universal lambda expressions (=>), zero emojis, zero static credentials.

using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;
using Backend.Features.Management.Commands;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

[Collection("CliConsoleSequentialTests")]
public class CliInteractiveCommandsTests
{
    private static readonly SemaphoreSlim ConsoleLock = new(1, 1);

    private static AppDbContext CreateInMemoryDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"ResQTrack_CliInteractive_{Guid.NewGuid():N}")
            .Options);

    private static async Task<string> RunCliWithRedirectedConsoleAsync(
        AppDbContext db,
        string[] args,
        string simulatedInput)
    {
        await ConsoleLock.WaitAsync();
        var originalIn = Console.In;
        var originalOut = Console.Out;
        try
        {
            using var reader = new StringReader(simulatedInput);
            using var writer = new StringWriter();
            Console.SetIn(reader);
            Console.SetOut(writer);

            await CliCommandRunner.RunAsync(args, db);
            return writer.ToString();
        }
        finally
        {
            Console.SetIn(originalIn);
            Console.SetOut(originalOut);
            ConsoleLock.Release();
        }
    }

    [Fact]
    public async Task CreateSuperAdmin_Option1_PromptsEmailAndPassword_CreatesVerifiedLdrrmoAdmin()
    {
        using var db = CreateInMemoryDbContext();
        string output = await RunCliWithRedirectedConsoleAsync(
            db,
            ["createsuperadmin"],
            "1\nadmin.opt1@resqtrack.gov.ph\nAdminOpt1@2026!\n");

        Assert.Contains("CREATE SUPERADMIN", output);
        Assert.Contains("[1] CREATE DEFAULT SUPERADMIN (EMAIL AND PASSWORD - NO STATICS)", output);
        Assert.Contains("[2] CREATE CUSTOM SUPERADMIN (EMAIL, PASSWORD AND CONFIRM PASSWORD)", output);
        Assert.Contains("TYPE 1 OR 2: ", output);
        Assert.Contains("INPUT EMAIL: ", output);
        Assert.Contains("INPUT PASSWORD: ", output);
        Assert.DoesNotContain("INPUT CONFIRM PASSWORD: ", output);

        var saved = await db.Users.FirstOrDefaultAsync(u => u.Email == "admin.opt1@resqtrack.gov.ph");
        Assert.NotNull(saved);
        Assert.Equal(UserRole.LDRRMO_Admin, saved!.Role);
        Assert.Equal(ResponderUnitType.LDRRMO, saved.Unit);
        Assert.Equal(AccountStatus.Verified, saved.Status);
        Assert.True(saved.FaceVerified);
        Assert.True(ScryptPasswordHelper.VerifyPassword("AdminOpt1@2026!", saved.PasswordHash, saved.PasswordSalt));
    }

    [Fact]
    public async Task CreateSuperAdmin_Option2_PromptsConfirmPassword_CreatesVerifiedLdrrmoAdmin_AndRejectsMismatch()
    {
        using var db = CreateInMemoryDbContext();
        string outputSuccess = await RunCliWithRedirectedConsoleAsync(
            db,
            ["createsuperadmin"],
            "2\nadmin.opt2@resqtrack.gov.ph\nAdminOpt2@2026!\nAdminOpt2@2026!\n");

        Assert.Contains("CREATE SUPERADMIN", outputSuccess);
        Assert.Contains("TYPE 1 OR 2: ", outputSuccess);
        Assert.Contains("INPUT EMAIL: ", outputSuccess);
        Assert.Contains("INPUT PASSWORD: ", outputSuccess);
        Assert.Contains("INPUT CONFIRM PASSWORD: ", outputSuccess);

        var saved = await db.Users.FirstOrDefaultAsync(u => u.Email == "admin.opt2@resqtrack.gov.ph");
        Assert.NotNull(saved);
        Assert.Equal(UserRole.LDRRMO_Admin, saved!.Role);
        Assert.Equal(ResponderUnitType.LDRRMO, saved.Unit);
        Assert.Equal(AccountStatus.Verified, saved.Status);
        Assert.True(ScryptPasswordHelper.VerifyPassword("AdminOpt2@2026!", saved.PasswordHash, saved.PasswordSalt));

        string outputMismatch = await RunCliWithRedirectedConsoleAsync(
            db,
            ["createsuperadmin"],
            "2\nadmin.mismatch@resqtrack.gov.ph\nAdminOpt2@2026!\nWrongConfirm@2026!\n");

        Assert.Contains("[CLI_ERROR] Password and Confirm Password do not match.", outputMismatch);
        var notSaved = await db.Users.FirstOrDefaultAsync(u => u.Email == "admin.mismatch@resqtrack.gov.ph");
        Assert.Null(notSaved);
    }

    [Theory]
    [InlineData("1", "rhu.medic@resqtrack.gov.ph", ResponderUnitType.RHU)]
    [InlineData("2", "bfp.fire@resqtrack.gov.ph", ResponderUnitType.FIRE)]
    [InlineData("3", "pnp.police@resqtrack.gov.ph", ResponderUnitType.PNP)]
    public async Task CreateResponders_Options1To3_PromptsEmailPasswordAndConfirm_CreatesVerifiedResponderWithExactUnit(
        string optionChoice,
        string email,
        ResponderUnitType expectedUnit)
    {
        using var db = CreateInMemoryDbContext();
        string output = await RunCliWithRedirectedConsoleAsync(
            db,
            ["createresponders"],
            $"{optionChoice}\n{email}\nResponderPass@2026!\nResponderPass@2026!\n");

        Assert.Contains("CUSTOM CREATE RESPONDERS", output);
        Assert.Contains("CHOOSE OPTION RESPONDERS:", output);
        Assert.Contains("1. RHU/MEDICS", output);
        Assert.Contains("2. BFP/FIRE", output);
        Assert.Contains("3. PNP/POLICE", output);
        Assert.Contains("CHOOSE OPTION RESPONDERS (1-3): ", output);
        Assert.Contains("INPUT EMAIL: ", output);
        Assert.Contains("INPUT PASSWORD: ", output);
        Assert.Contains("INPUT CONFIRM PASSWORD: ", output);

        var saved = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        Assert.NotNull(saved);
        Assert.Equal(UserRole.Responder, saved!.Role);
        Assert.Equal(expectedUnit, saved.Unit);
        Assert.Equal(AccountStatus.Verified, saved.Status);
        Assert.True(saved.FaceVerified);
        Assert.True(ScryptPasswordHelper.VerifyPassword("ResponderPass@2026!", saved.PasswordHash, saved.PasswordSalt));
    }

    [Fact]
    public async Task CreateResponders_MismatchedConfirmPassword_RejectsCreation()
    {
        using var db = CreateInMemoryDbContext();
        string output = await RunCliWithRedirectedConsoleAsync(
            db,
            ["createresponders"],
            "1\nmismatch.rhu@resqtrack.gov.ph\nResponderPass@2026!\nDifferentPass@2026!\n");

        Assert.Contains("[CLI_ERROR] Password and Confirm Password do not match.", output);
        var notSaved = await db.Users.FirstOrDefaultAsync(u => u.Email == "mismatch.rhu@resqtrack.gov.ph");
        Assert.Null(notSaved);
    }

    [Fact]
    public async Task CreateCivilians_Interactive_PromptsEmailPasswordAndConfirm_CreatesVerifiedCivilian_AndRejectsMismatch()
    {
        using var db = CreateInMemoryDbContext();
        string output = await RunCliWithRedirectedConsoleAsync(
            db,
            ["createcivilians"],
            "citizen.katipunan@resqtrack.gov.ph\nCivilianPass@2026!\nCivilianPass@2026!\n");

        Assert.Contains("CUSTOM CREATE CIVILIANS", output);
        Assert.Contains("INPUT EMAIL: ", output);
        Assert.Contains("INPUT PASSWORD: ", output);
        Assert.Contains("INPUT CONFIRM PASSWORD: ", output);

        var saved = await db.Users.FirstOrDefaultAsync(u => u.Email == "citizen.katipunan@resqtrack.gov.ph");
        Assert.NotNull(saved);
        Assert.Equal(UserRole.Civilian, saved!.Role);
        Assert.Equal(ResponderUnitType.None, saved.Unit);
        Assert.Equal(AccountStatus.Verified, saved.Status);
        Assert.True(saved.FaceVerified);
        Assert.True(ScryptPasswordHelper.VerifyPassword("CivilianPass@2026!", saved.PasswordHash, saved.PasswordSalt));

        string mismatchOutput = await RunCliWithRedirectedConsoleAsync(
            db,
            ["createcivilians"],
            "citizen.mismatch@resqtrack.gov.ph\nCivilianPass@2026!\nWrongCivilian@2026!\n");

        Assert.Contains("[CLI_ERROR] Password and Confirm Password do not match.", mismatchOutput);
        var notSaved = await db.Users.FirstOrDefaultAsync(u => u.Email == "citizen.mismatch@resqtrack.gov.ph");
        Assert.Null(notSaved);
    }

    [Theory]
    [InlineData("createsuperadmin")]
    [InlineData("customcreatesuperadmin")]
    [InlineData("createcustomsuperadmin")]
    [InlineData("createresponders")]
    [InlineData("createresponder")]
    [InlineData("customcreateresponders")]
    [InlineData("customcreateresponderuser")]
    [InlineData("createcustomresponder")]
    [InlineData("customcreateresponder")]
    [InlineData("createcivilians")]
    [InlineData("createcivilian")]
    [InlineData("customcreatecivilians")]
    [InlineData("customercreatecivilianuser")]
    [InlineData("customcreatecivilianuser")]
    [InlineData("createcustomcivilian")]
    [InlineData("useredit")]
    [InlineData("edituser")]
    [InlineData("userdelete")]
    [InlineData("deleteuser")]
    [InlineData("deletecliuser")]
    [InlineData("deletesuperadmin")]
    [InlineData("deleteallcliusers")]
    public void IsCliCommand_RecognizesAllMergedCommandsAndAliases(string commandName) =>
        Assert.True(CliCommandRunner.IsCliCommand([commandName]));

    private static async Task<User> SeedTestUserAsync(
        AppDbContext db,
        string email,
        string password,
        string firstName,
        string lastName,
        UserRole role,
        ResponderUnitType unit)
    {
        var (hash, salt) = ScryptPasswordHelper.HashPassword(password);
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            FirstName = firstName,
            Surname = lastName,
            FullName = $"{firstName} {lastName}".Trim(),
            DisplayName = $"{firstName} {lastName}".Trim(),
            EmployeeOrResidentId = $"{role}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = role,
            Unit = unit,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await db.Users.AddAsync(user);
        await db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task UserEdit_Type1_AdminUser_SelectByNumber_EditFirstLastEmail_PasswordChangeNo_PreservesOldPassword()
    {
        using var db = CreateInMemoryDbContext();
        await SeedTestUserAsync(
            db,
            "admin.initial@resqtrack.gov.ph",
            "OldAdminPass@2026!",
            "Juan",
            "DelaCruz",
            UserRole.LDRRMO_Admin,
            ResponderUnitType.LDRRMO);

        string output = await RunCliWithRedirectedConsoleAsync(
            db,
            ["useredit"],
            "1\n1\nMateo\nRizal\nadmin.updated@resqtrack.gov.ph\nNo\n");

        Assert.Contains("USER EDIT", output);
        Assert.Contains("1. Admin User", output);
        Assert.Contains("2. Responders", output);
        Assert.Contains("3. Civilians", output);
        Assert.Contains("SEARCH OR SELECT USER", output);
        Assert.Contains("INPUT FIRSTNAME", output);
        Assert.Contains("INPUT LASTNAME", output);
        Assert.Contains("INPUT EMAIL", output);
        Assert.Contains("Do you want to direct change password on this account? (Yes/No): ", output);
        Assert.DoesNotContain("NEW PASSWORD: ", output);

        var updated = await db.Users.FirstOrDefaultAsync(u => u.Email == "admin.updated@resqtrack.gov.ph");
        Assert.NotNull(updated);
        Assert.Equal("Mateo", updated!.FirstName);
        Assert.Equal("Rizal", updated.Surname);
        Assert.Equal("Mateo Rizal", updated.FullName);
        Assert.True(ScryptPasswordHelper.VerifyPassword("OldAdminPass@2026!", updated.PasswordHash, updated.PasswordSalt));
    }

    [Theory]
    [InlineData("1", ResponderUnitType.RHU, "rhu.alpha@resqtrack.gov.ph", "rhu.alpha.edited@resqtrack.gov.ph")]
    [InlineData("2", ResponderUnitType.FIRE, "bfp.bravo@resqtrack.gov.ph", "bfp.bravo.edited@resqtrack.gov.ph")]
    [InlineData("3", ResponderUnitType.PNP, "pnp.charlie@resqtrack.gov.ph", "pnp.charlie.edited@resqtrack.gov.ph")]
    public async Task UserEdit_Type2_Responders_AllThreeSubUnits_SearchKeyword_AndChangePasswordYes(
        string responderSubOption,
        ResponderUnitType unit,
        string initialEmail,
        string updatedEmail)
    {
        using var db = CreateInMemoryDbContext();
        await SeedTestUserAsync(
            db,
            $"other.{unit.ToString().ToLower()}@resqtrack.gov.ph",
            "InitialResponder@2026!",
            "Other",
            "Officer",
            UserRole.Responder,
            unit);
        await SeedTestUserAsync(
            db,
            initialEmail,
            "InitialResponder@2026!",
            "TargetFirst",
            "TargetLast",
            UserRole.Responder,
            unit);

        string output = await RunCliWithRedirectedConsoleAsync(
            db,
            ["useredit"],
            $"2\n{responderSubOption}\nTargetFirst\n1\nEditedFirst\nEditedLast\n{updatedEmail}\nYes\nNewResponderPass@2026!\nNewResponderPass@2026!\n");

        Assert.Contains("CHOOSE OPTION RESPONDERS:", output);
        Assert.Contains("1. RHU/MEDICS", output);
        Assert.Contains("2. BFP/FIRE", output);
        Assert.Contains("3. PNP/POLICE", output);
        Assert.Contains("SELECT USER NUMBER (1-M): ", output);
        Assert.Contains("NEW PASSWORD: ", output);
        Assert.Contains("CONFIRM PASSWORD: ", output);

        var updated = await db.Users.FirstOrDefaultAsync(u => u.Email == updatedEmail);
        Assert.NotNull(updated);
        Assert.Equal("EditedFirst", updated!.FirstName);
        Assert.Equal("EditedLast", updated.Surname);
        Assert.Equal("EditedFirst EditedLast", updated.FullName);
        Assert.True(ScryptPasswordHelper.VerifyPassword("NewResponderPass@2026!", updated.PasswordHash, updated.PasswordSalt));
    }

    [Fact]
    public async Task UserEdit_Type3_Civilians_PasswordChangeYes_Mismatch_AbortsWithoutSaving()
    {
        using var db = CreateInMemoryDbContext();
        await SeedTestUserAsync(
            db,
            "civilian.one@resqtrack.gov.ph",
            "OrigCivilian@2026!",
            "Maria",
            "Clara",
            UserRole.Civilian,
            ResponderUnitType.None);

        string output = await RunCliWithRedirectedConsoleAsync(
            db,
            ["useredit"],
            "3\n1\nMariaEdited\nClaraEdited\ncivilian.changed@resqtrack.gov.ph\nYes\nNewCivilianPass@2026!\nMismatchPass@2026!\n");

        Assert.Contains("[CLI_ERROR] Password and Confirm Password do not match.", output);

        var unchanged = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == "civilian.one@resqtrack.gov.ph");
        Assert.NotNull(unchanged);
        Assert.True(ScryptPasswordHelper.VerifyPassword("OrigCivilian@2026!", unchanged!.PasswordHash, unchanged.PasswordSalt));
    }

    [Theory]
    [InlineData("1", null, UserRole.LDRRMO_Admin, ResponderUnitType.LDRRMO)]
    [InlineData("2", "1", UserRole.Responder, ResponderUnitType.RHU)]
    [InlineData("2", "2", UserRole.Responder, ResponderUnitType.FIRE)]
    [InlineData("2", "3", UserRole.Responder, ResponderUnitType.PNP)]
    [InlineData("3", null, UserRole.Civilian, ResponderUnitType.None)]
    public async Task UserDelete_SpecificUserSelection_ByNumberAndBySearch_DeletesOnlySelectedUser(
        string userTypeOption,
        string? responderSubOption,
        UserRole role,
        ResponderUnitType unit)
    {
        using var db = CreateInMemoryDbContext();
        await SeedTestUserAsync(db, $"keep.{role}.{unit}@resqtrack.gov.ph", "KeepPass@2026!", "Keep", "User", role, unit);
        await SeedTestUserAsync(db, $"remove1.{role}.{unit}@resqtrack.gov.ph", "RemovePass@2026!", "RemoveOne", "User", role, unit);
        await SeedTestUserAsync(db, $"remove2.{role}.{unit}@resqtrack.gov.ph", "RemovePass@2026!", "SearchTarget", "User", role, unit);

        string subInput = responderSubOption != null ? $"{responderSubOption}\n" : string.Empty;

        // 1. Delete by direct number (index 2 in alphabetical order: keep, remove1, remove2)
        string outputByNumber = await RunCliWithRedirectedConsoleAsync(
            db,
            ["userdelete"],
            $"{userTypeOption}\n{subInput}2\n");

        Assert.Contains("USER DELETE", outputByNumber);
        Assert.Contains($"[CLI] User 'remove1.{role}.{unit}@resqtrack.gov.ph' deleted successfully.", outputByNumber);
        Assert.Null(await db.Users.FirstOrDefaultAsync(u => u.Email == $"remove1.{role}.{unit}@resqtrack.gov.ph"));

        // 2. Delete by search keyword ("SearchTarget") then select 1
        string outputBySearch = await RunCliWithRedirectedConsoleAsync(
            db,
            ["userdelete"],
            $"{userTypeOption}\n{subInput}SearchTarget\n1\n");

        Assert.Contains($"[CLI] User 'remove2.{role}.{unit}@resqtrack.gov.ph' deleted successfully.", outputBySearch);
        Assert.Null(await db.Users.FirstOrDefaultAsync(u => u.Email == $"remove2.{role}.{unit}@resqtrack.gov.ph"));
        Assert.NotNull(await db.Users.FirstOrDefaultAsync(u => u.Email == $"keep.{role}.{unit}@resqtrack.gov.ph"));
    }

    [Fact]
    public async Task UserDelete_DeleteAllOption_RequiresYesAndValidAdminPassword_AbortsOnInvalidPassword()
    {
        using var db = CreateInMemoryDbContext();
        await SeedTestUserAsync(
            db,
            "superadmin@resqtrack.gov.ph",
            "MasterAdminPass@2026!",
            "Super",
            "Admin",
            UserRole.LDRRMO_Admin,
            ResponderUnitType.LDRRMO);
        await SeedTestUserAsync(
            db,
            "civ1@resqtrack.gov.ph",
            "CivPass1@2026!",
            "Civ",
            "One",
            UserRole.Civilian,
            ResponderUnitType.None);
        await SeedTestUserAsync(
            db,
            "civ2@resqtrack.gov.ph",
            "CivPass2@2026!",
            "Civ",
            "Two",
            UserRole.Civilian,
            ResponderUnitType.None);

        // 1. Invalid admin password aborts without deleting
        string failedOutput = await RunCliWithRedirectedConsoleAsync(
            db,
            ["userdelete"],
            "3\nALL\nYES\nWrongAdminPassword@2026!\n");

        Assert.Contains("DO YOU WANT TO DELETE ALL? (YES/NO): ", failedOutput);
        Assert.Contains("INPUT ADMIN PASSWORD: ", failedOutput);
        Assert.Contains("[CLI_ERROR] Invalid Admin password. Delete all aborted.", failedOutput);
        Assert.Equal(2, await db.Users.CountAsync(u => u.Role == UserRole.Civilian));

        // 2. Valid admin password deletes all users in category
        string successOutput = await RunCliWithRedirectedConsoleAsync(
            db,
            ["userdelete"],
            "3\nALL\nYES\nMasterAdminPass@2026!\n");

        Assert.Contains("[CLI] SUCCESSFUL: Deleted all (2) users in selected category.", successOutput);
        Assert.Equal(0, await db.Users.CountAsync(u => u.Role == UserRole.Civilian));
        Assert.Equal(1, await db.Users.CountAsync(u => u.Role == UserRole.LDRRMO_Admin));
    }

    [Fact]
    public async Task CliCreatedSuperAdmin_IsProtectedFromFrontendEditSuspendAndDelete_WhileUiAdminAndRespondersRemainManageable()
    {
        using var db = CreateInMemoryDbContext();

        // 1. Create a Superadmin via CLI (createsuperadmin type 2)
        await RunCliWithRedirectedConsoleAsync(
            db,
            ["createsuperadmin"],
            "2\ncli.immutable.admin@resqtrack.gov.ph\nSuperAdmin@2026!\nSuperAdmin@2026!\n");

        // Also seed a second admin so last-admin guard is not the reason for rejection
        var secondCliAdmin = await SeedTestUserAsync(
            db,
            "second.cli.admin@resqtrack.gov.ph",
            "SuperAdmin2@2026!",
            "Second",
            "Admin",
            UserRole.LDRRMO_Admin,
            ResponderUnitType.LDRRMO);

        var cliAdmin = await db.Users.FirstAsync(u => u.Email == "cli.immutable.admin@resqtrack.gov.ph");
        Assert.Equal("CliSuperAdminProvisioned", cliAdmin.IdentityVerificationProvider);
        Assert.True(Backend.Features.Services.Implementations.UserGovernanceService.IsCliCreatedSuperAdmin(cliAdmin));

        var userRepo = new Backend.Features.Repositories.Implementations.UserRepository(db);
        var sessionRepo = new Backend.Features.Repositories.Implementations.SessionRepository(db);
        var auditRepo = new Backend.Features.Repositories.Implementations.AuditLogRepository(db);
        var governance = new Backend.Features.Services.Implementations.UserGovernanceService(userRepo, sessionRepo, auditRepo, db);

        // 2. Verify DTO mapping exposes IsCliProtectedSuperAdmin = true
        var detail = await governance.GetUserDetailAsync(cliAdmin.Id);
        Assert.NotNull(detail);
        Assert.True(detail!.IsCliProtectedSuperAdmin);

        var allUsers = await governance.GetAllUsersAsync();
        var summary = Assert.Single(allUsers, u => u.Id == cliAdmin.Id);
        Assert.True(summary.IsCliProtectedSuperAdmin);

        // 3. Verify Frontend/UI UpdateUserAsync is blocked
        var updateResult = await governance.UpdateUserAsync(
            cliAdmin.Id,
            new Backend.Features.Api.DTOs.UpdateUserRequest(
                FirstName: "Tampered",
                MiddleName: null,
                Surname: "Name",
                Suffix: null,
                DateOfBirth: new DateTime(1990, 1, 1),
                Sex: "Male",
                BloodType: "O+",
                PhoneNumber: "09170000000",
                Province: "Zamboanga del Norte",
                CityOrMunicipality: "Katipunan",
                Barangay: "Uno",
                StreetOrPurok: null,
                EmergencyContactName: "Contact",
                EmergencyContactPhone: "09170000001",
                EmergencyContactRelationship: "Sibling",
                Role: UserRole.LDRRMO_Admin,
                Unit: ResponderUnitType.LDRRMO,
                Status: AccountStatus.Verified,
                DepartmentOrBarangay: "LDRRMO",
                RankOrTitle: "Director",
                EmployeeOrResidentId: "LDRRMO-001"),
            secondCliAdmin.Id);
        Assert.False(updateResult.Success);
        Assert.Contains("CLI-created Superadmin accounts cannot be edited", updateResult.Error);

        // 4. Verify Frontend/UI UpdateProfileAsync is blocked
        var profileResult = await governance.UpdateProfileAsync(
            cliAdmin.Id,
            new Backend.Features.Api.DTOs.UpdateProfileRequest("Tampered Profile", null, null, null, null));
        Assert.False(profileResult.Success);
        Assert.Contains("CLI-created Superadmin accounts cannot be edited", profileResult.Error);

        // 5. Verify Frontend/UI UpdateUserStatusAsync (Suspend / Pending) is blocked
        var suspendResult = await governance.UpdateUserStatusAsync(cliAdmin.Id, secondCliAdmin.Id, AccountStatus.Suspended);
        Assert.False(suspendResult.Success);
        Assert.Contains("CLI-created Superadmin accounts cannot be suspended", suspendResult.Error);

        var restrictResult = await governance.UpdateUserStatusAsync(cliAdmin.Id, secondCliAdmin.Id, AccountStatus.Pending);
        Assert.False(restrictResult.Success);
        Assert.Contains("CLI-created Superadmin accounts cannot be suspended", restrictResult.Error);

        // 6. Verify Frontend/UI DeleteUserAsync is blocked
        var deleteResult = await governance.DeleteUserAsync(cliAdmin.Id, secondCliAdmin.Id, secondCliAdmin.Email);
        Assert.False(deleteResult.Success);
        Assert.Contains("CLI-created Superadmin accounts cannot be deleted", deleteResult.Error);

        // 7. Contrast: Admin created via Frontend UI (CreateUserAsync -> AdminProvisioned) CAN be edited/suspended/deleted
        var uiCreatedAdminResult = await governance.CreateUserAsync(
            new Backend.Features.Api.DTOs.CreateUserRequest(
                Email: "portal.created.admin@resqtrack.gov.ph",
                Password: "PortalAdmin@2026!",
                FirstName: "Portal",
                MiddleName: null,
                Surname: "Admin",
                Suffix: null,
                DateOfBirth: new DateTime(1992, 5, 10),
                Sex: "Female",
                BloodType: "A+",
                PhoneNumber: "09171234567",
                Province: "Zamboanga del Norte",
                CityOrMunicipality: "Katipunan",
                Barangay: "Uno (Pob.)",
                StreetOrPurok: null,
                EmergencyContactName: "Emergency Contact",
                EmergencyContactPhone: "09179998888",
                EmergencyContactRelationship: "Spouse",
                Role: UserRole.LDRRMO_Admin,
                Unit: ResponderUnitType.LDRRMO,
                DepartmentOrBarangay: "LDRRMO Command Center",
                RankOrTitle: "Deputy Officer",
                EmployeeOrResidentId: "LDRRMO-UI-01"),
            cliAdmin.Id);
        Assert.True(uiCreatedAdminResult.Success);
        Assert.NotNull(uiCreatedAdminResult.User);
        Assert.False(uiCreatedAdminResult.User!.IsCliProtectedSuperAdmin);

        var uiAdminEdit = await governance.UpdateUserAsync(
            uiCreatedAdminResult.User.Id,
            new Backend.Features.Api.DTOs.UpdateUserRequest(
                FirstName: "PortalUpdated",
                MiddleName: null,
                Surname: "Admin",
                Suffix: null,
                DateOfBirth: new DateTime(1992, 5, 10),
                Sex: "Female",
                BloodType: "A+",
                PhoneNumber: "09171234567",
                Province: "Zamboanga del Norte",
                CityOrMunicipality: "Katipunan",
                Barangay: "Uno (Pob.)",
                StreetOrPurok: null,
                EmergencyContactName: "Emergency Contact",
                EmergencyContactPhone: "09179998888",
                EmergencyContactRelationship: "Spouse",
                Role: UserRole.LDRRMO_Admin,
                Unit: ResponderUnitType.LDRRMO,
                Status: AccountStatus.Verified,
                DepartmentOrBarangay: "LDRRMO Command Center",
                RankOrTitle: "Deputy Officer",
                EmployeeOrResidentId: "LDRRMO-UI-01"),
            cliAdmin.Id);
        Assert.True(uiAdminEdit.Success);

        var uiAdminSuspend = await governance.UpdateUserStatusAsync(
            uiCreatedAdminResult.User.Id,
            cliAdmin.Id,
            AccountStatus.Suspended);
        Assert.True(uiAdminSuspend.Success);
    }
}
