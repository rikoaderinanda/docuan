using Microsoft.EntityFrameworkCore;
using Docuan.Data;
using Docuan.DTOs;
using Docuan.Models;

namespace Docuan.Services;

public class AiProviderService : IAiProviderService
{
    private readonly AppDbContext _db;

    public AiProviderService(AppDbContext db) => _db = db;

    public async Task<List<AiModelResponse>> GetActiveModelsAsync()
    {
        return await _db.AiProviders
            .Where(p => p.IsActive)
            .Select(p => new AiModelResponse
            {
                Id = p.Model,
                Name = $"{p.ProviderName} - {p.Model}",
                Provider = p.ProviderName
            })
            .ToListAsync();
    }

    public async Task<List<AiProviderResponse>> GetAllProvidersAsync()
    {
        return await _db.AiProviders
            .OrderBy(p => p.ProviderName)
            .Select(p => new AiProviderResponse
            {
                Id = p.Id,
                ProviderName = p.ProviderName,
                Model = p.Model,
                ApiKey = p.ApiKey,
                BaseUrl = p.BaseUrl,
                IsActive = p.IsActive,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .ToListAsync();
    }

    public async Task<AiProviderResponse> CreateProviderAsync(AiProviderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProviderName) ||
            string.IsNullOrWhiteSpace(request.Model) ||
            string.IsNullOrWhiteSpace(request.ApiKey) ||
            string.IsNullOrWhiteSpace(request.BaseUrl))
            throw new ArgumentException("Semua field harus diisi.");

        var existing = await _db.AiProviders.FirstOrDefaultAsync(p => p.Model == request.Model);
        if (existing != null)
            throw new InvalidOperationException($"Model '{request.Model}' sudah terdaftar.");

        var provider = new AiProvider
        {
            ProviderName = request.ProviderName,
            Model = request.Model,
            ApiKey = request.ApiKey,
            BaseUrl = request.BaseUrl,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _db.AiProviders.Add(provider);
        await _db.SaveChangesAsync();

        return MapToResponse(provider);
    }

    public async Task<AiProviderResponse?> UpdateProviderAsync(int id, AiProviderRequest request)
    {
        var provider = await _db.AiProviders.FindAsync(id);
        if (provider == null) return null;

        if (!string.IsNullOrWhiteSpace(request.ProviderName)) provider.ProviderName = request.ProviderName;
        if (!string.IsNullOrWhiteSpace(request.Model)) provider.Model = request.Model;
        if (!string.IsNullOrWhiteSpace(request.ApiKey)) provider.ApiKey = request.ApiKey;
        if (!string.IsNullOrWhiteSpace(request.BaseUrl)) provider.BaseUrl = request.BaseUrl;
        provider.IsActive = request.IsActive;
        provider.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapToResponse(provider);
    }

    public async Task<bool> DeleteProviderAsync(int id)
    {
        var provider = await _db.AiProviders.FindAsync(id);
        if (provider == null) return false;

        _db.AiProviders.Remove(provider);
        await _db.SaveChangesAsync();
        return true;
    }

    private static AiProviderResponse MapToResponse(AiProvider p) => new()
    {
        Id = p.Id,
        ProviderName = p.ProviderName,
        Model = p.Model,
        ApiKey = p.ApiKey,
        BaseUrl = p.BaseUrl,
        IsActive = p.IsActive,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}