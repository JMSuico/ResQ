// [Layer: Backend/DBInfrastructure]
// Responsibility: Idempotent per-batch startup schema reconciler ensuring older SQL Server and PostgreSQL
// databases (from prior commits or other PCs) receive all required columns and tables without batch aborts.

using Backend.Features.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Features.DBInfrastructure;

public static class StartupSchemaReconciler
{
    /// <summary>
    /// Reconciles schema columns and auxiliary tables one independent SQL batch at a time so an index or
    /// pre-existing constraint mismatch on one statement never skips downstream table upgrades.
    /// </summary>
    public static async Task ReconcileAsync(AppDbContext db, ILogger logger)
    {
        if (db.Database.IsSqlServer())
        {
            await ReconcileSqlServerAsync(db, logger);
            return;
        }

        if (db.Database.IsNpgsql())
        {
            await ReconcilePostgreSqlAsync(db, logger);
        }
    }

    private static async Task ReconcileSqlServerAsync(AppDbContext db, ILogger logger)
    {
        string[] steps =
        [
            """
            IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NOT NULL
            BEGIN
                IF OBJECT_ID(N'dbo.__EFMigrationsHistory', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[__EFMigrationsHistory] (
                        [MigrationId] NVARCHAR(150) NOT NULL,
                        [ProductVersion] NVARCHAR(32) NOT NULL,
                        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
                    );
                END;

                IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261120000001_InitialBaselineSchema')
                BEGIN
                    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
                    VALUES (N'20261120000001_InitialBaselineSchema', N'10.0.12');
                END;
            END
            """,
            """
            IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='AuditLogs' AND COLUMN_NAME='PreviousHash')
            BEGIN
                ALTER TABLE [AuditLogs] ALTER COLUMN [PreviousHash] NVARCHAR(128) NOT NULL;
                ALTER TABLE [AuditLogs] ALTER COLUMN [CurrentHash] NVARCHAR(128) NOT NULL;
            END
            """,
            """
            IF OBJECT_ID('Reports') IS NOT NULL AND COL_LENGTH('Reports', 'BeaconCount') IS NULL
            BEGIN
                ALTER TABLE [Reports] ADD [CurrentLatitude] FLOAT NULL;
                ALTER TABLE [Reports] ADD [CurrentLongitude] FLOAT NULL;
                ALTER TABLE [Reports] ADD [LastBeaconAt] DATETIME2 NULL;
                ALTER TABLE [Reports] ADD [BeaconCount] INT NOT NULL CONSTRAINT [DF_Reports_BeaconCount] DEFAULT 0;
            END
            """,
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'IdBackCapturePath') IS NULL ALTER TABLE [Users] ADD [IdBackCapturePath] NVARCHAR(500) NULL;",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'Weight') IS NULL ALTER TABLE [Users] ADD [Weight] NVARCHAR(20) NULL;",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'Height') IS NULL ALTER TABLE [Users] ADD [Height] NVARCHAR(20) NULL;",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'DisplayName') IS NULL ALTER TABLE [Users] ADD [DisplayName] NVARCHAR(100) NOT NULL CONSTRAINT [DF_Users_DisplayName] DEFAULT '';",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'IdentityVerificationStatus') IS NULL ALTER TABLE [Users] ADD [IdentityVerificationStatus] NVARCHAR(40) NOT NULL CONSTRAINT [DF_Users_IdentityVerifStatus] DEFAULT 'PendingReview';",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'FacialVerificationStatus') IS NULL ALTER TABLE [Users] ADD [FacialVerificationStatus] NVARCHAR(40) NOT NULL CONSTRAINT [DF_Users_FacialVerifStatus] DEFAULT 'PendingReview';",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'IdentityVerificationProvider') IS NULL ALTER TABLE [Users] ADD [IdentityVerificationProvider] NVARCHAR(60) NOT NULL CONSTRAINT [DF_Users_IdentityVerifProvider] DEFAULT 'ManualIdentityVerificationProvider';",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'FacialVerificationProvider') IS NULL ALTER TABLE [Users] ADD [FacialVerificationProvider] NVARCHAR(60) NOT NULL CONSTRAINT [DF_Users_FacialVerifProvider] DEFAULT 'ManualFacialReviewProvider';",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'IdVerificationTokenId') IS NULL ALTER TABLE [Users] ADD [IdVerificationTokenId] NVARCHAR(64) NULL;",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'FacialVerificationTokenId') IS NULL ALTER TABLE [Users] ADD [FacialVerificationTokenId] NVARCHAR(64) NULL;",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'AutoApprovedByAi') IS NULL ALTER TABLE [Users] ADD [AutoApprovedByAi] BIT NOT NULL CONSTRAINT [DF_Users_AutoApprovedByAi] DEFAULT 0;",
            "IF OBJECT_ID('Users') IS NOT NULL AND COL_LENGTH('Users', 'AutoApprovedAtUtc') IS NULL ALTER TABLE [Users] ADD [AutoApprovedAtUtc] DATETIME2 NULL;",
            """
            IF EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE name = 'IX_Users_Email'
                  AND object_id = OBJECT_ID('Users')
                  AND filter_definition IS NULL
            )
            BEGIN
                DROP INDEX [IX_Users_Email] ON [Users];
                CREATE UNIQUE INDEX [IX_Users_Email] ON [Users]([Email]) WHERE [IsDeleted] = 0;
            END
            """,
            "IF OBJECT_ID('BiometricEnrollments') IS NOT NULL AND COL_LENGTH('BiometricEnrollments', 'GeometricSignatureJson') IS NULL ALTER TABLE [BiometricEnrollments] ADD [GeometricSignatureJson] NVARCHAR(MAX) NULL;",
            "IF OBJECT_ID('BiometricEnrollments') IS NOT NULL AND COL_LENGTH('BiometricEnrollments', 'PoseFramesJson') IS NULL ALTER TABLE [BiometricEnrollments] ADD [PoseFramesJson] NVARCHAR(MAX) NULL;",
            "IF OBJECT_ID('BiometricEnrollments') IS NOT NULL AND COL_LENGTH('BiometricEnrollments', 'TrainingStatus') IS NULL ALTER TABLE [BiometricEnrollments] ADD [TrainingStatus] NVARCHAR(32) NOT NULL CONSTRAINT [DF_BiometricEnrollments_TrainingStatus] DEFAULT 'READY';",
            "IF OBJECT_ID('BiometricEnrollments') IS NOT NULL AND COL_LENGTH('BiometricEnrollments', 'TrainingStartedAtUtc') IS NULL ALTER TABLE [BiometricEnrollments] ADD [TrainingStartedAtUtc] DATETIME2 NULL;",
            "IF OBJECT_ID('BiometricEnrollments') IS NOT NULL AND COL_LENGTH('BiometricEnrollments', 'TrainingReadyTargetUtc') IS NULL ALTER TABLE [BiometricEnrollments] ADD [TrainingReadyTargetUtc] DATETIME2 NULL;",
            "IF OBJECT_ID('BiometricEnrollments') IS NOT NULL AND COL_LENGTH('BiometricEnrollments', 'TrainingCompletedAtUtc') IS NULL ALTER TABLE [BiometricEnrollments] ADD [TrainingCompletedAtUtc] DATETIME2 NULL;",
            "IF OBJECT_ID('BiometricEnrollments') IS NOT NULL AND COL_LENGTH('BiometricEnrollments', 'TrainingNotes') IS NULL ALTER TABLE [BiometricEnrollments] ADD [TrainingNotes] NVARCHAR(MAX) NULL;",
            "IF OBJECT_ID('BiometricEnrollments') IS NOT NULL AND COL_LENGTH('BiometricEnrollments', 'TrainedFrameCount') IS NULL ALTER TABLE [BiometricEnrollments] ADD [TrainedFrameCount] INT NOT NULL CONSTRAINT [DF_BiometricEnrollments_TrainedFrameCount] DEFAULT 0;",
            "IF OBJECT_ID('Reports') IS NOT NULL AND COL_LENGTH('Reports', 'SubmittedIpAddress') IS NULL ALTER TABLE [Reports] ADD [SubmittedIpAddress] NVARCHAR(64) NULL;",
            "IF OBJECT_ID('Reports') IS NOT NULL AND COL_LENGTH('Reports', 'ReporterContactNumber') IS NULL ALTER TABLE [Reports] ADD [ReporterContactNumber] NVARCHAR(40) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'RoboflowModelId') IS NULL ALTER TABLE [dbo].[Reports] ADD [RoboflowModelId] NVARCHAR(120) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'RoboflowPrediction') IS NULL ALTER TABLE [dbo].[Reports] ADD [RoboflowPrediction] NVARCHAR(64) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'RoboflowConfidence') IS NULL ALTER TABLE [dbo].[Reports] ADD [RoboflowConfidence] FLOAT NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'RoboflowNeedsReview') IS NULL ALTER TABLE [dbo].[Reports] ADD [RoboflowNeedsReview] BIT NOT NULL CONSTRAINT [DF_Reports_RoboflowNeedsReview] DEFAULT 1;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'ClaudeModelUsed') IS NULL ALTER TABLE [dbo].[Reports] ADD [ClaudeModelUsed] NVARCHAR(64) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'ClaudeIncidentCategory') IS NULL ALTER TABLE [dbo].[Reports] ADD [ClaudeIncidentCategory] NVARCHAR(64) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'ClaudeSituationSummary') IS NULL ALTER TABLE [dbo].[Reports] ADD [ClaudeSituationSummary] NVARCHAR(1000) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'ClaudeVisibleHazards') IS NULL ALTER TABLE [dbo].[Reports] ADD [ClaudeVisibleHazards] NVARCHAR(600) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'ClaudeUncertaintyNotes') IS NULL ALTER TABLE [dbo].[Reports] ADD [ClaudeUncertaintyNotes] NVARCHAR(600) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'PointerIconType') IS NULL ALTER TABLE [dbo].[Reports] ADD [PointerIconType] NVARCHAR(40) NULL;",
            "IF OBJECT_ID('dbo.Reports') IS NOT NULL AND COL_LENGTH('dbo.Reports', 'AiAnalysisJson') IS NULL ALTER TABLE [dbo].[Reports] ADD [AiAnalysisJson] NVARCHAR(MAX) NULL;",
            """
            IF OBJECT_ID('BiometricEnrollments') IS NOT NULL
            BEGIN
                UPDATE be
                SET [EnrollmentStatus] = 'REVOKED',
                    [RevokedAtUtc] = COALESCE(be.[RevokedAtUtc], GETUTCDATE())
                FROM [BiometricEnrollments] be
                INNER JOIN [Users] u ON u.[Id] = be.[UserId]
                WHERE u.[IsDeleted] = 1
                  AND (be.[RevokedAtUtc] IS NULL OR be.[EnrollmentStatus] <> 'REVOKED');
            END
            """,
            "IF OBJECT_ID('IdentityVerificationRecords') IS NOT NULL AND COL_LENGTH('IdentityVerificationRecords', 'VerificationTokenId') IS NULL ALTER TABLE [IdentityVerificationRecords] ADD [VerificationTokenId] NVARCHAR(64) NULL;",
            "IF OBJECT_ID('IdentityVerificationRecords') IS NOT NULL AND COL_LENGTH('IdentityVerificationRecords', 'AuthenticityVerdict') IS NULL ALTER TABLE [IdentityVerificationRecords] ADD [AuthenticityVerdict] NVARCHAR(40) NULL;",
            "IF OBJECT_ID('IdentityVerificationRecords') IS NOT NULL AND COL_LENGTH('IdentityVerificationRecords', 'FaceToIdMatchScore') IS NULL ALTER TABLE [IdentityVerificationRecords] ADD [FaceToIdMatchScore] DECIMAL(5,4) NULL;",
            "IF OBJECT_ID('IdentityVerificationRecords') IS NOT NULL AND COL_LENGTH('IdentityVerificationRecords', 'AutoApproved') IS NULL ALTER TABLE [IdentityVerificationRecords] ADD [AutoApproved] BIT NOT NULL CONSTRAINT [DF_IdentityVerif_AutoApproved] DEFAULT 0;",
            """
            IF OBJECT_ID('VerificationTokenRecords') IS NULL
            BEGIN
                CREATE TABLE [VerificationTokenRecords] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_VerificationTokenRecords] PRIMARY KEY,
                    [TokenId] NVARCHAR(64) NOT NULL,
                    [TokenType] NVARCHAR(16) NOT NULL,
                    [ImagePairSha256] NVARCHAR(128) NOT NULL,
                    [Verdict] NVARCHAR(40) NOT NULL,
                    [ProviderUsed] NVARCHAR(64) NOT NULL,
                    [ModelUsed] NVARCHAR(64) NOT NULL,
                    [PayloadJson] NVARCHAR(MAX) NOT NULL,
                    [HmacSignature] NVARCHAR(128) NOT NULL,
                    [PairedIdTokenId] UNIQUEIDENTIFIER NULL,
                    [IssuedAtUtc] DATETIME2 NOT NULL,
                    [ExpiresAtUtc] DATETIME2 NOT NULL,
                    [ConsumedAtUtc] DATETIME2 NULL,
                    [ConsumedByUserId] UNIQUEIDENTIFIER NULL,
                    [IsSyntheticTestToken] BIT NOT NULL CONSTRAINT [DF_VerifToken_Synthetic] DEFAULT 0
                );
                CREATE UNIQUE INDEX [IX_VerificationTokenRecords_TokenId] ON [VerificationTokenRecords]([TokenId]);
                CREATE INDEX [IX_VerificationTokenRecords_ExpiresAtUtc_ConsumedAtUtc] ON [VerificationTokenRecords]([ExpiresAtUtc], [ConsumedAtUtc]);
            END
            """,
            """
            IF OBJECT_ID(N'dbo.Reports', N'U') IS NOT NULL
            BEGIN
                UPDATE [dbo].[Reports] SET [Category] = 1 WHERE [Category] < 1 OR [Category] > 6;
                UPDATE [dbo].[Reports] SET [Severity] = 2 WHERE [Severity] < 1 OR [Severity] > 4;
                UPDATE [dbo].[Reports] SET [Status] = 1 WHERE [Status] < 1 OR [Status] > 9;
                UPDATE [dbo].[Reports] SET [Latitude] = 8.5147, [Longitude] = 123.2842 WHERE [Latitude] > 13.0;
            END;
            IF OBJECT_ID(N'dbo.DutyUnits', N'U') IS NOT NULL
            BEGIN
                UPDATE [dbo].[DutyUnits] SET [BaseLatitude] = 8.5136, [BaseLongitude] = 123.2856, [ContactHotline] = N'' WHERE [UnitCode] = N'LDRRMO-HQ' AND ([BaseLatitude] > 13.0 OR [ContactHotline] <> N'');
                UPDATE [dbo].[DutyUnits] SET [BaseLatitude] = 8.5142, [BaseLongitude] = 123.2862, [ContactHotline] = N'' WHERE [UnitCode] = N'RHU-ALPHA' AND ([BaseLatitude] > 13.0 OR [ContactHotline] <> N'');
                UPDATE [dbo].[DutyUnits] SET [BaseLatitude] = 8.5128, [BaseLongitude] = 123.2848, [ContactHotline] = N'' WHERE [UnitCode] = N'BFP-ENGINE-01' AND ([BaseLatitude] > 13.0 OR [ContactHotline] <> N'');
                UPDATE [dbo].[DutyUnits] SET [BaseLatitude] = 8.5160, [BaseLongitude] = 123.2835, [ContactHotline] = N'' WHERE [UnitCode] = N'PNP-SECTOR-01' AND ([BaseLatitude] > 13.0 OR [ContactHotline] <> N'');
                UPDATE [dbo].[DutyUnits] SET [ContactHotline] = N'' WHERE [ContactHotline] <> N'';
            END;
            IF OBJECT_ID(N'dbo.IncidentFixtures', N'U') IS NOT NULL
            BEGIN
                UPDATE [dbo].[IncidentFixtures] SET [Latitude] = 8.5145, [Longitude] = 123.2850 WHERE [Latitude] > 13.0;
            END;
            IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
            BEGIN
                UPDATE [dbo].[Users] SET [CityOrMunicipality] = N'Katipunan' WHERE [CityOrMunicipality] = N'Dipolog City';
            END;
            """
        ];

        foreach (string sql in steps)
        {
            await ExecuteStepSafeAsync(db, sql, logger);
        }
    }

    private static async Task ReconcilePostgreSqlAsync(AppDbContext db, ILogger logger)
    {
        string[] steps =
        [
            """
            DO $$
            BEGIN
                IF to_regclass('public."AuditLogs"') IS NOT NULL THEN
                    CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                        "MigrationId" character varying(150) NOT NULL PRIMARY KEY,
                        "ProductVersion" character varying(32) NOT NULL
                    );
                    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                    VALUES ('20261120000001_InitialBaselineSchema', '10.0.12')
                    ON CONFLICT ("MigrationId") DO NOTHING;
                END IF;
            END $$;
            """,
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"CurrentLatitude\" double precision;",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"CurrentLongitude\" double precision;",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"LastBeaconAt\" timestamp with time zone;",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"BeaconCount\" integer NOT NULL DEFAULT 0;",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"IdBackCapturePath\" character varying(500);",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"Weight\" character varying(20);",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"Height\" character varying(20);",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"DisplayName\" character varying(100) NOT NULL DEFAULT '';",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"IdentityVerificationStatus\" character varying(40) NOT NULL DEFAULT 'PendingReview';",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"FacialVerificationStatus\" character varying(40) NOT NULL DEFAULT 'PendingReview';",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"IdentityVerificationProvider\" character varying(60) NOT NULL DEFAULT 'ManualIdentityVerificationProvider';",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"FacialVerificationProvider\" character varying(60) NOT NULL DEFAULT 'ManualFacialReviewProvider';",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"IdVerificationTokenId\" character varying(64);",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"FacialVerificationTokenId\" character varying(64);",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"AutoApprovedByAi\" boolean NOT NULL DEFAULT false;",
            "ALTER TABLE IF EXISTS \"Users\" ADD COLUMN IF NOT EXISTS \"AutoApprovedAtUtc\" timestamp with time zone;",
            "ALTER TABLE IF EXISTS \"BiometricEnrollments\" ADD COLUMN IF NOT EXISTS \"GeometricSignatureJson\" text;",
            "ALTER TABLE IF EXISTS \"BiometricEnrollments\" ADD COLUMN IF NOT EXISTS \"PoseFramesJson\" text;",
            "ALTER TABLE IF EXISTS \"BiometricEnrollments\" ADD COLUMN IF NOT EXISTS \"TrainingStatus\" character varying(32) NOT NULL DEFAULT 'READY';",
            "ALTER TABLE IF EXISTS \"BiometricEnrollments\" ADD COLUMN IF NOT EXISTS \"TrainingStartedAtUtc\" timestamp with time zone;",
            "ALTER TABLE IF EXISTS \"BiometricEnrollments\" ADD COLUMN IF NOT EXISTS \"TrainingReadyTargetUtc\" timestamp with time zone;",
            "ALTER TABLE IF EXISTS \"BiometricEnrollments\" ADD COLUMN IF NOT EXISTS \"TrainingCompletedAtUtc\" timestamp with time zone;",
            "ALTER TABLE IF EXISTS \"BiometricEnrollments\" ADD COLUMN IF NOT EXISTS \"TrainingNotes\" text;",
            "ALTER TABLE IF EXISTS \"BiometricEnrollments\" ADD COLUMN IF NOT EXISTS \"TrainedFrameCount\" integer NOT NULL DEFAULT 0;",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"SubmittedIpAddress\" character varying(64);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"ReporterContactNumber\" character varying(40);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"RoboflowModelId\" character varying(120);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"RoboflowPrediction\" character varying(64);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"RoboflowConfidence\" double precision;",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"RoboflowNeedsReview\" boolean NOT NULL DEFAULT true;",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"ClaudeModelUsed\" character varying(64);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"ClaudeIncidentCategory\" character varying(64);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"ClaudeSituationSummary\" character varying(1000);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"ClaudeVisibleHazards\" character varying(600);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"ClaudeUncertaintyNotes\" character varying(600);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"PointerIconType\" character varying(40);",
            "ALTER TABLE IF EXISTS \"Reports\" ADD COLUMN IF NOT EXISTS \"AiAnalysisJson\" text;",
            "ALTER TABLE IF EXISTS \"IdentityVerificationRecords\" ADD COLUMN IF NOT EXISTS \"VerificationTokenId\" character varying(64);",
            "ALTER TABLE IF EXISTS \"IdentityVerificationRecords\" ADD COLUMN IF NOT EXISTS \"AuthenticityVerdict\" character varying(40);",
            "ALTER TABLE IF EXISTS \"IdentityVerificationRecords\" ADD COLUMN IF NOT EXISTS \"FaceToIdMatchScore\" numeric(5,4);",
            "ALTER TABLE IF EXISTS \"IdentityVerificationRecords\" ADD COLUMN IF NOT EXISTS \"AutoApproved\" boolean NOT NULL DEFAULT false;",
            """
            CREATE TABLE IF NOT EXISTS "VerificationTokenRecords" (
                "Id" uuid PRIMARY KEY,
                "TokenId" character varying(64) NOT NULL,
                "TokenType" character varying(16) NOT NULL,
                "ImagePairSha256" character varying(128) NOT NULL,
                "Verdict" character varying(40) NOT NULL,
                "ProviderUsed" character varying(64) NOT NULL,
                "ModelUsed" character varying(64) NOT NULL,
                "PayloadJson" text NOT NULL,
                "HmacSignature" character varying(128) NOT NULL,
                "PairedIdTokenId" uuid NULL,
                "IssuedAtUtc" timestamp with time zone NOT NULL,
                "ExpiresAtUtc" timestamp with time zone NOT NULL,
                "ConsumedAtUtc" timestamp with time zone NULL,
                "ConsumedByUserId" uuid NULL,
                "IsSyntheticTestToken" boolean NOT NULL DEFAULT false
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_VerificationTokenRecords_TokenId" ON "VerificationTokenRecords"("TokenId");
            CREATE INDEX IF NOT EXISTS "IX_VerificationTokenRecords_ExpiresAtUtc_ConsumedAtUtc" ON "VerificationTokenRecords"("ExpiresAtUtc", "ConsumedAtUtc");
            """,
            "UPDATE \"Reports\" SET \"Category\" = 1 WHERE \"Category\" < 1 OR \"Category\" > 6;",
            "UPDATE \"Reports\" SET \"Severity\" = 2 WHERE \"Severity\" < 1 OR \"Severity\" > 4;",
            "UPDATE \"Reports\" SET \"Status\" = 1 WHERE \"Status\" < 1 OR \"Status\" > 9;",
            "UPDATE \"Reports\" SET \"Latitude\" = 8.5147, \"Longitude\" = 123.2842 WHERE \"Latitude\" > 13.0;",
            "UPDATE \"DutyUnits\" SET \"BaseLatitude\" = 8.5136, \"BaseLongitude\" = 123.2856, \"ContactHotline\" = '' WHERE \"UnitCode\" = 'LDRRMO-HQ' AND (\"BaseLatitude\" > 13.0 OR \"ContactHotline\" <> '');",
            "UPDATE \"DutyUnits\" SET \"BaseLatitude\" = 8.5142, \"BaseLongitude\" = 123.2862, \"ContactHotline\" = '' WHERE \"UnitCode\" = 'RHU-ALPHA' AND (\"BaseLatitude\" > 13.0 OR \"ContactHotline\" <> '');",
            "UPDATE \"DutyUnits\" SET \"BaseLatitude\" = 8.5128, \"BaseLongitude\" = 123.2848, \"ContactHotline\" = '' WHERE \"UnitCode\" = 'BFP-ENGINE-01' AND (\"BaseLatitude\" > 13.0 OR \"ContactHotline\" <> '');",
            "UPDATE \"DutyUnits\" SET \"BaseLatitude\" = 8.5160, \"BaseLongitude\" = 123.2835, \"ContactHotline\" = '' WHERE \"UnitCode\" = 'PNP-SECTOR-01' AND (\"BaseLatitude\" > 13.0 OR \"ContactHotline\" <> '');",
            "UPDATE \"DutyUnits\" SET \"ContactHotline\" = '' WHERE \"ContactHotline\" <> '';",
            "UPDATE \"IncidentFixtures\" SET \"Latitude\" = 8.5145, \"Longitude\" = 123.2850 WHERE \"Latitude\" > 13.0;",
            "UPDATE \"Users\" SET \"CityOrMunicipality\" = 'Katipunan' WHERE \"CityOrMunicipality\" = 'Dipolog City';"
        ];

        foreach (string sql in steps)
        {
            await ExecuteStepSafeAsync(db, sql, logger);
        }
    }

    private static async Task ExecuteStepSafeAsync(AppDbContext db, string sql, ILogger logger)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Startup schema reconciliation step skipped due to non-fatal condition.");
        }
    }
}
