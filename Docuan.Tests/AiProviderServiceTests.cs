using Docuan.Data;
using Docuan.Services;
using Docuan.DTOs;
using Xunit;

namespace Docuan.Tests;

public class AiProviderServiceTests : IClassFixture<DatabaseFixture>
{
    private readonly AiProviderService _service;
    private readonly AppDbContext _ctx;

    public AiProviderServiceTests(DatabaseFixture fixture)
    {
        _ctx = fixture.CreateContext();
        _service = new AiProviderService(_ctx);
    }

    [Fact]
    public async Task GetActiveModelsAsync_Should_Return_Only_Active_Providers()
    {
        var result = await _service.GetActiveModelsAsync();
        Assert.Equal(2, result.Count);
        Assert.All(result, m => Assert.NotEmpty(m.Id));
    }

    [Fact]
    public async Task GetAllProvidersAsync_Should_Return_All_Providers()
    {
        var result = await _service.GetAllProvidersAsync();
        Assert.Equal(3, result.Count);
    }

    [Fact]
    public async Task CreateProviderAsync_Should_Add_New_Provider()
    {
        var request = new AiProviderRequest
        {
            ProviderName = "NewAI",
            Model = "new-model",
            ApiKey = "new-key",
            BaseUrl = "https://new.ai/v1",
            IsActive = true
        };
        var result = await _service.CreateProviderAsync(request);
        Assert.Equal("NewAI", result.ProviderName);
        Assert.Equal("new-model", result.Model);
    }

    [Fact]
    public async Task CreateProviderAsync_Should_Throw_On_Duplicate_Model()
    {
        var request = new AiProviderRequest
        {
            ProviderName = "TestAI",
            Model = "test-model-v1",
            ApiKey = "key1",
            BaseUrl = "https://test.ai/v1"
        };
        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.CreateProviderAsync(request));
    }

    [Fact]
    public async Task UpdateProviderAsync_Should_Modify_Existing_Provider()
    {
        var request = new AiProviderRequest
        {
            ProviderName = "UpdatedAI",
            Model = "updated-model",
            ApiKey = "updated-key",
            BaseUrl = "https://updated.ai/v1",
            IsActive = false
        };
        var result = await _service.UpdateProviderAsync(1, request);
        Assert.NotNull(result);
        Assert.Equal("UpdatedAI", result.ProviderName);
        Assert.False(result.IsActive);
    }

    [Fact]
    public async Task UpdateProviderAsync_Should_Return_Null_For_Invalid_Id()
    {
        var request = new AiProviderRequest { ProviderName = "X", Model = "x", ApiKey = "x", BaseUrl = "x" };
        var result = await _service.UpdateProviderAsync(999, request);
        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteProviderAsync_Should_Remove_Provider()
    {
        var deleted = await _service.DeleteProviderAsync(3);
        Assert.True(deleted);
        var providers = await _service.GetAllProvidersAsync();
        Assert.Equal(2, providers.Count);
    }

    [Fact]
    public async Task DeleteProviderAsync_Should_Return_False_For_Invalid_Id()
    {
        var deleted = await _service.DeleteProviderAsync(999);
        Assert.False(deleted);
    }
}