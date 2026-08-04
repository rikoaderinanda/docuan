using System.Text.Json.Nodes;
using Docuan.Data;
using Docuan.Services;
using Xunit;

namespace Docuan.Tests;

public class ExtractionServiceTests : IClassFixture<DatabaseFixture>
{
    private readonly AppDbContext _ctx;
    private readonly DatabaseFixture _fixture;

    public ExtractionServiceTests(DatabaseFixture fixture)
    {
        _fixture = fixture;
        _ctx = fixture.CreateContext();
    }

    [Fact]
    public async Task GetProvidersToTryAsync_With_Auto_Should_Return_All_Active()
    {
        var service = CreateService();
        var result = await service.GetProvidersToTryAsync("auto");
        Assert.Equal(2, result.Count);
        Assert.All(result, p => Assert.True(p.IsActive));
    }

    [Fact]
    public async Task GetProvidersToTryAsync_With_Specific_Model_Should_Return_One()
    {
        var service = CreateService();
        var result = await service.GetProvidersToTryAsync("test-model-v1");
        Assert.Single(result);
        Assert.Equal("test-model-v1", result[0].Model);
    }

    [Fact]
    public async Task GetProvidersToTryAsync_With_Invalid_Model_Should_Throw()
    {
        var service = CreateService();
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.GetProvidersToTryAsync("nonexistent"));
    }

    [Fact]
    public void ProcessDuplicate_Should_Mark_New_Invoice_As_Not_Duplicate()
    {
        var service = CreateService();
        var data = new JsonObject
        {
            ["NomorInvoice"] = "INV-NEW",
            ["NamaPenagih"] = "PT Baru",
            ["TotalHarga"] = 100000
        };

        var result = new ExtractionFileResult
        {
            FileName = "test.pdf",
            FileSize = 100,
            ContentType = "application/pdf",
            Status = "Extraction success",
            ExtractedData = data,
            UsedModel = "test-model-v1"
        };

        result = service.ProcessDuplicate(result);
        Assert.False(result.IsDuplicate);
    }

    [Fact]
    public void ProcessDuplicate_Should_Mark_Existing_Invoice_As_Duplicate()
    {
        var service = CreateService();
        var data = new JsonObject
        {
            ["NomorInvoice"] = "INV-001",
            ["NamaPenagih"] = "PT Test",
            ["TotalHarga"] = 500000
        };

        var result = new ExtractionFileResult
        {
            FileName = "test.pdf",
            FileSize = 100,
            ContentType = "application/pdf",
            Status = "Extraction success",
            ExtractedData = data,
            UsedModel = "test-model-v1"
        };

        result = service.ProcessDuplicate(result);
        Assert.True(result.IsDuplicate);
        Assert.Contains("ID:", result.DuplicateMessage);
    }

    private ExtractionService CreateService()
    {
        // Use a separate context for the service to avoid tracking conflicts
        var ctx = _fixture.CreateContext();
        var httpClientFactory = new MockHttpClientFactory();
        var ocrService = new OcrService(".");
        return new ExtractionService(ctx, ocrService, httpClientFactory);
    }
}

public class MockHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name = "") => new HttpClient();
}