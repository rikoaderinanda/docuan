# 🧾 Docuan — Ekstrak Data Dokumen Otomatis

Aplikasi web untuk mengekstrak data invoice secara otomatis dari dokumen **PDF** dan **gambar** menggunakan teknologi **OCR (Optical Character Recognition)** dan **AI (Large Language Model)**. Docuan membantu mengubah dokumen invoice fisik/digital menjadi data terstruktur yang siap disimpan dan dikelola.

---

## ✨ Fitur

- 📄 **Ekstraksi Data Invoice Otomatis** — Unggah PDF atau gambar (JPG/PNG), data invoice (nomor, tanggal, total harga, vendor, item, informasi pembayaran, dll.) diekstrak otomatis.
- 🧠 **Multi-Provider AI** — Mendukung berbagai provider AI (OpenAI-compatible & Google Gemini) dengan sistem **fallback otomatis** antar model jika salah satu gagal.
- 🔍 **Validasi Dokumen** — Mendeteksi apakah dokumen yang diunggah benar-benar invoice atau bukan.
- 🔁 **Deteksi Duplikat** — Mencegah penyimpanan invoice yang sama lebih dari sekali (berdasarkan nomor invoice, nama penagih, total harga, dan tanggal).
- 💾 **Manajemen Invoice** — Simpan, lihat detail, tandai status pembayaran (Lunas/Belum Dibayar), dan hapus invoice.
- ⚙️ **Manajemen AI Provider** — Tambah, edit, aktifkan/nonaktifkan, dan hapus konfigurasi provider AI langsung dari UI.
- 🖼️ **Drag & Drop Upload** — Unggah hingga 5 file sekaligus dengan preview gambar.
- 🌐 **Frontend Modern** — UI dibangun dengan React 19 + Tailwind CSS.

---

## 🛠️ Teknologi

### Backend
| Teknologi | Kegunaan |
|---|---|
| ASP.NET Core 10 | Web API framework |
| Entity Framework Core 10 | ORM untuk akses database |
| PostgreSQL (Neon) | Database relasional |
| Tesseract OCR | Optical Character Recognition (bahasa Indonesia) |
| PdfPig | Ekstraksi teks dari file PDF |
| Swagger / OpenAPI | Dokumentasi API |
| Newtonsoft.Json | Parsing JSON |

### Frontend
| Teknologi | Kegunaan |
|---|---|
| React 19 | UI framework |
| Tailwind CSS 3 | Styling & utility classes |
| react-scripts 5 | Build & development server |

### Testing
- **xUnit** — Unit test untuk services (Extraction, Invoice, AiProvider)

---

## 📁 Struktur Proyek

```
Docuan/
├── Controllers/          # Endpoint definitions (Minimal API)
│   ├── AiProvidersController.cs
│   ├── ExtractionController.cs
│   └── InvoicesController.cs
├── Data/
│   └── AppDbContext.cs   # EF Core database context
├── DTOs/                 # Data Transfer Objects
├── Docuan.Tests/         # Unit tests (xUnit)
├── Migrations/           # EF Core migrations
├── Models/               # Entity models (Invoice, Vendor, Item, dll.)
├── Services/             # Business logic
│   ├── AiProviderService.cs
│   ├── AiService.cs
│   ├── ExtractionService.cs
│   ├── InvoiceService.cs
│   └── OcrService.cs
├── Properties/
│   └── launchSettings.json
├── frontend/             # React frontend application
│   ├── public/
│   └── src/
└── Program.cs            # Application entry point
```

---

## 🚀 Cara Menjalankan

### Prasyarat

