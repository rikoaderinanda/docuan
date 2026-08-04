using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Docuan.Models;
using Docuan.Services;

namespace Docuan.Controllers;

public static class ExtractionEndpoints
{
    public static void MapExtractionEndpoints(this WebApplication app)
    {
        app.MapPost("/api/extract", async (
            IFormFileCollection files,
            ExtractionService extractionService,
            OcrService ocrService,
            [FromForm] string? model) =>
        {
            if (files == null || files.Count == 0)
                return Results.BadRequest(new { error = "Tidak ada file yang diunggah." });

            List<AiProvider> providersToTry;
            try
            {
                providersToTry = await extractionService.GetProvidersToTryAsync(model);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }

            var extractionTasks = files.Select(async file =>
            {
                if (file.Length == 0)
                    return (object)new
                        { fileName = file.FileName, status = "Error", message = "File tidak boleh kosong." };

                bool isPdf = file.ContentType == "application/pdf";
                bool isImage = file.ContentType.StartsWith("image/");
                if (!isPdf && !isImage)
                    return (object)new
                    {
                        fileName = file.FileName, fileSize = file.Length, contentType = file.ContentType,
                        status = "Error", message = "Format file harus PDF atau Gambar."
                    };

                try
                {
                    using var ms = new MemoryStream();
                    await file.CopyToAsync(ms);
                    var bytes = ms.ToArray();
                    var ocrText = ocrService.ExtractText(bytes, file.ContentType);
                    if (string.IsNullOrWhiteSpace(ocrText))
                        return (object)new
                        {
                            fileName = file.FileName, fileSize = file.Length, contentType = file.ContentType,
                            status = "Error", message = "Gagal mengekstrak teks."
                        };

                    bool success = false;
                    string rawText = "", usedModel = "", lastError = "";
                    foreach (var provider in providersToTry)
                    {
                        var result = await extractionService.CallAiAsync(provider, ocrText);
                        if (result.Success)
                        {
                            success = true;
                            rawText = result.RawAiText;
                            usedModel = result.UsedModel;
                            break;
                        }

                        lastError = result.ErrorMessage;
                        if (model is not null && !model.Equals("auto", StringComparison.OrdinalIgnoreCase)) break;
                    }

                    if (!success)
                        return (object)new
                        {
                            fileName = file.FileName, fileSize = file.Length, contentType = file.ContentType,
                            status = "AI API Error", message = lastError
                        };

                    var cleanJson = rawText.Replace("```json", "").Replace("```", "").Trim();
                    var jsonNode = JsonNode.Parse(cleanJson);
                    var isInvoice = jsonNode?["isInvoice"]?.GetValue<bool>() ?? false;

                    if (!isInvoice)
                    {
                        var errMsg = jsonNode?["pesan"]?.ToString() ?? "Dokumen yang diunggah bukan invoice.";
                        return (object)new
                        {
                            fileName = file.FileName, fileSize = file.Length, contentType = file.ContentType,
                            status = "Rejected", message = errMsg, usedModel
                        };
                    }

                    var fileResult = new ExtractionFileResult
                    {
                        FileName = file.FileName, FileSize = file.Length, ContentType = file.ContentType,
                        Status = "Extraction success", ExtractedData = jsonNode, UsedModel = usedModel
                    };
                    fileResult = extractionService.ProcessDuplicate(fileResult);

                    return (object)new
                    {
                        fileResult.FileName, fileResult.FileSize, fileResult.ContentType, fileResult.Status,
                        extractedData = fileResult.ExtractedData, fileResult.UsedModel, fileResult.IsDuplicate,
                        fileResult.DuplicateMessage
                    };
                }
                catch (Exception ex)
                {
                    return (object)new { fileName = file.FileName, status = "Exception", message = ex.Message };
                }
            });

            var results = await Task.WhenAll(extractionTasks);
            return Results.Ok(new { totalFilesProcessed = files.Count, results });
        }).DisableAntiforgery();
    }
}