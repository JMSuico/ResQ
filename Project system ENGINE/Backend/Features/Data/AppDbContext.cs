// [Layer: Backend/Data]
// Responsibility: EF Core 10 Database Context configuring relational schemas, indexes, and cascades.
// DO NOT write raw, unsanitized SQL queries directly into this context.

using Microsoft.EntityFrameworkCore;
using Backend.Features.Data.Models;

namespace Backend.Features.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<IncidentFixture> IncidentFixtures => Set<IncidentFixture>();
    public DbSet<DutyUnit> DutyUnits => Set<DutyUnit>();
    public DbSet<Settings> Settings => Set<Settings>();
    public DbSet<AlertReadState> AlertReadStates => Set<AlertReadState>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<PatientCareRecord> PatientCareRecords => Set<PatientCareRecord>();
    public DbSet<PoliceBlotterEntry> PoliceBlotterEntries => Set<PoliceBlotterEntry>();
    public DbSet<FireAlarmStatusRecord> FireAlarmStatuses => Set<FireAlarmStatusRecord>();
    public DbSet<IdentityVerificationRecord> IdentityVerificationRecords => Set<IdentityVerificationRecord>();
    public DbSet<BiometricEnrollment> BiometricEnrollments => Set<BiometricEnrollment>();
    public DbSet<UserConsent> UserConsents => Set<UserConsent>();
    public DbSet<LoginAttempt> LoginAttempts => Set<LoginAttempt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User indexes, defaults, and soft-delete global query filter
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.HasIndex(u => u.Role);
            entity.HasIndex(u => u.Status);
            entity.HasIndex(u => u.IsDeleted);
            entity.HasIndex(u => u.EmployeeOrResidentId);
            entity.HasIndex(u => u.PhoneNumber);
            entity.HasIndex(u => u.Barangay);
            entity.HasIndex(u => u.CityOrMunicipality);

            // Global query filter: excludes soft-deleted records by default
            entity.HasQueryFilter(u => !u.IsDeleted);

            entity.Property(u => u.Province).HasDefaultValue("Zamboanga del Norte");
            entity.Property(u => u.CityOrMunicipality).HasDefaultValue("Dipolog City");
            entity.Property(u => u.IsDeleted).HasDefaultValue(false);
            entity.Property(u => u.DisplayName).HasDefaultValue(string.Empty);
            entity.Property(u => u.IdentityVerificationStatus).HasDefaultValue("PendingReview");
            entity.Property(u => u.FacialVerificationStatus).HasDefaultValue("PendingReview");
            entity.Property(u => u.IdentityVerificationProvider).HasDefaultValue("ManualIdentityVerificationProvider");
            entity.Property(u => u.FacialVerificationProvider).HasDefaultValue("ManualFacialReviewProvider");
        });

        // Session indexes and relationships
        modelBuilder.Entity<Session>(entity =>
        {
            entity.HasIndex(s => s.TokenHash).IsUnique();
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => s.IsRevoked);

            entity.HasOne(s => s.User)
                  .WithMany(u => u.Sessions)
                  .HasForeignKey(s => s.UserId)
                  .IsRequired(false)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Report indexes and relationships (DeleteBehavior.NoAction for SQL Server cascade cycles)
        modelBuilder.Entity<Report>(entity =>
        {
            entity.HasIndex(r => r.ReferenceCode).IsUnique();
            entity.HasIndex(r => r.Status);
            entity.HasIndex(r => r.Category);
            entity.HasIndex(r => r.CreatedAt);

            entity.HasOne(r => r.Reporter)
                  .WithMany(u => u.Reports)
                  .HasForeignKey(r => r.ReporterId)
                  .IsRequired(false)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // AlertReadState unique composite index and relationships
        modelBuilder.Entity<AlertReadState>(entity =>
        {
            entity.HasIndex(a => new { a.UserId, a.ReportId }).IsUnique();

            entity.HasOne(a => a.User)
                  .WithMany(u => u.AlertReadStates)
                  .HasForeignKey(a => a.UserId)
                  .IsRequired(false)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(a => a.Report)
                  .WithMany()
                  .HasForeignKey(a => a.ReportId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // DutyUnit index
        modelBuilder.Entity<DutyUnit>(entity =>
        {
            entity.HasIndex(d => d.UnitCode).IsUnique();
            entity.HasIndex(d => d.Agency);
            entity.HasIndex(d => d.Status);
        });

        // Settings index
        modelBuilder.Entity<Settings>(entity =>
        {
            entity.HasIndex(s => s.Key).IsUnique();
        });

        // AuditLog index
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasIndex(a => a.Timestamp);
        });

        // PatientCareRecord index
        modelBuilder.Entity<PatientCareRecord>(entity =>
        {
            entity.HasIndex(p => p.PcrReference).IsUnique();
            entity.HasIndex(p => p.ReportId);
            entity.HasIndex(p => p.CreatedAt);
        });

        // PoliceBlotterEntry index
        modelBuilder.Entity<PoliceBlotterEntry>(entity =>
        {
            entity.HasIndex(b => b.BlotterNumber).IsUnique();
            entity.HasIndex(b => b.ReportId);
            entity.HasIndex(b => b.CreatedAt);
        });

        // FireAlarmStatusRecord index
        modelBuilder.Entity<FireAlarmStatusRecord>(entity =>
        {
            entity.HasIndex(f => f.ReportId);
            entity.HasIndex(f => f.UpdatedAt);
        });

        // IdentityVerificationRecord configuration
        modelBuilder.Entity<IdentityVerificationRecord>(entity =>
        {
            entity.HasIndex(v => v.UserId);
            entity.HasIndex(v => v.GovernmentIdType);
            entity.HasIndex(v => v.GovernmentIdNumber);
            entity.HasIndex(v => v.OverallVerificationStatus);

            entity.HasQueryFilter(v => v.User == null || !v.User.IsDeleted);

            entity.HasOne(v => v.User)
                  .WithMany(u => u.IdentityVerificationRecords)
                  .HasForeignKey(v => v.UserId)
                  .IsRequired(false)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // BiometricEnrollment configuration
        modelBuilder.Entity<BiometricEnrollment>(entity =>
        {
            entity.HasIndex(b => b.UserId);
            entity.HasIndex(b => b.EnrollmentStatus);

            entity.HasQueryFilter(b => b.User == null || !b.User.IsDeleted);

            entity.HasOne(b => b.User)
                  .WithMany(u => u.BiometricEnrollments)
                  .HasForeignKey(b => b.UserId)
                  .IsRequired(false)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // UserConsent configuration
        modelBuilder.Entity<UserConsent>(entity =>
        {
            entity.HasIndex(c => c.UserId);
            entity.HasIndex(c => c.NoticeVersion);

            entity.HasQueryFilter(c => c.User == null || !c.User.IsDeleted);

            entity.HasOne(c => c.User)
                  .WithMany(u => u.UserConsents)
                  .HasForeignKey(c => c.UserId)
                  .IsRequired(false)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // LoginAttempt configuration
        modelBuilder.Entity<LoginAttempt>(entity =>
        {
            entity.HasIndex(l => l.AccountIdentifier);
            entity.HasIndex(l => l.AttemptedAtUtc);
            entity.HasIndex(l => new { l.AccountIdentifier, l.AttemptedAtUtc, l.Success });
        });
    }
}
