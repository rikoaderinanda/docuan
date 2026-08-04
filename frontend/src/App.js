import React, { useState, useCallback, useRef, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:5097/api/extract";
const API_MODELS_URL = "http://localhost:5097/api/ai-models";
const API_PROVIDERS_URL = "http://localhost:5097/api/ai-providers";
const API_INVOICES_URL = "http://localhost:5097/api/invoices";
const MAX_FILES = 5;

function App() {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [availableModels, setAvailableModels] = useState([]);
  const [showProviderManager, setShowProviderManager] = useState(false);
  const [providers, setProviders] = useState([]);
  const [editingProvider, setEditingProvider] = useState(null);
  const [formData, setFormData] = useState({
    providerName: "",
    model: "",
    apiKey: "",
    baseUrl: "",
    isActive: true,
  });
  const [showInvoicesList, setShowInvoicesList] = useState(false);
  const [savedInvoices, setSavedInvoices] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [savingInvoice, setSavingInvoice] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch available AI models from backend
  const fetchModels = useCallback(() => {
    fetch(API_MODELS_URL)
      .then((res) => res.json())
      .then((models) => {
        if (Array.isArray(models) && models.length > 0) {
          setAvailableModels(models);
          setSelectedModel((prev) => prev || models[0].id);
        }
      })
      .catch(() => {
        setAvailableModels([]);
      });
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const fetchProviders = useCallback(() => {
    fetch(API_PROVIDERS_URL)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProviders(data);
      })
      .catch(() => {});
  }, []);

  const fetchSavedInvoices = useCallback(() => {
    fetch(API_INVOICES_URL)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedInvoices(data);
      })
      .catch(() => {});
  }, []);

  const validTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
  ];

  const processFiles = useCallback(
    (newFiles) => {
      const fileArray = Array.from(newFiles);
      const validFiles = [];
      const validPreviews = [];
      let errorMsg = null;

      for (const file of fileArray) {
        if (!validTypes.includes(file.type)) {
          errorMsg = `Format file "${file.name}" harus PDF, JPG, atau PNG.`;
          break;
        }
        validFiles.push(file);
      }

      if (errorMsg) {
        setError(errorMsg);
        return;
      }

      const totalFiles = files.length + validFiles.length;
      if (totalFiles > MAX_FILES) {
        setError(
          `Maksimal ${MAX_FILES} file. Anda sudah memiliki ${files.length} file.`,
        );
        return;
      }

      setError(null);
      setResult(null);

      const previewPromises = validFiles.map((file) => {
        if (file.type.startsWith("image/")) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
          });
        }
        return Promise.resolve(null);
      });

      Promise.all(previewPromises).then((newPreviews) => {
        setFiles((prev) => [...prev, ...validFiles]);
        setPreviews((prev) => [...prev, ...newPreviews]);
      });
    },
    [files.length, validTypes],
  );

  const handleFileSelect = useCallback(
    (selectedFiles) => {
      if (!selectedFiles || selectedFiles.length === 0) return;
      processFiles(selectedFiles);
    },
    [processFiles],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e) => {
      handleFileSelect(e.target.files);
      e.target.value = "";
    },
    [handleFileSelect],
  );

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError("Silakan pilih minimal 1 file terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSaveResult(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("file", file);
    });
    formData.append("model", selectedModel);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || data.detail || "Gagal memproses file",
        );
      }

      setResult(data);
      console.log("API Response:", JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err.message || "Terjadi kesalahan saat menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  // Helper: map AI output field names to backend expected format
  const normalizeInvoiceData = (extractedData) => {
    const data = { ...extractedData };

    // Map field names from AI output format to backend format
    if (data.NamaPenjual && !data.NamaPenagih) {
      data.NamaPenagih = data.NamaPenjual;
    }
    if (data.TanggalInvoice && !data.Tanggal) {
      data.Tanggal = data.TanggalInvoice;
    }

    // Parse TotalSetelahPajak from string like "RP. 39960" or "Rp. 44400"
    if (data.TotalSetelahPajak && !data.TotalHarga) {
      const parsed = parseFloat(
        (data.TotalSetelahPajak || "")
          .replace(/[^0-9,.]/g, "")
          .replace(",", "."),
      );
      data.TotalHarga = isNaN(parsed) ? 0 : parsed;
    } else if (data.TotalSebelumPajak && !data.TotalHarga) {
      const parsed = parseFloat(
        (data.TotalSebelumPajak || "")
          .replace(/[^0-9,.]/g, "")
          .replace(",", "."),
      );
      data.TotalHarga = isNaN(parsed) ? 0 : parsed;
    }

    // Parse Pajak string to TotalDiskon
    if (data.Pajak && !data.TotalDiskon) {
      const parsed = parseFloat(
        (data.Pajak || "").replace(/[^0-9,.]/g, "").replace(",", "."),
      );
      data.TotalDiskon = isNaN(parsed) ? 0 : parsed;
    }

    // Map RincianItem to Items
    if (data.RincianItem && Array.isArray(data.RincianItem)) {
      data.Items = data.RincianItem.map((item, index) => ({
        NamaBarang: item.Deskripsi || item.NamaBarang || "",
        Qty: parseInt(item.Jumlah || item.Qty || 0, 10),
        HargaSatuan:
          parseFloat(
            (item.HargaSatuan || "0")
              .toString()
              .replace(/[^0-9,.]/g, "")
              .replace(",", "."),
          ) || 0,
        DiskonItem: 0,
      }));
      delete data.RincianItem;
    }

    // Parse NomorInvoice if missing but similar field exists
    if (!data.NomorInvoice && data.InvoiceNumber) {
      data.NomorInvoice = data.InvoiceNumber;
    }

    // Clean up AI-only fields that backend doesn't expect
    delete data.NamaPenjual;
    delete data.AlamatPenjual;
    delete data.NamaPembeli;
    delete data.AlamatPembeli;
    delete data.TotalSetelahPajak;
    delete data.TotalSebelumPajak;
    delete data.Pajak;
    delete data.TanggalInvoice;
    delete data.MataUang;
    delete data.MetodePembayaran;
    delete data.isInvoice;
    delete data.pesan;
    delete data.JenisDokumen;

    return data;
  };

  const handleSaveInvoice = async (extractedData, fileInfo) => {
    setSavingInvoice(fileInfo.fileName);
    try {
      const normalized = normalizeInvoiceData(extractedData);
      const savePayload = {
        ...normalized,
        FileName: fileInfo.fileName,
        FileSize: fileInfo.fileSize,
        ContentType: fileInfo.contentType,
      };

      const response = await fetch(`${API_INVOICES_URL}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan invoice");
      }

      setSaveResult({
        type: "success",
        message: `Invoice ${data.nomorInvoice || ""} berhasil disimpan!`,
      });
      setTimeout(() => setSaveResult(null), 3000);
    } catch (err) {
      setSaveResult({ type: "error", message: err.message });
      setTimeout(() => setSaveResult(null), 5000);
    } finally {
      setSavingInvoice(null);
    }
  };

  const handlePaymentUpdate = async () => {
    if (!showPaymentModal) return;
    try {
      const response = await fetch(
        `${API_INVOICES_URL}/${showPaymentModal.id}/payment`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Lunas",
            method: "Transfer Bank",
          }),
        },
      );

      if (!response.ok) throw new Error("Gagal memperbarui pembayaran");

      setShowPaymentModal(null);
      fetchSavedInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSavedInvoice = async (id) => {
    if (!window.confirm("Hapus invoice ini?")) return;
    try {
      const response = await fetch(`${API_INVOICES_URL}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Gagal menghapus invoice");
      fetchSavedInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const openInvoicesList = () => {
    setShowInvoicesList(true);
    fetchSavedInvoices();
  };

  const handleReset = () => {
    setFiles([]);
    setPreviews([]);
    setResult(null);
    setError(null);
    setSelectedInvoice(null);
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const successfulInvoices =
    result?.results?.filter(
      (r) =>
        r.status === "Extraction success" &&
        r.extractedData?.isInvoice &&
        !r.isDuplicate,
    ) || [];

  const duplicateInvoices =
    result?.results?.filter(
      (r) =>
        r.status === "Extraction success" &&
        r.extractedData?.isInvoice &&
        r.isDuplicate,
    ) || [];

  const rejectedResults =
    result?.results?.filter((r) => r.status !== "Extraction success") || [];

  const totalInvoiceAmount = successfulInvoices.reduce(
    (sum, inv) => sum + (inv.extractedData.TotalHarga || 0),
    0,
  );
  const totalDiscount = successfulInvoices.reduce(
    (sum, inv) => sum + (inv.extractedData.TotalDiskon || 0),
    0,
  );
  const totalItems = successfulInvoices.reduce(
    (sum, inv) => sum + (inv.extractedData.Items?.length || 0),
    0,
  );

  // Provider management handlers
  const openAddProvider = () => {
    setEditingProvider(null);
    setFormData({
      providerName: "",
      model: "",
      apiKey: "",
      baseUrl: "",
      isActive: true,
    });
    setShowProviderManager(true);
  };

  const openEditProvider = (provider) => {
    setEditingProvider(provider);
    setFormData({
      providerName: provider.providerName,
      model: provider.model,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      isActive: provider.isActive,
    });
    setShowProviderManager(true);
  };

  const handleProviderSubmit = async (e) => {
    e.preventDefault();
    const url = editingProvider
      ? `${API_PROVIDERS_URL}/${editingProvider.id}`
      : API_PROVIDERS_URL;
    const method = editingProvider ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Gagal menyimpan provider");
      }

      setShowProviderManager(false);
      fetchProviders();
      fetchModels();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteProvider = async (id) => {
    if (!window.confirm("Hapus provider ini?")) return;
    try {
      const response = await fetch(`${API_PROVIDERS_URL}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Gagal menghapus provider");
      fetchProviders();
      fetchModels();
    } catch (err) {
      setError(err.message);
    }
  };

  // Fetch detailed invoice for viewing
  const viewInvoiceDetail = (id) => {
    fetch(`${API_INVOICES_URL}/${id}`)
      .then((res) => res.json())
      .then((data) => {
        // Transform to match existing detail modal format
        setSelectedInvoice({
          extractedData: data,
          fileName: data.fileName,
        });
      })
      .catch(() => setError("Gagal memuat detail invoice"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Docuan</h1>
                <p className="text-sm text-slate-500">
                  Ekstrak Data Dokumen Otomatis
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openInvoicesList}
                className="px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  Invoice Tersimpan
                </span>
              </button>
              <button
                onClick={() => {
                  setShowProviderManager(!showProviderManager);
                  if (!showProviderManager) fetchProviders();
                }}
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                {showProviderManager ? "Tutup Pengaturan" : "Pengaturan AI"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Save Result Notification */}
      {saveResult && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            saveResult.type === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {saveResult.message}
        </div>
      )}

      {/* Provider Manager Modal */}
      {showProviderManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-800">
                Pengaturan AI Provider
              </h2>
              <button
                onClick={() => setShowProviderManager(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">
                  {editingProvider ? "Edit Provider" : "Tambah Provider Baru"}
                </h3>
                <form onSubmit={handleProviderSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Nama Provider
                      </label>
                      <input
                        type="text"
                        value={formData.providerName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            providerName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Contoh: Gemini"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Model ID
                      </label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) =>
                          setFormData({ ...formData, model: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Contoh: gemini-flash-latest"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={formData.apiKey}
                        onChange={(e) =>
                          setFormData({ ...formData, apiKey: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="API Key"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={formData.baseUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, baseUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="https://generativelanguage.googleapis.com/v1beta"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="rounded border-slate-300"
                    />
                    <label
                      htmlFor="isActive"
                      className="text-sm text-slate-600"
                    >
                      Aktif
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      {editingProvider ? "Simpan Perubahan" : "Tambah Provider"}
                    </button>
                    {editingProvider && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProvider(null);
                          setFormData({
                            providerName: "",
                            model: "",
                            apiKey: "",
                            baseUrl: "",
                            isActive: true,
                          });
                        }}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Daftar Provider ({providers.length})
                </h3>
                <div className="space-y-2">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${p.isActive ? "bg-emerald-500" : "bg-red-400"}`}
                          />
                          <p className="text-sm font-medium text-slate-700">
                            {p.providerName}
                          </p>
                          <span className="text-xs text-slate-400">
                            ({p.model})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {p.baseUrl}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => openEditProvider(p)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProvider(p.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                  {providers.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">
                      Belum ada provider. Tambah provider baru di atas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices List Modal */}
      {showInvoicesList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Daftar Invoice Tersimpan
                </h2>
                <p className="text-sm text-slate-500">
                  {savedInvoices.length} invoice
                </p>
              </div>
              <button
                onClick={() => setShowInvoicesList(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {savedInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">
                    Belum ada invoice tersimpan
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Ekstrak dokumen terlebih dahulu, lalu simpan invoice-nya.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                inv.paymentStatus === "Lunas"
                                  ? "bg-emerald-500"
                                  : "bg-amber-400"
                              }`}
                            />
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {inv.nomorInvoice || "(Tanpa Nomor)"}
                            </p>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                inv.paymentStatus === "Lunas"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {inv.paymentStatus}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-slate-500">
                              {inv.namaPenagih || "-"}
                            </p>
                            {inv.vendorName && (
                              <>
                                <span className="text-slate-300">•</span>
                                <p className="text-xs text-slate-500">
                                  {inv.vendorName}
                                </p>
                              </>
                            )}
                            <span className="text-slate-300">•</span>
                            <p className="text-xs text-slate-500">
                              {inv.itemCount || 0} item
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-sm font-bold text-slate-800">
                            {formatCurrency(inv.totalHarga)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDate(inv.tanggal)}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => viewInvoiceDetail(inv.id)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          Detail
                        </button>
                        {inv.paymentStatus !== "Lunas" && (
                          <button
                            onClick={() => setShowPaymentModal(inv)}
                            className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            Bayar
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSavedInvoice(inv.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ml-auto"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Konfirmasi Pembayaran
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Tandai invoice{" "}
              <strong>
                {showPaymentModal.nomorInvoice || "(Tanpa Nomor)"}
              </strong>{" "}
              sebagai Lunas?
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(showPaymentModal.totalHarga)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Metode</span>
                <select
                  id="payment-method"
                  className="border border-slate-300 rounded-md text-sm px-2 py-1"
                >
                  <option>Transfer Bank</option>
                  <option>Tunai</option>
                  <option>Kartu Kredit</option>
                  <option>E-Wallet</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowPaymentModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handlePaymentUpdate}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Konfirmasi Lunas
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-200 cursor-pointer ${
            dragOver
              ? "border-indigo-400 bg-indigo-50 shadow-lg shadow-indigo-100"
              : files.length > 0
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-md"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleInputChange}
            className="hidden"
            multiple
          />

          {files.length === 0 ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-indigo-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-700">
                  Tarik & lepas file di sini
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  atau klik untuk memilih file
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Mendukung format PDF, JPG, dan PNG (maks. {MAX_FILES} file)
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-600">
                {files.length} file dipilih (maks. {MAX_FILES})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="relative bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {previews[index] ? (
                      <img
                        src={previews[index]}
                        alt={file.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-emerald-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Hapus file"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {files.length < MAX_FILES && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2"
                >
                  Tambah file ({MAX_FILES - files.length} tersisa)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-center gap-3">
          {files.length > 0 && !loading && !result && (
            <button
              onClick={handleSubmit}
              className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-all duration-200 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Proses {files.length} Dokumen
            </button>
          )}
          {result && (
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-white text-slate-600 font-medium rounded-xl border border-slate-300 hover:bg-slate-50 transition-all duration-200 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Proses Dokumen Lain
            </button>
          )}
        </div>

        {loading && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
                <div className="absolute top-0 left-0 w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="text-slate-600 font-medium">
                Memproses {files.length} dokumen...
              </p>
              <p className="text-sm text-slate-400">
                AI sedang mengekstrak data dari dokumen Anda
              </p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-red-800">Gagal Memproses</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-indigo-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Total Invoice
                    </p>
                    <p className="text-xl font-bold text-slate-800">
                      {successfulInvoices.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Total Nilai
                    </p>
                    <p className="text-xl font-bold text-slate-800">
                      {formatCurrency(totalInvoiceAmount)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-amber-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Total Item
                    </p>
                    <p className="text-xl font-bold text-slate-800">
                      {totalItems}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Ditolak
                    </p>
                    <p className="text-xl font-bold text-slate-800">
                      {rejectedResults.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {successfulInvoices.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">
                    Daftar Invoice Berhasil
                  </h2>
                  <button
                    onClick={async () => {
                      setSavingInvoice("all");
                      let saved = 0;
                      let errors = 0;
                      for (
                        let idx = 0;
                        idx < successfulInvoices.length;
                        idx++
                      ) {
                        const inv = successfulInvoices[idx];
                        const data = inv.extractedData;
                        const fileInfo = files[idx];
                        try {
                          const normalized = normalizeInvoiceData(data);
                          const savePayload = {
                            ...normalized,
                            FileName:
                              fileInfo?.name || inv.fileName || "unknown",
                            FileSize: fileInfo?.size || 0,
                            ContentType: fileInfo?.type || "unknown",
                          };
                          const resp = await fetch(`${API_INVOICES_URL}/save`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(savePayload),
                          });
                          if (resp.ok) saved++;
                          else errors++;
                        } catch {
                          errors++;
                        }
                      }
                      setSavingInvoice(null);
                      if (saved > 0) {
                        handleReset();
                      }
                      setSaveResult({
                        type: saved > 0 ? "success" : "error",
                        message:
                          saved > 0
                            ? `${saved} invoice baru berhasil disimpan${errors > 0 ? `, ${errors} gagal` : ""}!`
                            : "Gagal menyimpan semua invoice",
                      });
                      setTimeout(() => setSaveResult(null), 3000);
                    }}
                    disabled={savingInvoice === "all"}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                      />
                    </svg>
                    {savingInvoice === "all"
                      ? "Menyimpan..."
                      : `Simpan Semua (${successfulInvoices.length})`}
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {successfulInvoices.map((inv, idx) => {
                    const data = inv.extractedData;
                    const fileInfo = files[idx];
                    return (
                      <div
                        key={idx}
                        className="px-6 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-indigo-600">
                                {idx + 1}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {data.NomorInvoice || "(Tanpa Nomor)"}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {inv.fileName || fileInfo?.name || ""} •{" "}
                                {data.NamaPenagih || "-"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="text-sm font-bold text-slate-800">
                              {formatCurrency(data.TotalHarga)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {data.Items?.length || 0} item •{" "}
                              {formatDate(data.Tanggal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {rejectedResults.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
                  <h2 className="text-lg font-semibold text-red-800">
                    File Ditolak ({rejectedResults.length})
                  </h2>
                </div>
                <div className="divide-y divide-red-100">
                  {rejectedResults.map((rej, idx) => (
                    <div key={idx} className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-4 h-4 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {rej.fileName}
                          </p>
                          <p className="text-xs text-red-600">
                            {rej.message || rej.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {duplicateInvoices.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/50">
                  <h2 className="text-lg font-semibold text-amber-800">
                    Data Identik (Sudah Tersimpan) ({duplicateInvoices.length})
                  </h2>
                  <p className="text-xs text-amber-600 mt-1">
                    Invoice ini tidak akan disimpan karena datanya sudah ada di
                    database.
                  </p>
                </div>
                <div className="divide-y divide-amber-100">
                  {duplicateInvoices.map((inv, idx) => {
                    const data = inv.extractedData;
                    return (
                      <div key={idx} className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg
                              className="w-4 h-4 text-amber-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {data?.NomorInvoice || "(Tanpa Nomor)"}
                            </p>
                            <p className="text-xs text-amber-600">
                              {inv.duplicateMessage || "Data sudah tersimpan"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {inv.fileName} • {data?.NamaPenagih || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <details className="group">
                  <summary className="text-sm font-medium text-slate-500 cursor-pointer hover:text-slate-700 transition-colors flex items-center gap-2">
                    <svg
                      className="w-4 h-4 group-open:rotate-90 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    Lihat Response JSON Mentah
                  </summary>
                  <pre className="mt-4 p-4 bg-slate-800 text-slate-200 rounded-xl text-xs overflow-x-auto leading-relaxed max-h-[400px] overflow-y-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Detail Invoice
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedInvoice.fileName}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {(() => {
                const d = selectedInvoice.extractedData;
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                        <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">
                          Jenis Dokumen
                        </p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          {d.JenisDokumen || "-"}
                        </p>
                      </div>
                      <div className="bg-violet-50/50 rounded-xl p-4 border border-violet-100">
                        <p className="text-xs font-medium text-violet-600 uppercase tracking-wider">
                          Nomor Invoice
                        </p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          {d.NomorInvoice || "-"}
                        </p>
                      </div>
                      <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">
                          Nomor PO
                        </p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          {d.NomorPurchaseOrder || "-"}
                        </p>
                      </div>
                      <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                        <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">
                          Nama Penagih
                        </p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          {d.NamaPenagih || "-"}
                        </p>
                      </div>
                    </div>

                    {d.Vendor && (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                          <h3 className="text-sm font-semibold text-slate-700">
                            Vendor
                          </h3>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium text-slate-500">
                              Nama
                            </p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">
                              {d.Vendor.Nama || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">
                              Website
                            </p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">
                              {d.Vendor.Website || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">
                              Contact Person
                            </p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">
                              {typeof d.Vendor.ContactPerson === "object"
                                ? d.Vendor.ContactPerson.Nama || "-"
                                : d.Vendor.ContactPerson || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">
                              Alamat
                            </p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">
                              {d.Vendor.Alamat || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {d.InformasiPembayaran && (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                          <h3 className="text-sm font-semibold text-slate-700">
                            Informasi Pembayaran
                          </h3>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-100">
                            <p className="text-xs font-medium text-teal-600 uppercase tracking-wider">
                              Nama Bank
                            </p>
                            <p className="text-sm font-semibold text-slate-800 mt-1">
                              {d.InformasiPembayaran.NamaBank || "-"}
                            </p>
                          </div>
                          <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-100">
                            <p className="text-xs font-medium text-teal-600 uppercase tracking-wider">
                              Nomor Rekening
                            </p>
                            <p className="text-sm font-semibold text-slate-800 mt-1">
                              {d.InformasiPembayaran.NomorRekening || "-"}
                            </p>
                          </div>
                          <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-100">
                            <p className="text-xs font-medium text-teal-600 uppercase tracking-wider">
                              Atas Nama
                            </p>
                            <p className="text-sm font-semibold text-slate-800 mt-1">
                              {d.InformasiPembayaran.AtasNama || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-700">
                          Ringkasan
                        </h3>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
                            Tanggal
                          </p>
                          <p className="text-sm font-semibold text-slate-800 mt-1">
                            {formatDate(d.Tanggal)}
                          </p>
                        </div>
                        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
                            Total Harga
                          </p>
                          <p className="text-sm font-semibold text-slate-800 mt-1">
                            {formatCurrency(d.TotalHarga)}
                          </p>
                        </div>
                        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
                            Total Diskon
                          </p>
                          <p className="text-sm font-semibold text-slate-800 mt-1">
                            {formatCurrency(d.TotalDiskon)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {d.Items && d.Items.length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                          <h3 className="text-sm font-semibold text-slate-700">
                            Daftar Item ({d.Items.length})
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="text-left px-4 py-3 font-medium text-slate-600">
                                  No
                                </th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">
                                  Nama Barang
                                </th>
                                <th className="text-right px-4 py-3 font-medium text-slate-600">
                                  Qty
                                </th>
                                <th className="text-right px-4 py-3 font-medium text-slate-600">
                                  Harga Satuan
                                </th>
                                <th className="text-right px-4 py-3 font-medium text-slate-600">
                                  Diskon
                                </th>
                                <th className="text-right px-4 py-3 font-medium text-slate-600">
                                  Subtotal
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {d.Items.map((item, i) => (
                                <tr
                                  key={i}
                                  className="hover:bg-slate-50/50 transition-colors"
                                >
                                  <td className="px-4 py-3 text-slate-500">
                                    {i + 1}
                                  </td>
                                  <td className="px-4 py-3 font-medium text-slate-700">
                                    {item.NamaBarang || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-600">
                                    {item.Qty || 0}
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-600">
                                    {formatCurrency(item.HargaSatuan)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-600">
                                    {formatCurrency(item.DiskonItem)}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                                    {item.Qty && item.HargaSatuan
                                      ? formatCurrency(
                                          item.Qty * item.HargaSatuan -
                                            (item.DiskonItem || 0),
                                        )
                                      : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center mt-4">
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200">
          <label
            htmlFor="model-select"
            className="text-sm font-medium text-slate-600"
          >
            Model AI:
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          >
            <option value="auto">🤖 Auto-pilot (Otomatis)</option>
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-slate-400">
            Docuan &mdash; Ekstrak Data Dokumen dengan AI
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
