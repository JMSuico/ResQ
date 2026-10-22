// [Layer: Backend/DBInfrastructure]
// Responsibility: Seeds default operational accounts, responder units, fixtures, and settings.
// DO NOT hardcode plain text passwords into user seed data.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data;
using Backend.Features.Data.Enums;
using Backend.Features.Data.Models;
using Backend.Features.Helpers.Infrastructure;

namespace Backend.Features.DBInfrastructure;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(AppDbContext db, IWebHostEnvironment env)
    {
        await db.Database.EnsureCreatedAsync();

        // Idempotent column check for SQL Server (SSMS 19)
        try
        {
            await db.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ValidIdType')
                    ALTER TABLE [Users] ADD [ValidIdType] NVARCHAR(50) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FirstName')
                    ALTER TABLE [Users] ADD [FirstName] NVARCHAR(80) NOT NULL CONSTRAINT DF_Users_FirstName DEFAULT '';

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'MiddleName')
                    ALTER TABLE [Users] ADD [MiddleName] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Surname')
                    ALTER TABLE [Users] ADD [Surname] NVARCHAR(80) NOT NULL CONSTRAINT DF_Users_Surname DEFAULT '';

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Suffix')
                    ALTER TABLE [Users] ADD [Suffix] NVARCHAR(20) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'DateOfBirth')
                    ALTER TABLE [Users] ADD [DateOfBirth] DATETIME2 NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Sex')
                    ALTER TABLE [Users] ADD [Sex] NVARCHAR(20) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'BloodType')
                    ALTER TABLE [Users] ADD [BloodType] NVARCHAR(10) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Province')
                    ALTER TABLE [Users] ADD [Province] NVARCHAR(100) NOT NULL CONSTRAINT DF_Users_Province DEFAULT 'Zamboanga del Norte';

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'CityOrMunicipality')
                    ALTER TABLE [Users] ADD [CityOrMunicipality] NVARCHAR(100) NOT NULL CONSTRAINT DF_Users_City DEFAULT 'Dipolog City';

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Barangay')
                    ALTER TABLE [Users] ADD [Barangay] NVARCHAR(100) NOT NULL CONSTRAINT DF_Users_Barangay DEFAULT '';

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'StreetOrPurok')
                    ALTER TABLE [Users] ADD [StreetOrPurok] NVARCHAR(150) NOT NULL CONSTRAINT DF_Users_StreetOrPurok DEFAULT '';

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'EmergencyContactName')
                    ALTER TABLE [Users] ADD [EmergencyContactName] NVARCHAR(150) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'EmergencyContactPhone')
                    ALTER TABLE [Users] ADD [EmergencyContactPhone] NVARCHAR(30) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'EmergencyContactRelationship')
                    ALTER TABLE [Users] ADD [EmergencyContactRelationship] NVARCHAR(50) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'GovernmentIdType')
                    ALTER TABLE [Users] ADD [GovernmentIdType] NVARCHAR(60) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'GovernmentIdNumber')
                    ALTER TABLE [Users] ADD [GovernmentIdNumber] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ResidencyCategory')
                    ALTER TABLE [Users] ADD [ResidencyCategory] NVARCHAR(50) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'VulnerabilityFlags')
                    ALTER TABLE [Users] ADD [VulnerabilityFlags] NVARCHAR(250) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'MedicalLicenseNumber')
                    ALTER TABLE [Users] ADD [MedicalLicenseNumber] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'MedicalCadre')
                    ALTER TABLE [Users] ADD [MedicalCadre] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'StationHealthCenter')
                    ALTER TABLE [Users] ADD [StationHealthCenter] NVARCHAR(120) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'MedicalCertifications')
                    ALTER TABLE [Users] ADD [MedicalCertifications] NVARCHAR(250) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'AmbulanceCallSign')
                    ALTER TABLE [Users] ADD [AmbulanceCallSign] NVARCHAR(50) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FirefighterRank')
                    ALTER TABLE [Users] ADD [FirefighterRank] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'BfpBadgeNumber')
                    ALTER TABLE [Users] ADD [BfpBadgeNumber] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FireStation')
                    ALTER TABLE [Users] ADD [FireStation] NVARCHAR(120) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FireSpecialization')
                    ALTER TABLE [Users] ADD [FireSpecialization] NVARCHAR(150) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ApparatusCallSign')
                    ALTER TABLE [Users] ADD [ApparatusCallSign] NVARCHAR(50) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PoliceRank')
                    ALTER TABLE [Users] ADD [PoliceRank] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PnpBadgeNumber')
                    ALTER TABLE [Users] ADD [PnpBadgeNumber] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PrecinctOrStation')
                    ALTER TABLE [Users] ADD [PrecinctOrStation] NVARCHAR(120) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PoliceAssignment')
                    ALTER TABLE [Users] ADD [PoliceAssignment] NVARCHAR(120) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'SidearmSerial')
                    ALTER TABLE [Users] ADD [SidearmSerial] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PlantillaNumber')
                    ALTER TABLE [Users] ADD [PlantillaNumber] NVARCHAR(80) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ExecutiveDesignation')
                    ALTER TABLE [Users] ADD [ExecutiveDesignation] NVARCHAR(120) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ClearanceLevel')
                    ALTER TABLE [Users] ADD [ClearanceLevel] NVARCHAR(50) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsDeleted')
                    ALTER TABLE [Users] ADD [IsDeleted] BIT NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT 0;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'DeletedAt')
                    ALTER TABLE [Users] ADD [DeletedAt] DATETIME2 NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'DeletedBy')
                    ALTER TABLE [Users] ADD [DeletedBy] NVARCHAR(180) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'GpsAccuracyMeters')
                    ALTER TABLE [Reports] ADD [GpsAccuracyMeters] FLOAT NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'IsHardwareGeolocated')
                    ALTER TABLE [Reports] ADD [IsHardwareGeolocated] BIT NOT NULL CONSTRAINT DF_Reports_IsHardwareGeolocated DEFAULT 0;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'IsBlurry')
                    ALTER TABLE [Reports] ADD [IsBlurry] BIT NOT NULL CONSTRAINT DF_Reports_IsBlurry DEFAULT 0;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'RequiresManualVerification')
                    ALTER TABLE [Reports] ADD [RequiresManualVerification] BIT NOT NULL CONSTRAINT DF_Reports_RequiresManualVerif DEFAULT 0;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'RecommendedAgencyUnit')
                    ALTER TABLE [Reports] ADD [RecommendedAgencyUnit] NVARCHAR(50) NULL;
            ");
        }
        catch { /* Fallback for InMemory or non-SQL Server providers */ }

        // Ensure capture and reports folders exist with fallback images
        string capturesDir = Path.Combine(env.ContentRootPath, "server-data", "uploads", "captures");
        string reportsDir = Path.Combine(env.ContentRootPath, "server-data", "uploads", "reports");
        Directory.CreateDirectory(capturesDir);
        Directory.CreateDirectory(reportsDir);

        byte[] syntheticPng = CaptureStorageHelper.GenerateSyntheticFallbackPng();
        string sampleIdPath = Path.Combine(capturesDir, "sample_id.png");
        string sampleFacePath = Path.Combine(capturesDir, "sample_face.png");
        string sampleReportPath = Path.Combine(reportsDir, "sample_accident.png");

        if (!File.Exists(sampleIdPath)) await File.WriteAllBytesAsync(sampleIdPath, syntheticPng);
        if (!File.Exists(sampleFacePath)) await File.WriteAllBytesAsync(sampleFacePath, syntheticPng);
        if (!File.Exists(sampleReportPath)) await File.WriteAllBytesAsync(sampleReportPath, syntheticPng);

        // Seed Users
        var users = new List<User>();

        // 1. Super Admin LDRRMO
        var (h1, s1) = ScryptPasswordHelper.HashPassword("LdrrmoCommand@2026!");
        users.Add(new User
        {
            Email = "ldrrmo.admin@resqtrack.gov.ph",
            EmployeeOrResidentId = "LDRRMO-DIR-001",
            FullName = "Director Alejandro Ramos",
            FirstName = "Alejandro",
            MiddleName = "Castro",
            Surname = "Ramos",
            Suffix = null,
            DateOfBirth = new DateTime(1975, 4, 12, 0, 0, 0, DateTimeKind.Utc),
            Sex = "Male",
            BloodType = "O+",
            Province = "Zamboanga del Norte",
            CityOrMunicipality = "Dipolog City",
            Barangay = "Barangay Central",
            StreetOrPurok = "Purok 1, Rizal Avenue Extension",
            EmergencyContactName = "Elena Ramos",
            EmergencyContactPhone = "+63 917 999 1122",
            EmergencyContactRelationship = "Spouse",
            PlantillaNumber = "PLANTILLA-LDRRMO-001",
            ExecutiveDesignation = "Executive Director of Disaster Risk Reduction",
            ClearanceLevel = "Level 4 - Command Authority",
            PhoneNumber = "+63 917 111 2233",
            PasswordHash = h1,
            PasswordSalt = s1,
            Role = UserRole.LDRRMO_Admin,
            Unit = ResponderUnitType.LDRRMO,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            IdCapturePath = sampleIdPath,
            FaceCapturePath = sampleFacePath,
            DepartmentOrBarangay = "Command & Operations Center",
            RankOrTitle = "Executive Director",
            IsDeleted = false
        });

        // 2. RHU Medic
        var (h2, s2) = ScryptPasswordHelper.HashPassword("RhuResponder@2026!");
        users.Add(new User
        {
            Email = "rhu.medic@resqtrack.gov.ph",
            EmployeeOrResidentId = "RHU-MEDIC-042",
            FullName = "Dr. Maria Clara Santos MD",
            FirstName = "Maria Clara",
            MiddleName = "Bautista",
            Surname = "Santos",
            Suffix = "MD",
            DateOfBirth = new DateTime(1988, 8, 24, 0, 0, 0, DateTimeKind.Utc),
            Sex = "Female",
            BloodType = "A+",
            Province = "Zamboanga del Norte",
            CityOrMunicipality = "Dipolog City",
            Barangay = "Barangay Barra",
            StreetOrPurok = "Purok Manga, Health Center Road",
            EmergencyContactName = "Dr. Manuel Santos",
            EmergencyContactPhone = "+63 918 888 2233",
            EmergencyContactRelationship = "Spouse",
            MedicalLicenseNumber = "PRC-MED-0129482",
            MedicalCadre = "Emergency Trauma Physician",
            StationHealthCenter = "Dipolog Main Rural Health Unit 1",
            MedicalCertifications = "BLS, ACLS, PHTLS, Disaster Life Support Certified",
            AmbulanceCallSign = "MEDIC-AMB-01",
            PhoneNumber = "+63 918 222 3344",
            PasswordHash = h2,
            PasswordSalt = s2,
            Role = UserRole.Responder,
            Unit = ResponderUnitType.RHU,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            IdCapturePath = sampleIdPath,
            FaceCapturePath = sampleFacePath,
            DepartmentOrBarangay = "Rural Health Unit 1",
            RankOrTitle = "Medical Officer III",
            IsDeleted = false
        });

        // 3. Fire Responder (BFP)
        var (h3, s3) = ScryptPasswordHelper.HashPassword("BfpResponder@2026!");
        users.Add(new User
        {
            Email = "bfp.fire@resqtrack.gov.ph",
            EmployeeOrResidentId = "BFP-ENG1-105",
            FullName = "Capt. Gabriel Mendoza",
            FirstName = "Gabriel",
            MiddleName = "Soriano",
            Surname = "Mendoza",
            Suffix = null,
            DateOfBirth = new DateTime(1982, 11, 15, 0, 0, 0, DateTimeKind.Utc),
            Sex = "Male",
            BloodType = "B+",
            Province = "Zamboanga del Norte",
            CityOrMunicipality = "Dipolog City",
            Barangay = "Barangay Biasong",
            StreetOrPurok = "Purok Bougainvillea, Fire Station Drive",
            EmergencyContactName = "Carmela Mendoza",
            EmergencyContactPhone = "+63 919 777 3344",
            EmergencyContactRelationship = "Spouse",
            FirefighterRank = "Senior Inspector / Fire Captain",
            BfpBadgeNumber = "BFP-ZN-2016-0492",
            FireStation = "Dipolog Central Fire Station - Engine Company 1",
            FireSpecialization = "Structural Fire Suppression, HazMat First Responder, High-Angle Rescue",
            ApparatusCallSign = "BFP-PUMPER-01",
            PhoneNumber = "+63 919 333 4455",
            PasswordHash = h3,
            PasswordSalt = s3,
            Role = UserRole.Responder,
            Unit = ResponderUnitType.FIRE,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            IdCapturePath = sampleIdPath,
            FaceCapturePath = sampleFacePath,
            DepartmentOrBarangay = "Central Fire Station",
            RankOrTitle = "Fire Captain",
            IsDeleted = false
        });

        // 4. Police Responder (PNP)
        var (h4, s4) = ScryptPasswordHelper.HashPassword("PnpResponder@2026!");
        users.Add(new User
        {
            Email = "pnp.patrol@resqtrack.gov.ph",
            EmployeeOrResidentId = "PNP-PATROL-789",
            FullName = "Patrolman Ricardo Dalisay",
            FirstName = "Ricardo",
            MiddleName = "Valdez",
            Surname = "Dalisay",
            Suffix = null,
            DateOfBirth = new DateTime(1992, 3, 5, 0, 0, 0, DateTimeKind.Utc),
            Sex = "Male",
            BloodType = "O+",
            Province = "Zamboanga del Norte",
            CityOrMunicipality = "Dipolog City",
            Barangay = "Barangay Estaka",
            StreetOrPurok = "Purok Santol, Lopez Jaena St",
            EmergencyContactName = "Lorna Dalisay",
            EmergencyContactPhone = "+63 920 666 4455",
            EmergencyContactRelationship = "Mother",
            PoliceRank = "Patrolman",
            PnpBadgeNumber = "PNP-REG9-88301",
            PrecinctOrStation = "Dipolog City Police Station - Sector 3 Tactical Substation",
            PoliceAssignment = "Mobile Tactical Patrol & Rapid Incident Triage",
            SidearmSerial = "GLOCK-17-PH98342",
            PhoneNumber = "+63 920 444 5566",
            PasswordHash = h4,
            PasswordSalt = s4,
            Role = UserRole.Responder,
            Unit = ResponderUnitType.PNP,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            IdCapturePath = sampleIdPath,
            FaceCapturePath = sampleFacePath,
            DepartmentOrBarangay = "Police Sector 3",
            RankOrTitle = "Patrolman",
            IsDeleted = false
        });

        // 5. Civilian / UG Resident
        var (h5, s5) = ScryptPasswordHelper.HashPassword("CivilianSafe@2026!");
        users.Add(new User
        {
            Email = "resident.juan@resqtrack.gov.ph",
            EmployeeOrResidentId = "UG-RES-2026-99",
            FullName = "Juan Dela Cruz Jr.",
            FirstName = "Juan",
            MiddleName = "Mercado",
            Surname = "Dela Cruz",
            Suffix = "Jr.",
            DateOfBirth = new DateTime(1995, 6, 19, 0, 0, 0, DateTimeKind.Utc),
            Sex = "Male",
            BloodType = "AB+",
            Province = "Zamboanga del Norte",
            CityOrMunicipality = "Dipolog City",
            Barangay = "Barangay San Antonio",
            StreetOrPurok = "Purok Pag-asa, Mabini Street",
            EmergencyContactName = "Maria Dela Cruz",
            EmergencyContactPhone = "+63 922 444 8899",
            EmergencyContactRelationship = "Sister",
            GovernmentIdType = "Philippine National ID (PhilID)",
            GovernmentIdNumber = "PH-ID-7819-2049-8172",
            ResidencyCategory = "Permanent Resident",
            VulnerabilityFlags = "None (Able-bodied)",
            PhoneNumber = "+63 922 555 6677",
            PasswordHash = h5,
            PasswordSalt = s5,
            Role = UserRole.Civilian,
            Unit = ResponderUnitType.None,
            Status = AccountStatus.Verified,
            FaceVerified = true,
            IdCapturePath = sampleIdPath,
            FaceCapturePath = sampleFacePath,
            DepartmentOrBarangay = "Barangay San Antonio",
            RankOrTitle = "Resident Citizen",
            IsDeleted = false
        });

        foreach (var u in users)
        {
            var existing = await db.Users.FirstOrDefaultAsync(x => x.Email == u.Email);
            if (existing == null)
            {
                await db.Users.AddAsync(u);
            }
            else
            {
                existing.EmployeeOrResidentId = u.EmployeeOrResidentId;
                existing.FullName = u.FullName;
                existing.FirstName = u.FirstName;
                existing.MiddleName = u.MiddleName;
                existing.Surname = u.Surname;
                existing.Suffix = u.Suffix;
                existing.DateOfBirth = u.DateOfBirth;
                existing.Sex = u.Sex;
                existing.BloodType = u.BloodType;
                existing.Province = u.Province;
                existing.CityOrMunicipality = u.CityOrMunicipality;
                existing.Barangay = u.Barangay;
                existing.StreetOrPurok = u.StreetOrPurok;
                existing.EmergencyContactName = u.EmergencyContactName;
                existing.EmergencyContactPhone = u.EmergencyContactPhone;
                existing.EmergencyContactRelationship = u.EmergencyContactRelationship;
                existing.PlantillaNumber = u.PlantillaNumber;
                existing.ExecutiveDesignation = u.ExecutiveDesignation;
                existing.ClearanceLevel = u.ClearanceLevel;
                existing.MedicalLicenseNumber = u.MedicalLicenseNumber;
                existing.MedicalCadre = u.MedicalCadre;
                existing.StationHealthCenter = u.StationHealthCenter;
                existing.MedicalCertifications = u.MedicalCertifications;
                existing.AmbulanceCallSign = u.AmbulanceCallSign;
                existing.FirefighterRank = u.FirefighterRank;
                existing.BfpBadgeNumber = u.BfpBadgeNumber;
                existing.FireStation = u.FireStation;
                existing.FireSpecialization = u.FireSpecialization;
                existing.ApparatusCallSign = u.ApparatusCallSign;
                existing.PoliceRank = u.PoliceRank;
                existing.PnpBadgeNumber = u.PnpBadgeNumber;
                existing.PrecinctOrStation = u.PrecinctOrStation;
                existing.PoliceAssignment = u.PoliceAssignment;
                existing.SidearmSerial = u.SidearmSerial;
                existing.GovernmentIdType = u.GovernmentIdType;
                existing.GovernmentIdNumber = u.GovernmentIdNumber;
                existing.ResidencyCategory = u.ResidencyCategory;
                existing.VulnerabilityFlags = u.VulnerabilityFlags;
                existing.DepartmentOrBarangay = u.DepartmentOrBarangay;
                existing.RankOrTitle = u.RankOrTitle;
                existing.Role = u.Role;
                existing.Unit = u.Unit;
                existing.Status = AccountStatus.Verified;
                existing.FaceVerified = true;
                existing.IsDeleted = false;
            }
        }
        await db.SaveChangesAsync();

        // Seed Duty Units
        if (!await db.DutyUnits.AnyAsync())
        {
            var units = new List<DutyUnit>
            {
                new() { UnitCode = "LDRRMO-HQ", UnitName = "LDRRMO Central Command", Agency = ResponderUnitType.LDRRMO, CommanderName = "Dir. Alejandro Ramos", Status = DutyStatus.OnDuty, BaseLatitude = 14.5995, BaseLongitude = 120.9842, ContactHotline = "911 / (02) 8888-0001", ActivePersonnelCount = 12, ShiftSchedule = "24/7 Operations" },
                new() { UnitCode = "RHU-ALPHA", UnitName = "RHU Emergency Medical Unit Alpha", Agency = ResponderUnitType.RHU, CommanderName = "Dr. Maria Clara Santos", Status = DutyStatus.OnDuty, BaseLatitude = 14.6042, BaseLongitude = 120.9895, ContactHotline = "(02) 8888-0112", ActivePersonnelCount = 6, ShiftSchedule = "08:00 - 20:00 (Alpha)" },
                new() { UnitCode = "BFP-ENGINE-01", UnitName = "BFP Engine Company 1", Agency = ResponderUnitType.FIRE, CommanderName = "Capt. Gabriel Mendoza", Status = DutyStatus.Standby, BaseLatitude = 14.5950, BaseLongitude = 120.9780, ContactHotline = "160 / (02) 8888-0160", ActivePersonnelCount = 8, ShiftSchedule = "24/7 Standby" },
                new() { UnitCode = "PNP-SECTOR-01", UnitName = "PNP Patrol Sector 1 Tactical Unit", Agency = ResponderUnitType.PNP, CommanderName = "Lt. Col. Arthur Pendelton", Status = DutyStatus.OnDuty, BaseLatitude = 14.6100, BaseLongitude = 120.9820, ContactHotline = "117 / (02) 8888-0117", ActivePersonnelCount = 10, ShiftSchedule = "12-Hour Roving" }
            };

            await db.DutyUnits.AddRangeAsync(units);
            await db.SaveChangesAsync();
        }

        // Seed Incident Fixtures (Static Map Markers)
        if (!await db.IncidentFixtures.AnyAsync())
        {
            var fixtures = new List<IncidentFixture>
            {
                new() { FixtureCode = "HYD-001", Title = "High-Pressure Fire Hydrant - Main Ave", Category = IncidentCategory.HazardFixture, Severity = IncidentSeverity.Low, Latitude = 14.6010, Longitude = 120.9855, AssignedUnitType = ResponderUnitType.FIRE, IsActive = true, Description = "Inspected monthly. Flow rate: 1200 GPM." },
                new() { FixtureCode = "EVAC-001", Title = "University Sports Complex Evacuation Center", Category = IncidentCategory.NaturalDisaster, Severity = IncidentSeverity.Low, Latitude = 14.6080, Longitude = 120.9890, AssignedUnitType = ResponderUnitType.LDRRMO, IsActive = true, Description = "Capacity: 1,500 families with backup solar power and clean water cistern." },
                new() { FixtureCode = "FLOOD-ZONE-A", Title = "Low-Lying Drainage Flood Monitor Zone", Category = IncidentCategory.NaturalDisaster, Severity = IncidentSeverity.Medium, Latitude = 14.5930, Longitude = 120.9800, AssignedUnitType = ResponderUnitType.LDRRMO, IsActive = true, Description = "Critical flash-flood area during heavy monsoon rains." }
            };

            await db.IncidentFixtures.AddRangeAsync(fixtures);
            await db.SaveChangesAsync();
        }

        // Seed Settings
        if (!await db.Settings.AnyAsync())
        {
            var settings = new List<Settings>
            {
                new() { Key = "EMERGENCY_BROADCAST_TICKER", Value = "NORMAL ADVISORY: All municipal response units active and on high alert.", Category = "Advisory", Description = "Public ticker displayed on civilian dashboard." },
                new() { Key = "AUTO_DISPATCH_PROXIMITY_KM", Value = "5.0", Category = "Triage", Description = "Maximum radius in kilometers for primary unit allocation recommendations." },
                new() { Key = "AUDIT_HASH_CHAINING_ENABLED", Value = "true", Category = "Security", Description = "Enforces cryptographic SHA-256 hash chains across audit records." }
            };

            await db.Settings.AddRangeAsync(settings);
            await db.SaveChangesAsync();
        }

        // Seed Initial Incident Report
        if (!await db.Reports.AnyAsync())
        {
            var juan = await db.Users.FirstOrDefaultAsync(u => u.Email == "resident.juan@resqtrack.gov.ph");
            var rhuUnit = await db.DutyUnits.FirstOrDefaultAsync(d => d.UnitCode == "RHU-ALPHA");

            if (juan != null)
            {
                var report = new Report
                {
                    ReferenceCode = "RESQ-20261020-001",
                    ReporterId = juan.Id,
                    ReporterName = juan.FullName,
                    ReporterRole = juan.Role,
                    Title = "Two-Motorcycle Collision with Minor Injury",
                    Note = "Two riders collided near the campus gate. Minor abrasions, riders are conscious on the curb.",
                    Category = IncidentCategory.VehicularAccident,
                    Severity = IncidentSeverity.Medium,
                    Status = ReportStatus.Allocated,
                    Latitude = 14.6025,
                    Longitude = 120.9860,
                    LocationLabel = "Corner University Ave & Bonifacio St",
                    ImageCapturePath = sampleReportPath,
                    AllocatedUnitId = rhuUnit?.Id,
                    AllocatedUnitCode = rhuUnit?.UnitCode,
                    CreatedAt = DateTime.UtcNow.AddMinutes(-30),
                    VerifiedAt = DateTime.UtcNow.AddMinutes(-25)
                };

                await db.Reports.AddAsync(report);
                await db.SaveChangesAsync();
            }
        }
    }
}
