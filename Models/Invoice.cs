using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Docuan.Models;

public class Invoice
{
    [Key] public int Id { get; set; }

    [MaxLength(100)] public string? NomorInvoice { get; set; }

    [MaxLength(100)] public string? NomorPurchaseOrder { get; set; }

    [MaxLength(200)] public string? NamaPenagih { get; set; }

    [MaxLength(50)] public string? JenisDokumen { get; set; }

    public DateTime? Tanggal { get; set; }

    [Column(TypeName = "decimal(18,2)")] public decimal TotalHarga { get; set; }

    [Column(TypeName = "decimal(18,2)")] public decimal TotalDiskon { get; set; }

    // Vendor relationship
    public int? VendorId { get; set; }
    public Vendor? Vendor { get; set; }

    // Payment Info relationship
    public int? InformasiPembayaranId { get; set; }
    public InformasiPembayaran? InformasiPembayaran { get; set; }

    // Items relationship
    public List<InvoiceItem> Items { get; set; } = new();

    // Payment
    [MaxLength(50)] public string? PaymentStatus { get; set; } = "Belum Dibayar";

    [MaxLength(100)] public string? PaymentMethod { get; set; }

    public DateTime? PaymentDate { get; set; }

    // Metadata
    [MaxLength(255)] public string? FileName { get; set; }

    public long FileSize { get; set; }

    [MaxLength(100)] public string? ContentType { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}