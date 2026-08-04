using Microsoft.AspNetCore.Mvc;
using System.Text.Json.Nodes;
using Docuan.DTOs;
using Docuan.Services;

namespace Docuan.Controllers;

public static class InvoicesEndpoints
{
    public static void MapInvoiceEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/invoices");

        group.MapGet("/", async (IInvoiceService service) =>
            Results.Ok(await service.GetAllInvoicesAsync()));

        group.MapGet("/{id:int}", async (IInvoiceService service, int id) =>
        {
            var result = await service.GetInvoiceDetailAsync(id);
            return result is not null
                ? Results.Ok(result)
                : Results.NotFound(new { error = "Invoice tidak ditemukan." });
        });

        group.MapPost("/save", async (IInvoiceService service, [FromBody] JsonObject invoiceData) =>
        {
            try
            {
                var result = await service.SaveInvoiceAsync(invoiceData);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { success = false, error = ex.Message });
            }
        });

        group.MapPut("/{id:int}/payment", async (IInvoiceService service, int id, [FromBody] PaymentRequest request) =>
        {
            var result = await service.UpdatePaymentAsync(id, request);
            return result["success"]?.GetValue<bool>() == true ? Results.Ok(result) : Results.NotFound(result);
        });

        group.MapDelete("/{id:int}", async (IInvoiceService service, int id) =>
        {
            var deleted = await service.DeleteInvoiceAsync(id);
            return deleted
                ? Results.Ok(new { success = true, message = "Invoice berhasil dihapus." })
                : Results.NotFound(new { error = "Invoice tidak ditemukan." });
        });
    }
}