using Microsoft.EntityFrameworkCore;
using Docuan.Data;
using Docuan.Models;

namespace Docuan.Tests;

public class DatabaseFixture : IDisposable
{
    private int _counter;

    public AppDbContext CreateContext()
    {
        var name = $"TestDb_{Interlocked.Increment(ref _counter)}_{Guid.NewGuid()}";
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        var ctx = new AppDbContext(options);
        Seed(ctx);
        return ctx;
    }

    private static void Seed(AppDbContext ctx)
    {
        ctx.AiProviders.AddRange(
            new AiProvider { Id = 1, ProviderName = "TestAI", Model = "test-model-v1", ApiKey = "key1", BaseUrl = "https://test.ai/api/v1", IsActive = true, CreatedAt = DateTime.UtcNow },
            new AiProvider { Id = 2, ProviderName = "OpenRouter", Model = "openrouter/test-model", ApiKey = "key2", BaseUrl = "https://openrouter.ai/api/v1", IsActive = true, CreatedAt = DateTime.UtcNow },
            new AiProvider { Id = 3, ProviderName = "InactiveAI", Model = "inactive-model", ApiKey = "key3", BaseUrl = "https://inactive.ai/api/v1", IsActive = false, CreatedAt = DateTime.UtcNow }
        );
        ctx.Vendors.Add(new Vendor { Id = 1, Nama = "PT Supplier Utama" });
        ctx.Invoices.Add(new Invoice { Id = 1, NomorInvoice = "INV-001", NamaPenagih = "PT Test", TotalHarga = 500000, PaymentStatus = "Belum Dibayar", CreatedAt = DateTime.UtcNow });
        ctx.SaveChanges();
    }

    public void Dispose() { }
}