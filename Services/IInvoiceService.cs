using Docuan.DTOs;
using System.Text.Json.Nodes;

namespace Docuan.Services;

public interface IInvoiceService
{
    Task<List<InvoiceListResponse>> GetAllInvoicesAsync();
    Task<JsonObject?> GetInvoiceDetailAsync(int id);
    Task<JsonObject> SaveInvoiceAsync(JsonObject invoiceData);
    Task<JsonObject> UpdatePaymentAsync(int id, PaymentRequest request);
    Task<bool> DeleteInvoiceAsync(int id);
}