- [.NET SDK 10](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (v16 atau lebih baru)
- Database PostgreSQL (lokal atau [Neon](https://neon.tech/))
- API Key dari provider AI (misalnya Google Gemini/OpenAI)

### 1. Konfigurasi Database & API Key

> ⚠️ **Penting:** File `appsettings.json` dan `appsettings.Development.json` **tidak di-push** ke repository karena mengandung kredensial. Anda harus membuatnya sendiri.

Buat file **`appsettings.json`** di root proyek:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=<host>;Database=<db>;Username=<user>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true"
  }
}
```

Buat file **`appsettings.Development.json`**:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AiSettings": {
    "ApiKey": "<API_KEY_ANDA>"
  },
  "ConnectionStrings": {
    "DefaultConnection": "Host=<host>;Database=<db>;Username=<user>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true"
  }
}
```

### 2. Siapkan File Tesseract (Bahasa Indonesia)

Salin file `tessdata/ind.traineddata` (data bahasa Indonesia untuk Tesseract) ke direktori output build. Setelah `dotnet restore` dan `dotnet build`, file ini akan otomatis disalin berkat konfigurasi di `Docuan.csproj`.

### 3. Jalankan Backend (Port 5097)

```bash
dotnet restore
dotnet run
```

Backend akan berjalan di `http://localhost:5097` dan dokumentasi Swagger tersedia di `http://localhost:5097/swagger`.

### 4. Jalankan Frontend

```bash
cd frontend
npm install
npm start
```

Frontend akan berjalan di `http://localhost:3000`.

### 5. Tambahkan Provider AI

Setelah aplikasi berjalan:

1. Klik tombol **"Pengaturan AI"** di halaman utama.
2. Klik **"Tambah Provider Baru"**.
3. Isi konfigurasi:
   - **Nama Provider** — misalnya `Gemini`
   - **Model ID** — misalnya `gemini-flash-latest`
   - **API Key** — kunci API dari provider
   - **Base URL** — endpoint API provider, misalnya `https://generativelanguage.googleapis.com/v1beta` (untuk Gemini) atau `https://api.openai.com/v1` (untuk OpenAI)
4. Centang **Aktif** lalu simpan.

> 💡 **Mode Auto-Pilot:** Frontend mendukung mode "auto" yang otomatis mencoba semua provider aktif secara berurutan jika salah satu gagal.

---

## 🔌 API Endpoints

### Ekstraksi
| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/extract` | Unggah 1-5 file PDF/gambar untuk diekstrak (multipart/form-data: `file` + opsional `model`) |

### Invoice
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/invoices` | Daftar semua invoice |
| `GET` | `/api/invoices/{id}` | Detail invoice berdasarkan ID |
| `POST` | `/api/invoices/save` | Simpan invoice baru |
| `PUT` | `/api/invoices/{id}/payment` | Update status pembayaran |
| `DELETE` | `/api/invoices/{id}` | Hapus invoice |

### AI Provider
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/ai-models` | Daftar model AI aktif |
| `GET` | `/api/ai-providers` | Daftar semua provider |
| `POST` | `/api/ai-providers` | Tambah provider baru |
| `PUT` | `/api/ai-providers/{id}` | Update provider |
| `DELETE` | `/api/ai-providers/{id}` | Hapus provider |

---

## 🧪 Menjalankan Test

```bash
dotnet test
```

Test mencakup unit test untuk:
- `ExtractionService` — logika ekstraksi & deteksi duplikat
- `InvoiceService` — CRUD & update pembayaran
- `AiProviderService` — manajemen provider AI

---

## 📝 Cara Kerja

1. **Upload** — Pengguna mengunggah file PDF atau gambar (maks. 5 file).
2. **OCR** — `OcrService` mengekstrak teks dari dokumen menggunakan Tesseract OCR (PDF diproses via PdfPig).
3. **AI Analysis** — `ExtractionService` mengirim teks OCR ke model AI dengan prompt khusus yang meminta output JSON terstruktur. AI menentukan apakah dokumen adalah invoice dan mengekstrak field-nya.
4. **Validasi & Duplikat** — Sistem memeriksa apakah invoice sudah pernah disimpan (deteksi duplikat).
5. **Hasil** — Data terstruktur ditampilkan di UI, pengguna dapat menyimpan ke database.
6. **Manajemen** — Invoice tersimpan dapat dilihat, ditandai lunas, atau dihapus.

---

## 🌐 Deployment

Aplikasi menggunakan **PostgreSQL via Neon** (serverless Postgres) untuk database cloud. Untuk deployment production:

1. Build backend: `dotnet publish -c Release`
2. Build frontend: `cd frontend && npm run build`
3. Deploy hasil build ke cloud provider / VPS / container (misalnya Docker, Railway, Render, atau Azure)
4. Pastikan environment variables (`ConnectionStrings__DefaultConnection`, `AiSettings__ApiKey`) di-set di server, **jangan** hardcode di source code.

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan internal/document digitization. © 2026.