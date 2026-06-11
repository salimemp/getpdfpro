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
