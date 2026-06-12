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

// ─── PDF Repair ─────────────────────────────────────────────────────
//
// A single endpoint that runs up to 4 repair passes on a PDF:
// OCR (add text layer if scanned), repair (rebuild xref/trailer),
// unlock (strip owner password), linearize (Fast Web View).

export interface RepairOptions {
  ocr?: boolean; // default true
  repair?: boolean; // default true
  unlock?: boolean; // default false
  password?: string; // for user password removal (if any)
  linearize?: boolean; // default true
  lang?: string; // Tesseract language, default 'eng'
  dpi?: number; // render DPI, default 300
}

export interface RepairResult {
  blob: Blob;
  filename: string;
  pages: number;
  sizeBytes: number;
  actionsApplied: string[];
  needsOcr: boolean;
  elapsedMs: number;
}

/**
 * Repair a PDF and stream the result back. Hits /api/v1/pdf/repair-download.
 *
 * Use this from the web UI. The server returns the repaired PDF as a
 * binary stream with metadata in response headers (X-Repair-Actions,
 * X-Repair-Needs-Ocr, X-Repair-Output-Bytes).
 */
export async function repairPdf(
  file: File,
  options: RepairOptions = {}
): Promise<RepairResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("ocr", String(options.ocr ?? true));
  form.append("repair", String(options.repair ?? true));
  form.append("unlock", String(options.unlock ?? false));
  if (options.password) form.append("password", options.password);
  form.append("linearize", String(options.linearize ?? true));
  form.append("lang", options.lang ?? "eng");
  form.append("dpi", String(options.dpi ?? 300));

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/repair-download`, {
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
  const filename = filenameMatch ? filenameMatch[1] : "repaired.pdf";
  const actionsHeader = res.headers.get("X-Repair-Actions") || "";
  return {
    blob,
    filename,
    pages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Repair-Output-Bytes") || "0", 10),
    actionsApplied: actionsHeader ? actionsHeader.split(",") : [],
    needsOcr: (res.headers.get("X-Repair-Needs-Ocr") || "true") === "true",
    elapsedMs: parseInt(res.headers.get("X-Repair-Elapsed-Ms") || "0", 10),
  };
}

// ─── PDF Organization (Wave 1) ─────────────────────────────────
//
// Six small tools that do page-level operations on a PDF: rotate,
// crop, extract, add-remove, organize (reorder), and add page
// numbers. All return a stream response; same shape as repair.

/** Rotate pages of a PDF. */
export async function rotatePdf(
  file: File,
  options: { angle?: 90 | 180 | 270; pages?: string } = {}
): Promise<{ blob: Blob; filename: string; pages: number; sizeBytes: number; rotatedPages: number; angle: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("angle", String(options.angle ?? 90));
  if (options.pages) form.append("pages", options.pages);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/rotate-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "rotated.pdf"),
    pages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    rotatedPages: parseInt(res.headers.get("X-Rotated-Pages") || "0", 10),
    angle: parseInt(res.headers.get("X-Rotate-Angle") || "0", 10),
  };
}

/** Crop pages of a PDF (in PDF points, 1 pt = 1/72 inch). */
export async function cropPdf(
  file: File,
  options: { top?: number; bottom?: number; left?: number; right?: number; pages?: string } = {}
): Promise<{ blob: Blob; filename: string; pages: number; sizeBytes: number; croppedPages: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (options.top) form.append("top", String(options.top));
  if (options.bottom) form.append("bottom", String(options.bottom));
  if (options.left) form.append("left", String(options.left));
  if (options.right) form.append("right", String(options.right));
  if (options.pages) form.append("pages", options.pages);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/crop-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "cropped.pdf"),
    pages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    croppedPages: parseInt(res.headers.get("X-Cropped-Pages") || "0", 10),
  };
}

/** Extract specific pages from a PDF into a new PDF. */
export async function extractPages(
  file: File,
  pages: string
): Promise<{ blob: Blob; filename: string; sourcePages: number; outputPages: number; sizeBytes: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("pages", pages);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/extract-pages-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "extracted.pdf"),
    sourcePages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    outputPages: parseInt(res.headers.get("X-Pdf-Output-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
  };
}

/** Add or remove (delete) pages from a PDF. */
export async function addRemovePages(
  file: File,
  options: { delete?: string; keep?: string } = {}
): Promise<{ blob: Blob; filename: string; sourcePages: number; outputPages: number; removedPages: number; sizeBytes: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (options.delete) form.append("delete", options.delete);
  if (options.keep) form.append("keep", options.keep);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/add-remove-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "trimmed.pdf"),
    sourcePages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    outputPages: parseInt(res.headers.get("X-Pdf-Output-Pages") || "0", 10),
    removedPages: parseInt(res.headers.get("X-Pdf-Removed-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
  };
}

/** Reorder and/or duplicate pages in a PDF. */
export async function organizePages(
  file: File,
  order: string
): Promise<{ blob: Blob; filename: string; sourcePages: number; outputPages: number; sizeBytes: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("order", order);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/organize-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "organized.pdf"),
    sourcePages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    outputPages: parseInt(res.headers.get("X-Pdf-Output-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
  };
}

/** Add "Page N of M" to every page of a PDF. */
export async function addPageNumbers(
  file: File,
  options: {
    position?: "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";
    start?: number;
    fontSize?: number;
    margin?: number;
    format?: "n-of-m" | "n" | "page-n";
  } = {}
): Promise<{ blob: Blob; filename: string; pages: number; sizeBytes: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("position", options.position ?? "bottom-center");
  form.append("start", String(options.start ?? 1));
  if (options.fontSize) form.append("font_size", String(options.fontSize));
  if (options.margin !== undefined) form.append("margin", String(options.margin));
  form.append("format", options.format ?? "n-of-m");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/page-numbers-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "numbered.pdf"),
    pages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
  };
}

// ─── PDF Rendering (Wave 2) ────────────────────────────────────

/** Convert scanned images to a searchable PDF (with OCR). */
export async function scanToPdf(
  files: File[],
  options: {
    pageSize?: "fit" | "a4" | "letter" | "original";
    lang?: string;
    dpi?: number;
    skipOcr?: boolean;
  } = {}
): Promise<{ blob: Blob; filename: string; pages: number; sizeBytes: number; sourceImages: number; wordsInserted: number }> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f, f.name));
  form.append("page_size", options.pageSize ?? "fit");
  form.append("lang", options.lang ?? "eng");
  if (options.dpi) form.append("dpi", String(options.dpi));
  form.append("skip_ocr", String(options.skipOcr ?? false));
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/scan-to-pdf-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "scan.pdf"),
    pages: parseInt(res.headers.get("X-Pdf-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    sourceImages: parseInt(res.headers.get("X-Image-Source-Count") || "0", 10),
    wordsInserted: parseInt(res.headers.get("X-Ocr-Words-Inserted") || "0", 10),
  };
}

/** Convert HTML to a PDF. */
export async function htmlToPdf(
  options: {
    html?: string;
    url?: string;
    pageSize?: "a4" | "letter";
    landscape?: boolean;
  }
): Promise<{ blob: Blob; filename: string; pages: number; sizeBytes: number; elapsedMs: number; engine: string }> {
  if (!options.html && !options.url) {
    throw new ApiError(0, "Provide either 'html' or 'url'.");
  }
  const form = new FormData();
  if (options.html) form.append("html", options.html);
  if (options.url) form.append("url", options.url);
  form.append("page_size", options.pageSize ?? "a4");
  form.append("landscape", String(options.landscape ?? false));
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/html-to-pdf-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "page.pdf"),
    pages: parseInt(res.headers.get("X-Pdf-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    elapsedMs: parseInt(res.headers.get("X-Render-Elapsed-Ms") || "0", 10),
    engine: res.headers.get("X-Engine") || "xhtml2pdf",
  };
}

// ─── PDF Compliance (Wave 3 — Adobe cascade) ───────────────────

/** Convert PDF to PDF/A archival format. */
export async function pdfToPdfA(
  file: File,
  conformance: "PDF_A_1_B" | "PDF_A_2_B" | "PDF_A_3_B" = "PDF_A_2_B"
): Promise<{ blob: Blob; filename: string; sizeBytes: number; conformance: string; adapter: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("conformance", conformance);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/pdf-to-pdfa-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "pdfa.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    conformance: res.headers.get("X-Pdf-Conformance") || conformance,
    adapter: res.headers.get("X-Cascade-Adapter") || "unknown",
  };
}

/** Redact text patterns from a PDF. */
export async function redactPdf(
  file: File,
  options: { words?: string; regex?: string }
): Promise<{ blob: Blob; filename: string; sizeBytes: number; wordsRedacted: number; regexRedacted: number; adapter: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (options.words) form.append("words", options.words);
  if (options.regex) form.append("regex", options.regex);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/redact-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "redacted.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    wordsRedacted: parseInt(res.headers.get("X-Words-Redacted") || "0", 10),
    regexRedacted: parseInt(res.headers.get("X-Regex-Redacted") || "0", 10),
    adapter: res.headers.get("X-Cascade-Adapter") || "unknown",
  };
}

/** Compare two PDFs. */
export async function comparePdfs(
  fileA: File,
  fileB: File
): Promise<{ blob: Blob; filename: string; adapter: string }> {
  const form = new FormData();
  form.append("file_a", fileA, fileA.name);
  form.append("file_b", fileB, fileB.name);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/compare-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "compare.json"),
    adapter: res.headers.get("X-Cascade-Adapter") || "unknown",
  };
}

/** Extract form field data from a PDF. */
export async function extractForms(
  file: File
): Promise<{ blob: Blob; filename: string; adapter: string; fieldCount: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/forms-extract-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "forms.json"),
    adapter: res.headers.get("X-Cascade-Adapter") || "unknown",
    fieldCount: parseInt(res.headers.get("X-Form-Field-Count") || "0", 10),
  };
}

// ─── PDF Security (Wave 4) ─────────────────────────────────────

/** Remove passwords from a PDF. */
export async function unlockPdf(
  file: File,
  password = ""
): Promise<{ blob: Blob; filename: string; sizeBytes: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (password) form.append("password", password);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/unlock-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "unlocked.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
  };
}

/** Encrypt a PDF with a user/owner password. */
export async function protectPdf(
  file: File,
  options: { userPassword: string; ownerPassword?: string; permissions?: string }
): Promise<{ blob: Blob; filename: string; sizeBytes: number; algorithm: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("user_password", options.userPassword);
  if (options.ownerPassword) form.append("owner_password", options.ownerPassword);
  if (options.permissions) form.append("permissions", options.permissions);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/protect-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "protected.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    algorithm: res.headers.get("X-Encryption-Algorithm") || "AES-256",
  };
}

/** Add a visual signature stamp to a PDF (NOT a PKI signature). */
export async function signPdf(
  file: File,
  options: {
    signatureImage?: File;
    name?: string;
    pages?: string;
    position?: "bottom-right" | "bottom-left" | "bottom-center" | "top-right" | "top-left" | "top-center";
    width?: number;
    height?: number;
  }
): Promise<{ blob: Blob; filename: string; sizeBytes: number; signatureKind: string; pages: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (options.signatureImage) form.append("signature", options.signatureImage, options.signatureImage.name);
  if (options.name) form.append("name", options.name);
  if (options.pages) form.append("pages", options.pages);
  form.append("position", options.position ?? "bottom-right");
  if (options.width) form.append("width", String(options.width));
  if (options.height) form.append("height", String(options.height));
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/sign-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "signed.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    signatureKind: res.headers.get("X-Signature-Kind") || "visual-no-pki",
    pages: parseInt(res.headers.get("X-Signature-Pages") || "0", 10),
  };
}

/** Edit PDF metadata, whiteout a region, and/or stamp a text label. */
export async function editPdf(
  file: File,
  options: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    whiteoutPage?: number;
    whiteoutX?: number;
    whiteoutY?: number;
    whiteoutW?: number;
    whiteoutH?: number;
    stampText?: string;
    stampColor?: "red" | "black" | "gray";
  } = {}
): Promise<{ blob: Blob; filename: string; sizeBytes: number; editedMetadata: boolean; editedWhiteout: boolean; editedStamp: boolean }> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (options.title) form.append("title", options.title);
  if (options.author) form.append("author", options.author);
  if (options.subject) form.append("subject", options.subject);
  if (options.keywords) form.append("keywords", options.keywords);
  if (options.whiteoutPage) form.append("whiteout_page", String(options.whiteoutPage));
  if (options.whiteoutX !== undefined) form.append("whiteout_x", String(options.whiteoutX));
  if (options.whiteoutY !== undefined) form.append("whiteout_y", String(options.whiteoutY));
  if (options.whiteoutW) form.append("whiteout_w", String(options.whiteoutW));
  if (options.whiteoutH) form.append("whiteout_h", String(options.whiteoutH));
  if (options.stampText) form.append("stamp_text", options.stampText);
  form.append("stamp_color", options.stampColor ?? "red");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/edit-pdf-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "edited.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    editedMetadata: (res.headers.get("X-Edited-Metadata") || "false") === "true",
    editedWhiteout: (res.headers.get("X-Edited-Whiteout") || "false") === "true",
    editedStamp: (res.headers.get("X-Edited-Stamp") || "false") === "true",
  };
}

// ─── helpers ───────────────────────────────────────────────────
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail || JSON.stringify(body);
  } catch {
    return res.statusText;
  }
}

function headerFilename(res: Response, fallback: string): string {
  const disp = res.headers.get("Content-Disposition") || "";
  const m = disp.match(/filename="?([^";]+)"?/);
  return m ? m[1] : fallback;
}

// ─── PDF AI Tools ────────────────────────────────────────────

/** Summarize a PDF using Gemini. Returns the summary as a string. */
export async function summarizePdf(
  file: File,
  options: {
    length?: "short" | "medium" | "long" | "bullets";
    language?: string;
    format?: "text" | "markdown";
  } = {}
): Promise<{
  text: string;
  filename: string;
  sourcePages: number;
  length: string;
  language: string;
  format: string;
  model: string;
  elapsedMs: number;
}> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("length", options.length ?? "medium");
  form.append("language", options.language ?? "en");
  form.append("format", options.format ?? "markdown");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/summarize-download`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const text = await res.text();
  return {
    text,
    filename: headerFilename(res, "summary.md"),
    sourcePages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    length: res.headers.get("X-Summary-Length") || (options.length ?? "medium"),
    language: res.headers.get("X-Summary-Language") || (options.language ?? "en"),
    format: res.headers.get("X-Summary-Format") || (options.format ?? "markdown"),
    model: res.headers.get("X-Ai-Model") || "unknown",
    elapsedMs: parseInt(res.headers.get("X-Ai-Elapsed-Ms") || "0", 10),
  };
}

