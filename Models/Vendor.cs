using System.ComponentModel.DataAnnotations;

namespace Docuan.Models;

public class Vendor
{
    [Key]
    public int Id { get; set; }

    [MaxLength(200)]
    public string? Nama { get; set; }

    [MaxLength(500)]
    public string? Website { get; set; }

    [MaxLength(200)]
    public string? ContactPerson { get; set; }

    [MaxLength(500)]
    public string? Alamat { get; set; }

    // Navigation property
    public List<Invoice> Invoices { get; set; } = new();
}