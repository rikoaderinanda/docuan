using System.Text.Json.Nodes;

namespace Docuan.DTOs;

public class SaveInvoiceRequest
{
    public string? NomorInvoice { get; set; }
    public string? NomorPurchaseOrder { get; set; }
    public string? NamaPenagih { get; set; }
    public string? JenisDokumen { get; set; }
    public string? Tanggal { get; set; }
    public decimal TotalHarga { get; set; }
    public decimal TotalDiskon { get; set; }
    public JsonObject? Vendor { get; set; }
    public JsonObject? InformasiPembayaran { get; set; }
    public JsonArray? Items { get; set; }
    public string? FileName { get; set; }
    public long FileSize { get; set; }
    public string? ContentType { get; set; }
}

public class InvoiceListResponse
{
    public int Id { get; set; }
    public string? NomorInvoice { get; set; }
    public string? NomorPurchaseOrder { get; set; }
    public string? NamaPenagih { get; set; }
    public string? JenisDokumen { get; set; }
    public DateTime? Tanggal { get; set; }
    public decimal TotalHarga { get; set; }
    public decimal TotalDiskon { get; set; }
    public string? PaymentStatus { get; set; }
    public string? PaymentMethod { get; set; }
    public DateTime? PaymentDate { get; set; }
    public string? FileName { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? VendorName { get; set; }
    public int ItemCount { get; set; }
}

public class PaymentRequest
{
    public string? Status { get; set; }
    public string? Method { get; set; }
}