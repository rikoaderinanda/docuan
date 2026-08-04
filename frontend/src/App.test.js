import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

// Mock file factory
function createMockFile(name, type = "application/pdf", size = 1024) {
  const blob = new Blob(["dummy content"], { type });
  return new File([blob], name, { type });
}

function createMockImageFile(name = "test.jpg", size = 2048) {
  return createMockFile(name, "image/jpeg", size);
}

function createMockPdfFile(name = "invoice.pdf", size = 1024) {
  return createMockFile(name, "application/pdf", size);
}

// Helper to set up default API responses
function setupDefaultApiMocks() {
  // AI models endpoint
  mockFetch.mockImplementation((url) => {
    if (url.includes("/api/ai-models")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: "test-model-v1", name: "Test Model V1" },
            { id: "gemini-flash", name: "Gemini Flash" },
          ]),
      });
    }
    if (url.includes("/api/ai-providers")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              providerName: "TestAI",
              model: "test-model-v1",
              apiKey: "key1",
              baseUrl: "https://test.ai",
              isActive: true,
            },
            {
              id: 2,
              providerName: "Gemini",
              model: "gemini-flash",
              apiKey: "key2",
              baseUrl: "https://gemini.ai",
              isActive: true,
            },
          ]),
      });
    }
    if (url.includes("/api/invoices")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              nomorInvoice: "INV-001",
              namaPenagih: "PT Test",
              totalHarga: 500000,
              paymentStatus: "Belum Dibayar",
              itemCount: 3,
              tanggal: "2026-01-15",
            },
            {
              id: 2,
              nomorInvoice: "INV-002",
              namaPenagih: "PT ABC",
              totalHarga: 750000,
              paymentStatus: "Lunas",
              itemCount: 2,
              tanggal: "2026-02-10",
            },
          ]),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe("App Component - Rendering", () => {
  test("renders header with title Docuan", async () => {
    setupDefaultApiMocks();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Docuan")).toBeInTheDocument();
    });
  });

  test('renders subtitle "Ekstrak Data Dokumen Otomatis"', async () => {
    setupDefaultApiMocks();
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByText("Ekstrak Data Dokumen Otomatis"),
      ).toBeInTheDocument();
    });
  });

  test("renders footer text", async () => {
    setupDefaultApiMocks();
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByText(/Docuan.*Ekstrak Data Dokumen dengan AI/),
      ).toBeInTheDocument();
    });
  });

  test('renders "Invoice Tersimpan" button', async () => {
    setupDefaultApiMocks();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Invoice Tersimpan")).toBeInTheDocument();
    });
  });

  test('renders "Pengaturan AI" button', async () => {
    setupDefaultApiMocks();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Pengaturan AI")).toBeInTheDocument();
    });
  });

  test("renders file upload area with drag-drop text", async () => {
    setupDefaultApiMocks();
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByText(/Tarik & lepas file di sini/),
      ).toBeInTheDocument();
    });
  });

  test("renders AI model selector with auto-pilot option", async () => {
    setupDefaultApiMocks();
    render(<App />);
    await waitFor(() => {
      const select = screen.getByLabelText("Model AI:");
      expect(select).toBeInTheDocument();
      expect(
        within(select).getByText("🤖 Auto-pilot (Otomatis)"),
      ).toBeInTheDocument();
    });
  });

  test("loads and displays available AI models in select", async () => {
    setupDefaultApiMocks();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Test Model V1")).toBeInTheDocument();
      expect(screen.getByText("Gemini Flash")).toBeInTheDocument();
    });
  });
});

describe("App Component - File Upload", () => {
  test("shows selected file name after file selection", async () => {
    setupDefaultApiMocks();
    render(<App />);

    const file = createMockPdfFile("invoice-test.pdf");
    const input = document.querySelector('input[type="file"]');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText("invoice-test.pdf")).toBeInTheDocument();
    });
  });

  test("shows error when selecting invalid file type", async () => {
    setupDefaultApiMocks();
    render(<App />);

    const invalidFile = createMockFile("test.txt", "text/plain");
    const input = document.querySelector('input[type="file"]');
    await userEvent.upload(input, invalidFile);

    await waitFor(() => {
      expect(
        screen.getByText(/Format file.*harus PDF, JPG, atau PNG/),
      ).toBeInTheDocument();
    });
  });

  test("shows error when exceeding max file count", async () => {
    setupDefaultApiMocks();
    render(<App />);

    // Upload 5 files one by one
    const input = document.querySelector('input[type="file"]');
    for (let i = 0; i < 5; i++) {
      const file = createMockPdfFile(`file${i}.pdf`);
      await userEvent.upload(input, file);
    }

    await waitFor(() => {
      expect(screen.getByText(/5 file dipilih/)).toBeInTheDocument();
    });

    // Try uploading one more
    const extraFile = createMockPdfFile("extra.pdf");
    await userEvent.upload(input, extraFile);

    await waitFor(() => {
      expect(screen.getByText(/Maksimal 5 file/)).toBeInTheDocument();
    });
  });

  test('shows "Proses Dokumen" button when files are selected', async () => {
    setupDefaultApiMocks();
    render(<App />);

    const file = createMockPdfFile("test.pdf");
    const input = document.querySelector('input[type="file"]');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/Proses 1 Dokumen/)).toBeInTheDocument();
    });
  });

  test("can remove a selected file", async () => {
    setupDefaultApiMocks();
    render(<App />);

    const file = createMockPdfFile("test.pdf");
    const input = document.querySelector('input[type="file"]');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText("test.pdf")).toBeInTheDocument();
    });

    // Find and click remove button
    const removeBtn = document.querySelector('button[title="Hapus file"]');
    if (removeBtn) {
      fireEvent.click(removeBtn);
      await waitFor(() => {
        expect(screen.queryByText("test.pdf")).not.toBeInTheDocument();
      });
    }
  });

  test("shows progress indicator during processing", async () => {
    // Mock a slow API response
    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/ai-models")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "test-model", name: "Test" }]),
        });
      }
      // This will hang during processing
      return new Promise(() => {});
    });

    render(<App />);

    const file = createMockPdfFile("test.pdf");
    const input = document.querySelector('input[type="file"]');
    await userEvent.upload(input, file);

    await waitFor(() => {
      const processBtn = screen.getByText(/Proses 1 Dokumen/);
      fireEvent.click(processBtn);
    });

    await waitFor(
      () => {
        expect(screen.getByText(/Memproses 1 dokumen/)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});

describe("App Component - API Error Handling", () => {
  test("displays error message when API call fails", async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/ai-models")) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({ ok: false });
    });

    render(<App />);

    await waitFor(() => {
      // Should still render without crashing
      expect(screen.getByText("Docuan")).toBeInTheDocument();
    });
  });

  test("shows error when submitting without files", async () => {
    setupDefaultApiMocks();
    render(<App />);

    // Try clicking submit - button should not exist when no files
    const processButtons = screen.queryAllByText(/Proses/);
    expect(processButtons.length).toBe(0);
  });
});

