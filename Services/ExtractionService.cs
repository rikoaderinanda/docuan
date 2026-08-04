using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Nodes;
using Docuan.Data;
using Docuan.Models;

namespace Docuan.Services;

public class AiCallResult
{
    public bool Success { get; set; }
    public string RawAiText { get; set; } = "";
    public string ErrorMessage { get; set; } = "";
    public string UsedModel { get; set; } = "";
}

public class ExtractionFileResult
{
    public string FileName { get; set; } = "";
    public long FileSize { get; set; }
    public string ContentType { get; set; } = "";
    public string Status { get; set; } = "";
    public string? Message { get; set; }
    public JsonNode? ExtractedData { get; set; }
    public string? UsedModel { get; set; }
    public bool? IsDuplicate { get; set; }
    public string? DuplicateMessage { get; set; }
}

public class ExtractionService
{
    private readonly AppDbContext _db;
    private readonly OcrService _ocrService;
    private readonly IHttpClientFactory _httpClientFactory;

    private static readonly string SystemPrompt =
        @"Kamu adalah sistem data entry cerdas. Berikut adalah teks hasil OCR (Optical Character Recognition) dari sebuah dokumen. Analisis teks tersebut dan tentukan apakah dokumen tersebut adalah sebuah Invoice (Faktur).

Kembalikan HANYA dalam format JSON murni tanpa markdown dengan aturan berikut:

1. Jika teks BUKAN sebuah invoice:
{
  ""isInvoice"": false,
  ""pesan"": ""Dokumen yang diunggah bukan sebuah invoice.""
}

2. Jika teks BENAR sebuah invoice: { ""isInvoice"": true, ""JenisDokumen"": ""Invoice"", ""NomorInvoice"": """", ... }";

    public ExtractionService(AppDbContext db, OcrService ocrService, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _ocrService = ocrService;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<List<AiProvider>> GetProvidersToTryAsync(string? model)
    {
        var isAutoPilot = string.IsNullOrWhiteSpace(model) || model.Equals("auto", StringComparison.OrdinalIgnoreCase);
        if (isAutoPilot)
        {
            var providers = await _db.AiProviders.Where(p => p.IsActive).OrderBy(p => p.Id).ToListAsync();
            if (providers.Count == 0) throw new InvalidOperationException("Tidak ada provider AI yang aktif.");
            return providers;
        }

        var provider = await _db.AiProviders.FirstOrDefaultAsync(p => p.Model == model && p.IsActive);
        if (provider == null) throw new InvalidOperationException($"Model '{model}' tidak ditemukan.");
        return new List<AiProvider> { provider };
    }

    public async Task<AiCallResult> CallAiAsync(AiProvider provider, string ocrText)
    {
        var client = _httpClientFactory.CreateClient();
        bool isGemini = provider.BaseUrl.ToLower().Contains("generativelanguage.googleapis.com");

        HttpResponseMessage response;
        if (!isGemini)
        {
            client.DefaultRequestHeaders.Remove("Authorization");
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {provider.ApiKey}");
            response = await client.PostAsJsonAsync($"{provider.BaseUrl}/chat/completions", new
            {
                model = provider.Model,
                messages = new[]
                {
                    new { role = "system", content = SystemPrompt },
                    new { role = "user", content = $"OCR:\n\n{ocrText}" }
                }
            });
        }
        else
        {
            response = await client.PostAsJsonAsync(
                $"{provider.BaseUrl}/models/{provider.Model}:generateContent?key={provider.ApiKey}", new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new object[] { new { text = SystemPrompt }, new { text = $"OCR:\n\n{ocrText}" } }
                        }
                    }
                });
        }

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            return new AiCallResult
            {
                Success = false, ErrorMessage = $"[{provider.ProviderName}] {(int)response.StatusCode}: {error}",
                UsedModel = provider.Model
            };
        }

        var json = await response.Content.ReadFromJsonAsync<JsonObject>();
        string rawText = !isGemini
            ? json?["choices"]?[0]?["message"]?["content"]?.ToString() ?? "{}"
            : json?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.ToString() ?? "{}";

        return new AiCallResult { Success = true, RawAiText = rawText, UsedModel = provider.Model };
    }

    public ExtractionFileResult ProcessDuplicate(ExtractionFileResult result)
    {
        var data = result.ExtractedData as JsonObject;
        if (data != null)
        {
            var nomorInv = data["NomorInvoice"]?.ToString() ?? "";
            var namaPen = data["NamaPenagih"]?.ToString() ?? "";
            var totalHrg = data["TotalHarga"] != null
                ? Convert.ToDecimal(data["TotalHarga"].GetValue<string>())
                : 0;
            DateTime? tgl = null;
            if (DateTime.TryParse(data["Tanggal"]?.ToString(), out var pt))
                tgl = DateTime.SpecifyKind(pt, DateTimeKind.Utc);

            var dup = _db.Invoices.FirstOrDefault(i =>
                i.NomorInvoice == nomorInv && i.NamaPenagih == namaPen && i.TotalHarga == totalHrg && i.Tanggal == tgl);
            if (dup != null)
            {
                result.IsDuplicate = true;
                result.DuplicateMessage = $"Sudah tersimpan (ID: {dup.Id})";
            }
            else result.IsDuplicate = false;
        }

        return result;
    }

    public async Task<ExtractionFileResult> ExtractAndSaveInvoiceAsync(byte[] fileBytes, string fileName,
        string contentType)
    {
        var ocrText = await _ocrService.ExtractTextAsync(fileBytes);
        var providers = await GetProvidersToTryAsync(null);
        var aiResult = await CallAiAsync(providers.First(), ocrText);

        if (!aiResult.Success)
        {
            return new ExtractionFileResult
            {
                FileName = fileName,
                FileSize = fileBytes.Length,
                ContentType = contentType,
                Status = "Failed",
                Message = aiResult.ErrorMessage
            };
        }

        var extractedData = JsonSerializer.Deserialize<JsonObject>(aiResult.RawAiText);
        if (extractedData == null || !extractedData.ContainsKey("isInvoice") || !(bool)extractedData["isInvoice"])
        {
            return new ExtractionFileResult
            {
                FileName = fileName,
                FileSize = fileBytes.Length,
                ContentType = contentType,
                Status = "NotInvoice",
                Message = "Dokumen yang diunggah bukan sebuah invoice."
            };
        }

        var invoice = new Invoice
        {
            NomorInvoice = extractedData["NomorInvoice"]?.ToString(),
            NamaPenagih = extractedData["NamaPenagih"]?.ToString(),
            TotalHarga = extractedData["TotalHarga"] != null
                ? Convert.ToDecimal(extractedData["TotalHarga"].GetValue<string>())
                : 0,
            Tanggal = DateTime.TryParse(extractedData["Tanggal"]?.ToString(), out var pt)
                ? DateTime.SpecifyKind(pt, DateTimeKind.Utc)
                : (DateTime?)null,
            InformasiPembayaran = new InformasiPembayaran
            {
                MetodePembayaran = extractedData["MetodePembayaran"]?.ToString(),
                Bank = extractedData["Bank"]?.ToString(),
                NomorRekening = extractedData["NomorRekening"]?.ToString()
            },
            Vendor = new Vendor
            {
                NamaVendor = extractedData["NamaVendor"]?.ToString(),
                AlamatVendor = extractedData["AlamatVendor"]?.ToString()
            }
        };

        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync();

        return new ExtractionFileResult
        {
            FileName = fileName,
            FileSize = fileBytes.Length,
            ContentType = contentType,
            Status = "Success",
            Message = "Invoice berhasil disimpan.",
            ExtractedData = extractedData,
            UsedModel = aiResult.UsedModel
        };
    }
}