using Microsoft.AspNetCore.Mvc;
using Docuan.DTOs;
using Docuan.Services;

namespace Docuan.Controllers;

public static class AiProvidersEndpoints
{
    public static void MapAiProviderEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api");

        group.MapGet("/ai-models", async (IAiProviderService service) =>
            Results.Ok(await service.GetActiveModelsAsync()));

        group.MapGet("/ai-providers", async (IAiProviderService service) =>
            Results.Ok(await service.GetAllProvidersAsync()));

        group.MapPost("/ai-providers", async (IAiProviderService service, [FromBody] AiProviderRequest dto) =>
        {
            try
            {
                var result = await service.CreateProviderAsync(dto);
                return Results.Created($"/api/ai-providers/{result.Id}", result);
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPut("/ai-providers/{id:int}",
            async (IAiProviderService service, int id, [FromBody] AiProviderRequest dto) =>
            {
                var result = await service.UpdateProviderAsync(id, dto);
                return result is not null
                    ? Results.Ok(result)
                    : Results.NotFound(new { error = "Provider tidak ditemukan." });
            });

        group.MapDelete("/ai-providers/{id:int}", async (IAiProviderService service, int id) =>
        {
            var deleted = await service.DeleteProviderAsync(id);
            return deleted
                ? Results.Ok(new { message = "Provider berhasil dihapus." })
                : Results.NotFound(new { error = "Provider tidak ditemukan." });
        });
    }
}