using Docuan.DTOs;

namespace Docuan.Services;

public interface IAiProviderService
{
    Task<List<AiModelResponse>> GetActiveModelsAsync();
    Task<List<AiProviderResponse>> GetAllProvidersAsync();
    Task<AiProviderResponse> CreateProviderAsync(AiProviderRequest request);
    Task<AiProviderResponse?> UpdateProviderAsync(int id, AiProviderRequest request);
    Task<bool> DeleteProviderAsync(int id);
}