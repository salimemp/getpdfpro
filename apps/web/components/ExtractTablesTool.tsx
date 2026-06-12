"use client";

/**
 * Extract Tables tool — server endpoint + client UI.
 *
 * Upload a PDF, choose CSV (default) or JSON, get a structured
 * download of every table the server's PyMuPDF find_tables()
 * detector finds. Scanned / image-only PDFs need OCR first — we
 * surface a clear hint when the result is empty.
 */

import { useState } from "react";
import {
  TableProperties,
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  ScanText,
  FileWarning,
} from "lucide-react";
import { extractTables, ApiError } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

type State =
  | { kind: "idle" }
  | { kind: "uploading"; filename: string }
  | {
      kind: "done";
      filename: string;
      tableCount: number;
      pages: number;
      elapsedMs: number;
      sizeBytes: number;
      blob: Blob;
    }
  | { kind: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ExtractTablesTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [state, setState] = useState<State>({ kind: "idle" });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setState({ kind: "idle" });
    }
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".pdf")) {
      setFile(f);
      setState({ kind: "idle" });
    }
  };

  const onRun = async () => {
    if (!file) {
      setState({ kind: "error", message: "Pick a PDF first." });
      return;
    }
    if (!quota.canRun) {
      setState({
        kind: "error",
        message: auth.user
          ? `You've used all ${quota.limit} of today's tasks. Resets at midnight.`
          : "You've used today's free task. Sign up free for 50 tasks/day.",
      });
      return;
    }
    setState({ kind: "uploading", filename: file.name });
    try {
      const r = await extractTables(file, format);
      quota.consume();
      setState({
        kind: "done",
        filename: r.filename,
        tableCount: r.tableCount,
        pages: r.pages,
        elapsedMs: r.elapsedMs,
        sizeBytes: r.blob.size,
        blob: r.blob,
      });
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.detail
          : e instanceof Error
          ? e.message
          : "Unknown error";
      setState({ kind: "error", message: msg });
    }
  };

  const onDownload = () => {
    if (state.kind !== "done") return;
    const url = URL.createObjectURL(state.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <TableProperties className="h-3.5 w-3.5 text-brand-600" />
          <span>AI tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Extract Tables from PDF
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Pull every table out of a PDF as CSV or JSON. Uses
          PyMuPDF&apos;s table detector — fast and self-hosted, no
          Adobe call. Best on native (born-digital) PDFs from
          Excel, Word, Google Docs, or any source with visible
          table structure.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Scanned / image-only PDFs need OCR before tables can be
          detected. If your result is empty, run{" "}
          <a href="/tools/ocr" className="underline">
            /tools/ocr
          </a>{" "}
          first, then come back.
        </div>
      </div>

      {/* File picker */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"
      >
        {file ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 text-left">
              <TableProperties className="h-6 w-6 shrink-0 text-brand-600" />
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {file.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatBytes(file.size)} · PDF
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setState({ kind: "idle" });
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <Upload className="mx-auto h-8 w-8 text-slate-400" />
            <div className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              Drop a PDF here, or click to choose
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Up to 50 MB
            </div>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={onPick}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {/* Format selector */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <fieldset>
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Output format
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                format === "csv"
                  ? "border-brand-500 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
                className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  CSV
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  One file, all tables. Easy to open in Excel, Google
                  Sheets, Numbers, or any data tool.
                </div>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                format === "json"
                  ? "border-brand-500 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === "json"}
                onChange={() => setFormat("json")}
                className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  JSON
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Structured. Each table has page, index, bbox,
                  rows × cols. Good for piping into scripts.
                </div>
              </div>
            </label>
          </div>
        </fieldset>
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={onRun}
        disabled={!file || state.kind === "uploading"}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {state.kind === "uploading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Extracting tables…
          </>
        ) : (
          <>
            <TableProperties className="h-4 w-4" />
            Extract tables
          </>
        )}
      </button>

      {/* Result */}
      {state.kind === "done" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              {state.tableCount > 0 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <FileWarning className="h-5 w-5" />
              )}
              <span className="font-semibold">
                {state.tableCount > 0
                  ? `Found ${state.tableCount} table${state.tableCount === 1 ? "" : "s"}.`
                  : "No tables detected."}
              </span>
            </div>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Download className="h-3.5 w-3.5" />
              Download {state.filename}
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
            {state.pages} pages scanned in {formatMs(state.elapsedMs)} ·{" "}
            {formatBytes(state.sizeBytes)} {format.toUpperCase()}
          </div>
          {state.tableCount === 0 && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <ScanText className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong>No tables came back.</strong> Common reasons:
                  <ul className="ml-5 mt-1 list-disc space-y-1 text-xs">
                    <li>
                      The PDF is a scan / image-only. Run{" "}
                      <a href="/tools/ocr" className="underline">
                        OCR
                      </a>{" "}
                      first to add a text layer, then retry.
                    </li>
                    <li>
                      The &quot;tables&quot; are actually images or
                      flowing text. They won&apos;t be detected as
                      tables.
                    </li>
                    <li>
                      Tables with no visible separator lines (pure
                      whitespace alignment) may be missed.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {state.kind === "error" && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{state.message}</div>
        </div>
      )}

      {/* Related tools */}
      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Related tools
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a
            href="/tools/forms-extract"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Extract form fields
          </a>
          <a
            href="/tools/ocr"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            OCR scanned PDF
          </a>
          <a
            href="/tools/pdf-to-image"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            PDF to image
          </a>
          <a
            href="/tools/csv-to-pdf"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            CSV to PDF
          </a>
        </div>
      </div>
    </div>
  );
}
