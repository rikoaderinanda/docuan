using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Nodes;
using Docuan.Data;
using Docuan.DTOs;
using Docuan.Models;

namespace Docuan.Services;

public class InvoiceService : IInvoiceService
{
    private readonly AppDbContext _db;

    public InvoiceService(AppDbContext db) => _db = db;

    public async Task<List<InvoiceListResponse>> GetAllInvoicesAsync()
    {
        return await _db.Invoices
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new InvoiceListResponse
            {
                Id = i.Id,
                NomorInvoice = i.NomorInvoice,
                NomorPurchaseOrder = i.NomorPurchaseOrder,
                NamaPenagih = i.NamaPenagih,
                JenisDokumen = i.JenisDokumen,
                Tanggal = i.Tanggal,
                TotalHarga = i.TotalHarga,
                TotalDiskon = i.TotalDiskon,
                PaymentStatus = i.PaymentStatus,
                PaymentMethod = i.PaymentMethod,
                PaymentDate = i.PaymentDate,
                FileName = i.FileName,
                CreatedAt = i.CreatedAt,
                VendorName = i.Vendor != null ? i.Vendor.Nama : null,
                ItemCount = i.Items.Count
            })
            .ToListAsync();
    }

    public async Task<JsonObject?> GetInvoiceDetailAsync(int id)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Vendor)
            .Include(i => i.InformasiPembayaran)
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (invoice == null) return null;

        var result = new JsonObject
        {
            ["id"] = invoice.Id,
            ["nomorInvoice"] = invoice.NomorInvoice,
            ["nomorPurchaseOrder"] = invoice.NomorPurchaseOrder,
            ["namaPenagih"] = invoice.NamaPenagih,
            ["jenisDokumen"] = invoice.JenisDokumen,
            ["tanggal"] = invoice.Tanggal?.ToString("o"),
            ["totalHarga"] = invoice.TotalHarga,
            ["totalDiskon"] = invoice.TotalDiskon,
            ["paymentStatus"] = invoice.PaymentStatus,
            ["paymentMethod"] = invoice.PaymentMethod,
            ["paymentDate"] = invoice.PaymentDate?.ToString("o"),
            ["fileName"] = invoice.FileName,
            ["fileSize"] = invoice.FileSize,
            ["contentType"] = invoice.ContentType,
            ["createdAt"] = invoice.CreatedAt.ToString("o"),
            ["vendor"] = invoice.Vendor != null
                ? JsonSerializer.SerializeToNode(new
                {
                    invoice.Vendor.Nama, invoice.Vendor.Website,
                    invoice.Vendor.ContactPerson, invoice.Vendor.Alamat
                })
                : null,
            ["informasiPembayaran"] = invoice.InformasiPembayaran != null
                ? JsonSerializer.SerializeToNode(new
                {
                    invoice.InformasiPembayaran.NamaBank,
                    invoice.InformasiPembayaran.NomorRekening,
                    invoice.InformasiPembayaran.AtasNama
                })
                : null,
            ["items"] = JsonSerializer.SerializeToNode(invoice.Items.Select(item => new
            {
                item.NamaBarang, item.Qty, item.HargaSatuan, item.DiskonItem
            }))
        };

        return result;
    }

    public async Task<JsonObject> SaveInvoiceAsync(JsonObject invoiceData)
    {
        var raw = invoiceData;
        var nomorInvoice = raw["NomorInvoice"]?.ToString() ?? "";
        var namaPenagih = raw["NamaPenagih"]?.ToString() ?? "";
        var totalHarga = raw["TotalHarga"] != null
            ? System.Convert.ToDecimal(raw["TotalHarga"]!.GetValue<object>())
            : 0;
        var tanggalStr = raw["Tanggal"]?.ToString();

        DateTime? tanggal = null;
        if (DateTime.TryParse(tanggalStr, out var parsed))
            tanggal = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);

        // Check duplicate
        var duplicate = await _db.Invoices.FirstOrDefaultAsync(i =>
            i.NomorInvoice == nomorInvoice && i.NamaPenagih == namaPenagih &&
            i.TotalHarga == totalHarga && i.Tanggal == tanggal);

        if (duplicate != null)
        {
            return new JsonObject
            {
                ["success"] = JsonNode.Parse("true"),
                ["isDuplicate"] = JsonNode.Parse("true"),
                ["message"] = $"Invoice '{nomorInvoice}' sudah tersimpan sebelumnya.",
                ["invoiceId"] = duplicate.Id,
                ["nomorInvoice"] = duplicate.NomorInvoice
            };
        }

        // Process Vendor
        Vendor? vendor = null;
        var vendorJson = raw["Vendor"];
        if (vendorJson?["Nama"]?.ToString() is { } vendorNama && !string.IsNullOrWhiteSpace(vendorNama))
        {
            vendor = await _db.Vendors.FirstOrDefaultAsync(v => v.Nama == vendorNama);
            if (vendor == null)
            {
                var cp = vendorJson["ContactPerson"];
                vendor = new Vendor
                {
                    Nama = vendorNama,
                    Website = vendorJson["Website"]?.ToString(),
                    ContactPerson = cp?["Nama"]?.ToString() ?? cp?.ToString() ?? "",
                    Alamat = vendorJson["Alamat"]?.ToString()
                };
                _db.Vendors.Add(vendor);
                await _db.SaveChangesAsync();
            }
        }

        // Process Payment Info
        InformasiPembayaran? infoPembayaran = null;
        var paymentJson = raw["InformasiPembayaran"];
        if (paymentJson != null)
        {
            var namaBank = paymentJson["NamaBank"]?.ToString();
            var nomorRekening = paymentJson["NomorRekening"]?.ToString();
            if (!string.IsNullOrWhiteSpace(namaBank) || !string.IsNullOrWhiteSpace(nomorRekening))
            {
                infoPembayaran = new InformasiPembayaran
                {
                    NamaBank = namaBank,
                    NomorRekening = nomorRekening,
                    AtasNama = paymentJson["AtasNama"]?.ToString()
                };
                _db.InformasiPembayaran.Add(infoPembayaran);
                await _db.SaveChangesAsync();
            }
        }

        var invoice = new Invoice
        {
            NomorInvoice = nomorInvoice,
            NomorPurchaseOrder = raw["NomorPurchaseOrder"]?.ToString() ?? "",
            NamaPenagih = namaPenagih,
            JenisDokumen = raw["JenisDokumen"]?.ToString() ?? "Invoice",
            Tanggal = tanggal,
            TotalHarga = totalHarga,
            TotalDiskon = raw["TotalDiskon"]?.GetValue<decimal>() ?? 0,
            VendorId = vendor?.Id,
            InformasiPembayaranId = infoPembayaran?.Id,
            FileName = raw["FileName"]?.ToString() ?? "",
            FileSize = raw["FileSize"]?.GetValue<object>() is object fsVal ? System.Convert.ToInt64(fsVal) : 0,
            ContentType = raw["ContentType"]?.ToString() ?? "",
            PaymentStatus = "Belum Dibayar",
            CreatedAt = DateTime.UtcNow
        };

        var itemsJson = raw["Items"] as JsonArray;
        if (itemsJson != null)
        {
            foreach (var item in itemsJson.OfType<JsonObject>())
            {
                invoice.Items.Add(new InvoiceItem
                {
                    NamaBarang = item["NamaBarang"]?.ToString() ?? "",
                    Qty = item["Qty"]?.GetValue<int>() ?? 0,
                    HargaSatuan = item["HargaSatuan"]?.GetValue<decimal>() ?? 0,
                    DiskonItem = item["DiskonItem"]?.GetValue<decimal>() ?? 0
                });
            }
        }

        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync();

        return new JsonObject
        {
            ["success"] = JsonNode.Parse("true"),
            ["message"] = "Invoice berhasil disimpan.",
            ["invoiceId"] = invoice.Id,
            ["nomorInvoice"] = invoice.NomorInvoice
        };
    }

    public async Task<JsonObject> UpdatePaymentAsync(int id, PaymentRequest request)
    {
        var invoice = await _db.Invoices.FindAsync(id);
        if (invoice == null)
        {
            return new JsonObject
            {
                ["success"] = JsonNode.Parse("false"),
                ["error"] = "Invoice tidak ditemukan."
            };
        }

        invoice.PaymentStatus = request.Status ?? "Lunas";
        if (!string.IsNullOrWhiteSpace(request.Method))
            invoice.PaymentMethod = request.Method;
        if (invoice.PaymentStatus == "Lunas")
            invoice.PaymentDate = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return new JsonObject
        {
            ["success"] = JsonNode.Parse("true"),
            ["message"] = "Status pembayaran berhasil diperbarui.",
            ["id"] = invoice.Id,
            ["paymentStatus"] = invoice.PaymentStatus,
            ["paymentMethod"] = invoice.PaymentMethod,
            ["paymentDate"] = invoice.PaymentDate?.ToString("o")
        };
    }

    public async Task<bool> DeleteInvoiceAsync(int id)
    {
        var invoice = await _db.Invoices.FindAsync(id);
        if (invoice == null) return false;

        _db.Invoices.Remove(invoice);
        await _db.SaveChangesAsync();
        return true;
    }
}