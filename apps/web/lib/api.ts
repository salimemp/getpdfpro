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