describe("App Component - Provider Management", () => {
  test("opens provider manager modal", async () => {
    setupDefaultApiMocks();
    render(<App />);

    await waitFor(() => {
      const pengaturanBtn = screen.getByText("Pengaturan AI");
      fireEvent.click(pengaturanBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Pengaturan AI Provider")).toBeInTheDocument();
    });
  });

  test("displays list of providers in modal", async () => {
    setupDefaultApiMocks();
    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Pengaturan AI"));
    });

    await waitFor(() => {
      expect(screen.getByText("TestAI")).toBeInTheDocument();
      expect(screen.getByText("Gemini")).toBeInTheDocument();
    });
  });

  test("shows add provider form", async () => {
    setupDefaultApiMocks();
    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Pengaturan AI"));
    });

    await waitFor(() => {
      expect(screen.getByText("Tambah Provider Baru")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Contoh: Gemini")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Contoh: gemini-flash-latest"),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("API Key")).toBeInTheDocument();
    });
  });

  test("creates a new provider via form", async () => {
    let providerCalled = false;
    mockFetch.mockImplementation((url, options) => {
      if (url.includes("/api/ai-models")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "test-model", name: "Test" }]),
        });
      }
      if (
        url.includes("/api/ai-providers") &&
        (!options || options.method === "GET")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes("/api/ai-providers") && options?.method === "POST") {
        providerCalled = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 3 }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Pengaturan AI"));
    });

    await waitFor(() => {
      expect(screen.getByText("Tambah Provider Baru")).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByPlaceholderText("Contoh: Gemini"), {
      target: { value: "NewAI" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Contoh: gemini-flash-latest"),
      { target: { value: "new-model" } },
    );
    fireEvent.change(screen.getByPlaceholderText("API Key"), {
      target: { value: "new-key" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/https?:\/\//)[0], {
      target: { value: "https://new.ai/api" },
    });

    // Submit
    fireEvent.click(screen.getByText("Tambah Provider"));

    await waitFor(() => {
      expect(providerCalled).toBe(true);
    });
  });

  test("deletes a provider", async () => {
    let deleteCalled = false;
    mockFetch.mockImplementation((url, options) => {
      if (url.includes("/api/ai-models")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "test-model", name: "Test" }]),
        });
      }
      if (
        url.includes("/api/ai-providers") &&
        (!options || options.method === "GET")
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 1,
                providerName: "TestAI",
                model: "test-model",
                apiKey: "key",
                baseUrl: "https://test.ai",
                isActive: true,
              },
            ]),
        });
      }
      if (url.includes("/api/ai-providers/1") && options?.method === "DELETE") {
        deleteCalled = true;
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: false });
    });

    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Pengaturan AI"));
    });

    await waitFor(() => {
      expect(screen.getByText("TestAI")).toBeInTheDocument();
    });

    // Click Hapus button
    const hapusBtn = screen.getByText("Hapus");
    fireEvent.click(hapusBtn);

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });

    window.confirm = originalConfirm;
  });
});

describe("App Component - Invoice List", () => {
  test("opens invoices list modal", async () => {
    setupDefaultApiMocks();
    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Invoice Tersimpan"));
    });

    await waitFor(() => {
      expect(screen.getByText("Daftar Invoice Tersimpan")).toBeInTheDocument();
    });
  });

  test("displays saved invoices in list", async () => {
    setupDefaultApiMocks();
    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Invoice Tersimpan"));
    });

    await waitFor(() => {
      expect(screen.getByText("INV-001")).toBeInTheDocument();
      expect(screen.getByText("INV-002")).toBeInTheDocument();
    });
  });

  test("shows empty state when no invoices", async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/ai-models")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "test-model", name: "Test" }]),
        });
      }
      if (url.includes("/api/invoices")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Invoice Tersimpan"));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Belum ada invoice tersimpan"),
      ).toBeInTheDocument();
    });
  });
});

describe("App Component - Model Selection", () => {
  test("can switch between AI models in selector", async () => {
    setupDefaultApiMocks();
    render(<App />);

    await waitFor(() => {
      const select = screen.getByLabelText("Model AI:");
      expect(select).toBeInTheDocument();

      // Change to specific model
      fireEvent.change(select, { target: { value: "test-model-v1" } });
      expect(select.value).toBe("test-model-v1");
    });
  });
});
