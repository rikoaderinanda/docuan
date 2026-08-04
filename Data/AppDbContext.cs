using Microsoft.EntityFrameworkCore;
using Docuan.Models;

namespace Docuan.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<InformasiPembayaran> InformasiPembayaran => Set<InformasiPembayaran>();
    public DbSet<AiProvider> AiProviders => Set<AiProvider>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Invoice -> Vendor (optional)
        modelBuilder.Entity<Invoice>()
            .HasOne(i => i.Vendor)
            .WithMany(v => v.Invoices)
            .HasForeignKey(i => i.VendorId)
            .OnDelete(DeleteBehavior.SetNull);

        // Invoice -> InformasiPembayaran (optional)
        modelBuilder.Entity<Invoice>()
            .HasOne(i => i.InformasiPembayaran)
            .WithMany(p => p.Invoices)
            .HasForeignKey(i => i.InformasiPembayaranId)
            .OnDelete(DeleteBehavior.SetNull);

        // Invoice -> InvoiceItems (cascade delete)
        modelBuilder.Entity<Invoice>()
            .HasMany(i => i.Items)
            .WithOne(ii => ii.Invoice)
            .HasForeignKey(ii => ii.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        // AiProvider configuration
        modelBuilder.Entity<AiProvider>(entity =>
        {
            entity.ToTable("AiProviders");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ProviderName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Model).IsRequired().HasMaxLength(200);
            entity.Property(e => e.ApiKey).IsRequired().HasMaxLength(500);
            entity.Property(e => e.BaseUrl).IsRequired().HasMaxLength(500);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(e => e.Model).IsUnique();
        });

        // Indexes
        modelBuilder.Entity<Invoice>()
            .HasIndex(i => i.NomorInvoice);

        modelBuilder.Entity<Invoice>()
            .HasIndex(i => i.CreatedAt);
    }
}