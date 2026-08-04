using System.Text.Json;
using System.Text.Json.Nodes;
using Docuan.Data;
using Docuan.Services;
using Docuan.DTOs;
using Xunit;

namespace Docuan.Tests;

public class InvoiceServiceTests : IClassFixture<DatabaseFixture>
{
    private readonly InvoiceService _service;
    private readonly AppDbContext _ctx;

    public InvoiceServiceTests(DatabaseFixture fixture)
    {
        _ctx = fixture.CreateContext();
        _service = new InvoiceService(_ctx);
    }

    [Fact]
    public async Task GetAllInvoicesAsync_Should_Return_All_Invoices()
    {
        var result = await _service.GetAllInvoicesAsync();
        Assert.Single(result);
    }

    [Fact]
    public async Task GetInvoiceDetailAsync_Should_Return_Detail()
    {
        var result = await _service.GetInvoiceDetailAsync(1);
        Assert.NotNull(result);
        Assert.Equal("INV-001", result["nomorInvoice"]?.ToString());
    }

    [Fact]
    public async Task GetInvoiceDetailAsync_Should_Return_Null_For_Invalid_Id()
    {
        var result = await _service.GetInvoiceDetailAsync(999);
        Assert.Null(result);
    }

    [Fact]
    public async Task SaveInvoiceAsync_Should_Create_New_Invoice()
    {
        var data = new JsonObject
        {
            ["NomorInvoice"] = "INV-002",
            ["NamaPenagih"] = "PT Baru",
            ["TotalHarga"] = 250000,
            ["FileName"] = "test.pdf",
            ["FileSize"] = 1024,
            ["ContentType"] = "application/pdf"
        };

        var result = await _service.SaveInvoiceAsync(data);
        Assert.True(result["success"]?.GetValue<bool>());
        Assert.Equal("INV-002", result["nomorInvoice"]?.ToString());
    }

    [Fact]
    public async Task SaveInvoiceAsync_Should_Detect_Duplicate()
    {
        var data = new JsonObject
        {
            ["NomorInvoice"] = "INV-001",
            ["NamaPenagih"] = "PT Test",
            ["TotalHarga"] = 500000
        };

        var result = await _service.SaveInvoiceAsync(data);
        Assert.True(result["isDuplicate"]?.GetValue<bool>());
    }

    [Fact]
    public async Task UpdatePaymentAsync_Should_Set_Status_Lunas()
    {
        var request = new PaymentRequest { Status = "Lunas", Method = "Transfer Bank" };
        var result = await _service.UpdatePaymentAsync(1, request);
        Assert.True(result["success"]?.GetValue<bool>());
        Assert.Equal("Lunas", result["paymentStatus"]?.ToString());
    }

    [Fact]
    public async Task UpdatePaymentAsync_Should_Return_Error_For_Invalid_Id()
    {
        var request = new PaymentRequest { Status = "Lunas" };
        var result = await _service.UpdatePaymentAsync(999, request);
        Assert.False(result["success"]?.GetValue<bool>());
    }

    [Fact]
    public async Task DeleteInvoiceAsync_Should_Remove_Invoice()
    {
        var deleted = await _service.DeleteInvoiceAsync(1);
        Assert.True(deleted);
        var invoices = await _service.GetAllInvoicesAsync();
        Assert.Empty(invoices);
    }

    [Fact]
    public async Task DeleteInvoiceAsync_Should_Return_False_For_Invalid_Id()
    {
        var deleted = await _service.DeleteInvoiceAsync(999);
        Assert.False(deleted);
    }
}