/** Translate a PDF using Gemini. */
export async function translatePdf(
  file: File,
  options: {
    targetLang: string;
    sourceLang?: string;
    outputFormat?: "pdf" | "text";
  }
): Promise<{
  blob: Blob;
  filename: string;
  sourcePages: number;
  outputPages: number;
  sizeBytes: number;
  targetLang: string;
  sourceLang: string;
  model: string;
  elapsedMs: number;
  outputFormat: string;
}> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("target_lang", options.targetLang);
  if (options.sourceLang) form.append("source_lang", options.sourceLang);
  form.append("output_format", options.outputFormat ?? "pdf");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/translate-download`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "translated.pdf"),
    sourcePages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    outputPages: parseInt(res.headers.get("X-Pdf-Output-Pages") || "0", 10),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    targetLang: res.headers.get("X-Target-Lang") || options.targetLang,
    sourceLang: res.headers.get("X-Source-Lang") || options.sourceLang || "auto",
    model: res.headers.get("X-Ai-Model") || "unknown",
    elapsedMs: parseInt(res.headers.get("X-Ai-Elapsed-Ms") || "0", 10),
    outputFormat: res.headers.get("X-Output-Format") || (options.outputFormat ?? "pdf"),
  };
}

// ─── PDF Watermark ─────────────────────────────────────────────

/** Add a text or image watermark to every page of a PDF. */
export async function watermarkPdf(
  file: File,
  options: {
    text?: string;
    image?: File;
    position?: "center" | "tile" | "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
    rotation?: 0 | 30 | 45 | 60 | 90 | 135 | 180;
    opacity?: number;
    fontSize?: number;
    color?: "red" | "gray" | "black" | "blue";
    pages?: string;
    imageSize?: number;
  } = {}
): Promise<{ blob: Blob; filename: string; sizeBytes: number; pages: number; mode: string; position: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (options.image) form.append("image", options.image, options.image.name);
  if (options.text) form.append("text", options.text);
  form.append("position", options.position ?? "center");
  form.append("rotation", String(options.rotation ?? 45));
  form.append("opacity", String(options.opacity ?? 0.3));
  form.append("font_size", String(options.fontSize ?? 48));
  form.append("color", options.color ?? "red");
  if (options.pages) form.append("pages", options.pages);
  if (options.imageSize) form.append("image_size", String(options.imageSize));
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/watermark-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "watermarked.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    pages: parseInt(res.headers.get("X-Pdf-Source-Pages") || "0", 10),
    mode: res.headers.get("X-Watermark-Mode") || "text",
    position: res.headers.get("X-Watermark-Position") || (options.position ?? "center"),
  };
}

// ─── Office Conversions (Wave C) ──────────────────────────────

/** Convert a .docx file to PDF. */
export async function wordToPdf(
  file: File,
): Promise<{ blob: Blob; filename: string; sizeBytes: number; sourceFormat: string; targetFormat: string; elapsedMs: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/word-to-pdf-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "converted.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    sourceFormat: res.headers.get("X-Office-Source-Format") || "docx",
    targetFormat: res.headers.get("X-Office-Target-Format") || "pdf",
    elapsedMs: parseInt(res.headers.get("X-Ai-Elapsed-Ms") || "0", 10),
  };
}

/** Convert a .pptx file to PDF. */
export async function powerpointToPdf(
  file: File,
): Promise<{ blob: Blob; filename: string; sizeBytes: number; sourceFormat: string; targetFormat: string; elapsedMs: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/powerpoint-to-pdf-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "converted.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    sourceFormat: res.headers.get("X-Office-Source-Format") || "pptx",
    targetFormat: res.headers.get("X-Office-Target-Format") || "pdf",
    elapsedMs: parseInt(res.headers.get("X-Ai-Elapsed-Ms") || "0", 10),
  };
}

/** Convert a .xlsx file to PDF. */
export async function excelToPdf(
  file: File,
): Promise<{ blob: Blob; filename: string; sizeBytes: number; sourceFormat: string; targetFormat: string; elapsedMs: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/excel-to-pdf-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "converted.pdf"),
    sizeBytes: parseInt(res.headers.get("X-Pdf-Size-Bytes") || "0", 10),
    sourceFormat: res.headers.get("X-Office-Source-Format") || "xlsx",
    targetFormat: res.headers.get("X-Office-Target-Format") || "pdf",
    elapsedMs: parseInt(res.headers.get("X-Ai-Elapsed-Ms") || "0", 10),
  };
}

/** Convert a PDF to .pptx via Adobe. */
export async function pdfToPowerpoint(
  file: File,
): Promise<{ blob: Blob; filename: string; sizeBytes: number; sourceFormat: string; targetFormat: string; elapsedMs: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/pdf-to-powerpoint-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "presentation.pptx"),
    sizeBytes: parseInt(res.headers.get("X-Office-Size-Bytes") || "0", 10),
    sourceFormat: res.headers.get("X-Office-Source-Format") || "pdf",
    targetFormat: res.headers.get("X-Office-Target-Format") || "pptx",
    elapsedMs: parseInt(res.headers.get("X-Ai-Elapsed-Ms") || "0", 10),
  };
}

/** Convert a PDF to .xlsx via Adobe. */
export async function pdfToExcel(
  file: File,
): Promise<{ blob: Blob; filename: string; sizeBytes: number; sourceFormat: string; targetFormat: string; elapsedMs: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/pdf/pdf-to-excel-download`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, `Could not reach the server at ${API_URL}.`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new ApiError(res.status, detail);
  }
  const blob = await res.blob();
  return {
    blob,
    filename: headerFilename(res, "spreadsheet.xlsx"),
    sizeBytes: parseInt(res.headers.get("X-Office-Size-Bytes") || "0", 10),
    sourceFormat: res.headers.get("X-Office-Source-Format") || "pdf",
    targetFormat: res.headers.get("X-Office-Target-Format") || "xlsx",
    elapsedMs: parseInt(res.headers.get("X-Ai-Elapsed-Ms") || "0", 10),
  };
}
