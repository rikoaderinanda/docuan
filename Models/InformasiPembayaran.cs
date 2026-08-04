using System.ComponentModel.DataAnnotations;

namespace Docuan.Models;

public class InformasiPembayaran
{
    [Key]
    public int Id { get; set; }

    [MaxLength(100)]
    public string? NamaBank { get; set; }

    [MaxLength(100)]
    public string? NomorRekening { get; set; }

    [MaxLength(200)]
    public string? AtasNama { get; set; }

    // Navigation property
    public List<Invoice> Invoices { get; set; } = new();
}