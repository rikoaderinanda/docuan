using Tesseract;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace Docuan.Services;

public class OcrService
{
    private readonly string _tessdataPath;

    public OcrService(string tessdataPath)
    {
        _tessdataPath = tessdataPath;
    }

    public string ExtractText(byte[] fileBytes, string contentType)
    {
        if (contentType == "application/pdf")
        {
            return ExtractTextFromPdf(fileBytes);
        }
        else if (contentType.StartsWith("image/"))
        {
            return ExtractTextFromImage(fileBytes);
        }

        throw new NotSupportedException($"Format file {contentType} tidak didukung.");
    }

    private string ExtractTextFromPdf(byte[] fileBytes)
    {
        using var stream = new MemoryStream(fileBytes);
        using var document = PdfDocument.Open(stream);

        var text = new System.Text.StringBuilder();

        foreach (var page in document.GetPages())
        {
            // Extract text directly from PDF
            var pageText = page.Text;
            if (!string.IsNullOrWhiteSpace(pageText))
            {
                text.AppendLine(pageText);
            }
        }

        var extractedText = text.ToString().Trim();

        // If PDF has no extractable text (scanned document), use OCR
        if (string.IsNullOrWhiteSpace(extractedText))
        {
            extractedText = OcrPdfPages(fileBytes);
        }

        return extractedText;
    }

    private string OcrPdfPages(byte[] fileBytes)
    {
        // For scanned PDFs, we extract text via OCR using Tesseract
        // Since PdfPig doesn't have built-in rendering, we'll note this limitation
        return "[Scanned PDF detected. Please upload as image for OCR processing.]";
    }

    private string ExtractTextFromImage(byte[] imageBytes)
    {
        return ExtractTextFromImageBytes(imageBytes);
    }

    private string ExtractTextFromImageBytes(byte[] imageBytes)
    {
        try
        {
            using var engine = new TesseractEngine(_tessdataPath, "ind", EngineMode.Default);
            engine.DefaultPageSegMode = PageSegMode.Auto;

            using var pix = Pix.LoadFromMemory(imageBytes);
            using var page = engine.Process(pix);

            var text = page.GetText();
            return text?.Trim() ?? "";
        }
        catch (Exception ex)
        {
            return $"[OCR Error: {ex.Message}]";
        }
    }
}