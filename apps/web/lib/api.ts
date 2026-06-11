/**
 * API client for the GetPDFPro FastAPI backend.
 *
 * Reads NEXT_PUBLIC_API_URL at build time. In dev it defaults to
 * http://localhost:8000 (which the API's .env.example uses).
 *
 * Sync endpoints (PDFs ≤ 50 MB) hit /api/v1/pdf/* directly.
 * Async jobs (larger files, AI tasks) would poll /api/v1/jobs/{id}.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000";

export const apiBaseUrl = API_URL;

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`API error ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Health check — used by the /health indicator in the UI footer. */
export async function checkHealth(): Promise<{
  status: string;
  service: string;
  version: string;
  env: string;
} | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface MergeResult {
  blob: Blob;
  filename: string;
  pages: number;
  sizeBytes: number;
}

/**
 * Merge 2+ PDFs and return the merged file as a Blob.
 * Hits the sync /api/v1/pdf/merge-download endpoint (capped at 50 MB total).
 */
export async function mergePdfs(files: File[]): Promise<MergeResult> {
  if (files.length < 2) {
    throw new Error("Need at least 2 PDFs to merge");
  }

  const form = new FormData();
  for (const f of files) {
    form.append("files", f, f.name);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/merge-download`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(
      0,
      `Could not reach the server at ${API_URL}. Is the API running?`
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // body wasn't JSON
    }
    throw new ApiError(res.status, detail);
  }

  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disp.match(/filename="?([^";]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : "merged.pdf";
  const pages = parseInt(res.headers.get("X-Pdf-Pages") || "0", 10);
  const sizeBytes = parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10);

  return { blob, filename, pages, sizeBytes };
}

export interface SplitResult {
  blob: Blob;
  filename: string;
  sourcePages: number;
  parts: number;
  sizeBytes: number;
}

export type SplitMode = "all" | "ranges";

/**
 * Split a PDF into one-PDF-per-page, returned as a ZIP.
 * Hits /api/v1/pdf/split-download (capped at 50 MB input).
 */
export async function splitPdf(
  file: File,
  options: { mode?: SplitMode; ranges?: string } = {}
): Promise<SplitResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("mode", options.mode ?? "all");
  if (options.mode === "ranges" && options.ranges) {
    form.append("ranges", options.ranges);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/split-download`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }

  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disp.match(/filename="?([^";]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : "pages.zip";
  const sourcePages = parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10);
  const parts = parseInt(res.headers.get("X-Pdf-Parts") || "0", 10);
  const sizeBytes = parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10);

  return { blob, filename, sourcePages, parts, sizeBytes };
}

export type CompressionLevel = "low" | "medium" | "high";

export interface CompressResult {
  blob: Blob;
  filename: string;
  level: CompressionLevel;
  originalBytes: number;
  compressedBytes: number;
  savedPercent: number;
}

export interface PdfToImagesResult {
  blob: Blob;
  filename: string;
  sourcePages: number;
  format: "png" | "jpeg";
  dpi: number;
  sizeBytes: number;
}

export type ImageFormat = "png" | "jpeg";
export type PageSize = "fit" | "a4" | "letter" | "original";

export interface ImagesToPdfResult {
  blob: Blob;
  filename: string;
  sourceCount: number;
  pages: number;
  sizeBytes: number;
  pageSize: PageSize;
}

export interface OcrTextResult {
  text: string;
  pages: number;
  chars: number;
  elapsedMs: number;
}

export interface OcrPdfResult {
  blob: Blob;
  filename: string;
  sourcePages: number;
  sizeBytes: number;
  lang: string;
  dpi: number;
  elapsedMs: number;
}

export interface ToWordResult {
  pages: number;
  paragraphs: number;
  tables: number;
  sizeBytes: number;
  accuracyWarning: string;
}

export interface ToWordDownloadResult {
  blob: Blob;
  filename: string;
  sourcePages: number;
  sizeBytes: number;
}

/**
 * Compress a PDF. Three quality levels:
 *   - low:    best quality, ~10% smaller (garbage collect only)
 *   - medium: balanced, ~40% smaller (re-encodes JPEGs at quality 70)
 *   - high:   smallest, ~70% smaller (re-encodes at quality 50, ~150 DPI)
 */
