"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ScanText,
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { ocrToSearchablePdf, ocrText, ApiError } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

type OutputMode = "searchable-pdf" | "text";

type State =
  | { kind: "idle" }
  | { kind: "uploading"; filename: string }
  | {
      kind: "done-pdf";
      filename: string;
      pages: number;
      sizeBytes: number;
      lang: string;
      dpi: number;
      elapsedMs: number;
      blob: Blob;
    }
  | {
      kind: "done-text";
      text: string;
      pages: number;
      chars: number;
      elapsedMs: number;
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

const LANG_OPTIONS = [
  { code: "eng", label: "English" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "spa", label: "Spanish" },
  { code: "por", label: "Portuguese" },
  { code: "ita", label: "Italian" },
  { code: "hin", label: "Hindi" },
  { code: "ara", label: "Arabic" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "jpn", label: "Japanese" },
];

export function OcrTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>("searchable-pdf");
  const [lang, setLang] = useState<string>("eng");
  const [dpi, setDpi] = useState<number>(300);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setState({ kind: "idle" });
    }
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
        setState({ kind: "error", message: "Please drop a PDF file." });
        return;
      }
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
      if (outputMode === "searchable-pdf") {
        const result = await ocrToSearchablePdf(file, { lang, dpi });
        quota.consume();
        setState({
          kind: "done-pdf",
          filename: result.filename,
          pages: result.sourcePages,
          sizeBytes: result.sizeBytes,
          lang: result.lang,
          dpi: result.dpi,
          elapsedMs: result.elapsedMs,
          blob: result.blob,
        });
      } else {
        const result = await ocrText(file, { lang, dpi });
        quota.consume();
        setState({
          kind: "done-text",
          text: result.text,
          pages: result.pages,
          chars: result.chars,
          elapsedMs: result.elapsedMs,
        });
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
          ? err.message
          : "Unknown error";
      setState({ kind: "error", message });
    }
  };

  const onDownload = () => {
    if (state.kind !== "done-pdf") return;
    const url = URL.createObjectURL(state.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onCopyText = async () => {
    if (state.kind !== "done-text") return;
    try {
      await navigator.clipboard.writeText(state.text);
    } catch {
      // Clipboard write can fail on insecure contexts — silently ignore
    }
  };

  const onDownloadText = () => {
    if (state.kind !== "done-text") return;
    const blob = new Blob([state.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name || "ocr").replace(/\.pdf$/i, "") + ".txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onReset = () => {
    setFile(null);
    setState({ kind: "idle" });
  };

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <ScanText className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          OCR PDF
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Make a scanned PDF searchable. Adds an invisible text layer
          (preserves the original look) or extract plain text. Powered
          by Tesseract OCR.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          OCR is best-effort. Accuracy depends on scan quality,
          language, and font. Handwriting and low-DPI scans may
          produce noisy text. The <strong>searchable PDF</strong> option
          keeps the original page visuals — only the text layer is
          added — so the result is always safe to use.
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging
            ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
            : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
        }`}
      >
        {file ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                <ScanText className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatBytes(file.size)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-slate-700 dark:text-slate-300">
              Drop a scanned PDF here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Scanned PDF up to 50 MB (free tier)
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onPick}
          className="hidden"
        />
      </div>

      {/* Options */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Output
          </label>
          <div className="flex flex-col gap-2">
            {(
              [
                { value: "searchable-pdf", label: "Searchable PDF" },
                { value: "text", label: "Plain text" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setOutputMode(opt.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  outputMode === opt.value
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                <div
                  className={`font-semibold ${
                    outputMode === opt.value
                      ? "text-brand-700 dark:text-brand-300"
                      : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {opt.label}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label
            htmlFor="ocr-lang"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Language
          </label>
          <select
            id="ocr-lang"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Tesseract language code. Only English is pre-installed by
            default; other languages require apt packages we haven't
            added yet.
          </p>
        </div>
        <div>
          <label
            htmlFor="ocr-dpi"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Render DPI: <span className="font-semibold">{dpi}</span>
          </label>
          <input
            id="ocr-dpi"
            type="range"
            min={150}
            max={600}
            step={50}
            value={dpi}
            onChange={(e) => setDpi(parseInt(e.target.value, 10))}
            className="w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>150 (fast)</span>
            <span>300 (balanced)</span>
            <span>600 (best)</span>
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {quota.used}/{quota.limit} tasks used today
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={!file || state.kind === "uploading"}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === "uploading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running OCR...
            </>
          ) : (
            <>
              <ScanText className="h-4 w-4" />
              {outputMode === "searchable-pdf" ? "Make searchable" : "Extract text"}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {state.kind === "error" && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      {/* Success: PDF */}
      {state.kind === "done-pdf" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">
              Searchable PDF ready. Open it in any reader and try Ctrl-F.
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pages</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.pages}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Lang</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.lang}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Size</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBytes(state.sizeBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Time</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {formatMs(state.elapsedMs)}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={onDownload}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Download {state.filename}
          </button>
        </div>
      )}

      {/* Success: text */}
      {state.kind === "done-text" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Text extracted.</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pages</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.pages}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Chars</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.chars.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Time</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {formatMs(state.elapsedMs)}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopyText}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Copy to clipboard
            </button>
            <button
              type="button"
              onClick={onDownloadText}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
            >
              <Download className="h-4 w-4" />
              Download .txt
            </button>
          </div>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {state.text}
          </pre>
        </div>
      )}

      {/* Related */}
      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Related tools
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href="/tools/pdf-to-word"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            PDF to Word
          </Link>
          <Link
            href="/tools/compress"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Compress PDF
          </Link>
          <Link
            href="/tools/pdf-to-image"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            PDF to Image
          </Link>
        </div>
      </div>
    </div>
  );
}
