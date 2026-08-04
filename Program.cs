using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Docuan.Data;
using Docuan.Services;
using Docuan.Controllers;

var builder = WebApplication.CreateBuilder(args);

// ========== Services ==========
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => { policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader(); });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var tessdataPath = Path.Combine(builder.Environment.ContentRootPath, "tessdata");
builder.Services.AddSingleton(new OcrService(tessdataPath));

// Register application services
builder.Services.AddScoped<IAiProviderService, AiProviderService>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<ExtractionService>();

var app = builder.Build();
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ========== Database Initialization ==========
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""AiProviders"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""ProviderName"" VARCHAR(100) NOT NULL,
            ""Model"" VARCHAR(200) NOT NULL,
            ""ApiKey"" VARCHAR(500) NOT NULL,
            ""BaseUrl"" VARCHAR(500) NOT NULL,
            ""IsActive"" BOOLEAN DEFAULT TRUE,
            ""CreatedAt"" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ""UpdatedAt"" TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_AiProviders_Model"" ON ""AiProviders"" (""Model"");
    ");

    db.Database.ExecuteSqlRaw(@"
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoices' AND column_name = 'PaymentStatus') THEN
                ALTER TABLE ""Invoices"" ADD COLUMN ""PaymentStatus"" VARCHAR(50) DEFAULT 'Belum Dibayar';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoices' AND column_name = 'PaymentMethod') THEN
                ALTER TABLE ""Invoices"" ADD COLUMN ""PaymentMethod"" VARCHAR(100) NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoices' AND column_name = 'PaymentDate') THEN
                ALTER TABLE ""Invoices"" ADD COLUMN ""PaymentDate"" TIMESTAMP NULL;
            END IF;
        END
        $$;
    ");
}

// ========== Map Endpoints ==========
app.MapAiProviderEndpoints();
app.MapInvoiceEndpoints();
app.MapExtractionEndpoints();

app.Run();