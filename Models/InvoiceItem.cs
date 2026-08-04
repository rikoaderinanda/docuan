using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Docuan.Models;

public class InvoiceItem
{
    [Key]
    public int Id { get; set; }

    public int InvoiceId { get; set; }

    [MaxLength(500)]
    public string? NamaBarang { get; set; }

    public int Qty { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal HargaSatuan { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiskonItem { get; set; }

    // Navigation property
    public Invoice Invoice { get; set; } = null!;
}