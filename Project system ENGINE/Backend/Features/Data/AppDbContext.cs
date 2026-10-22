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
        });

        // Session indexes
        modelBuilder.Entity<Session>(entity =>
        {
            entity.HasIndex(s => s.TokenHash).IsUnique();
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => s.IsRevoked);
        });

        // Report indexes and relationships (DeleteBehavior.NoAction for SQL Server cascade cycles)
        modelBuilder.Entity<Report>(entity =>
        {
            entity.HasIndex(r => r.ReferenceCode).IsUnique();
            entity.HasIndex(r => r.Status);
            entity.HasIndex(r => r.Category);
            entity.HasIndex(r => r.CreatedAt);

            entity.HasOne(r => r.Reporter)
                  .WithMany()
                  .HasForeignKey(r => r.ReporterId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // AlertReadState unique composite index and relationships
        modelBuilder.Entity<AlertReadState>(entity =>
        {
            entity.HasIndex(a => new { a.UserId, a.ReportId }).IsUnique();

            entity.HasOne(a => a.User)
                  .WithMany(u => u.AlertReadStates)
                  .HasForeignKey(a => a.UserId)
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
    }
}