export async function compressPdf(
  file: File,
  level: CompressionLevel = "medium"
): Promise<CompressResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("level", level);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/compress-download`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }

  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disp.match(/filename="?([^";]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : "compressed.pdf";
  const originalBytes = parseInt(
    res.headers.get("X-Original-Size-Bytes") || "0",
    10
  );
  const compressedBytes = parseInt(
    res.headers.get("X-Compressed-Size-Bytes") || "0",
    10
  );
  const savedPercent = parseFloat(
    res.headers.get("X-Saved-Percent") || "0"
  );

  return {
    blob,
    filename,
    level,
    originalBytes,
    compressedBytes,
    savedPercent,
  };
}

/**
 * Convert a PDF's pages to images (PNG or JPEG), bundled in a ZIP.
 * Hits /api/v1/pdf/to-images-download (capped at 50 MB input).
 *
 * - format: png (default, lossless) or jpeg (smaller files)
 * - dpi: 72-300, default 144 (2x of screen DPI)
 */
export async function pdfToImages(
  file: File,
  options: { format?: ImageFormat; dpi?: number } = {}
): Promise<PdfToImagesResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("format", options.format ?? "png");
  form.append("dpi", String(options.dpi ?? 144));

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/to-images-download`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }

  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disp.match(/filename="?([^";]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : "images.zip";
  const sourcePages = parseInt(
    res.headers.get("X-Pdf-Source-Pages") || "0",
    10
  );
  const format = (res.headers.get("X-Image-Format") || "png") as ImageFormat;
  const dpi = parseInt(res.headers.get("X-Image-Dpi") || "144", 10);
  const sizeBytes = parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10);

  return { blob, filename, sourcePages, format, dpi, sizeBytes };
}

/**
 * Combine 1+ images into a single PDF.
 * Hits /api/v1/pdf/from-images-download (capped at 50 MB total).
 *
 * - pageSize:
 *   - "fit" (default): A4 page, image scaled to fit with 0.5" margin
 *   - "a4" / "letter": force page size
 *   - "original": page size = image size in pixels (1px = 1pt)
 */
export async function imagesToPdf(
  files: File[],
  options: { pageSize?: PageSize } = {}
): Promise<ImagesToPdfResult> {
  if (files.length < 1) {
    throw new Error("Need at least 1 image");
  }
  const form = new FormData();
  for (const f of files) {
    form.append("files", f, f.name);
  }
  form.append("page_size", options.pageSize ?? "fit");

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/from-images-download`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }

  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disp.match(/filename="?([^";]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : "images.pdf";
  const sourceCount = parseInt(
    res.headers.get("X-Image-Source-Count") || "0",
    10
  );
  const pages = parseInt(res.headers.get("X-Pdf-Pages") || "0", 10);
  const sizeBytes = parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10);
  const pageSize = (res.headers.get("X-Page-Size") || "fit") as PageSize;

  return { blob, filename, sourceCount, pages, sizeBytes, pageSize };
}

/**
 * OCR a scanned PDF and return the extracted plain text.
 * Hits /api/v1/pdf/ocr (capped at 50 MB input).
 *
 * - lang: Tesseract language code (default 'eng'). Multiple: 'eng+fra'.
 * - dpi: render DPI 150-600, default 300.
 */
export async function ocrText(
  file: File,
  options: { lang?: string; dpi?: number } = {}
): Promise<OcrTextResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("lang", options.lang ?? "eng");
  form.append("dpi", String(options.dpi ?? 300));

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/ocr`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

/**
 * OCR a scanned PDF and return a searchable PDF (invisible text layer over scans).
 * Hits /api/v1/pdf/ocr-download.
 */
export async function ocrToSearchablePdf(
  file: File,
  options: { lang?: string; dpi?: number } = {}
): Promise<OcrPdfResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("lang", options.lang ?? "eng");
  form.append("dpi", String(options.dpi ?? 300));

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/ocr-download`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disp.match(/filename="?([^";]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : "searchable.pdf";
  return {
    blob,
    filename,
    sourcePages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    lang: res.headers.get("X-Ocr-Lang") || "eng",
    dpi: parseInt(res.headers.get("X-Ocr-Dpi") || "300", 10),
    elapsedMs: parseInt(res.headers.get("X-Ocr-Elapsed-Ms") || "0", 10),
  };
}

/**
 * Convert a PDF to .docx (best-effort text + structure).
 * Hits /api/v1/pdf/to-word (JSON metadata) or /to-word-download (binary).
 */
export async function pdfToWord(
  file: File
): Promise<ToWordDownloadResult> {
  const form = new FormData();
  form.append("file", file, file.name);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/to-word-download`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disp.match(/filename="?([^";]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : "document.docx";
  return {
    blob,
    filename,
    sourcePages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Docx-Size-Bytes") || "0", 10),
  };
}

export type BillingInterval = "monthly" | "yearly";

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

/**
 * Create a Stripe Checkout session for Pro.
 * The API returns a hosted Stripe URL; the caller should redirect
 * the browser to it. If Stripe isn't configured (no env vars), the
 * API returns 503 and we throw an ApiError with a helpful message.
 */
export async function createCheckoutSession(
  interval: BillingInterval,
  user: { id: string; email: string }
): Promise<CheckoutResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/billing/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // The API trusts these headers for now. Once we add Supabase
        // JWT verification on the API side, this header pair goes
        // away and the API reads user identity from the JWT instead.
        "X-User-Id": user.id,
        "X-User-Email": user.email,
      },
      body: JSON.stringify({ interval, plan: "pro" }),
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }

  return res.json();
}
