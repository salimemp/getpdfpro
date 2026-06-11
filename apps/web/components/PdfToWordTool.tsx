"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  FileType,
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { pdfToWord, ApiError } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

type State =
  | { kind: "idle" }
  | { kind: "uploading"; filename: string }
  | {
      kind: "done";
      filename: string;
      pages: number;
      sizeBytes: number;
      blob: Blob;
    }
  | { kind: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function PdfToWordTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
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

  const onConvert = async () => {
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
      const result = await pdfToWord(file);
      quota.consume();
      setState({
        kind: "done",
        filename: result.filename,
        pages: result.sourcePages,
        sizeBytes: result.sizeBytes,
        blob: result.blob,
      });
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
    if (state.kind !== "done") return;
    const url = URL.createObjectURL(state.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.filename;
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
          <FileType className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          PDF to Word
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Convert a PDF to a .docx file. Best-effort text, headings, and
          basic tables. Files are processed on the server and never
          stored.
        </p>
      </div>

      {/* Honest accuracy warning */}
      <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong>Honest accuracy note.</strong> This is a best-effort
          conversion. We extract text, headings, and basic tables. The
          following will <strong>not</strong> round-trip faithfully:
          multi-column layouts, complex tables, math equations, custom
          fonts, and precise positioning. Expect manual cleanup in Word
          for complex documents. We won't claim to be a 1:1 conversion
          engine — that would be a lie.
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
                <FileType className="h-5 w-5" />
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
              Drop a PDF here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              PDF up to 50 MB (free tier)
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

      {/* Action */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {quota.used}/{quota.limit} tasks used today
        </div>
        <button
          type="button"
          onClick={onConvert}
          disabled={!file || state.kind === "uploading"}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === "uploading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <FileType className="h-4 w-4" />
              Convert to .docx
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

      {/* Success */}
      {state.kind === "done" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Done! Your .docx is ready.</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">PDF pages</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.pages}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">.docx size</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBytes(state.sizeBytes)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            Open the .docx in Word and review formatting. Multi-column
            layouts, complex tables, and embedded images may need
            manual cleanup.
          </p>
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

      {/* Related */}
      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Related tools
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href="/tools/ocr"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            OCR PDF
          </Link>
          <Link
            href="/tools/compress"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Compress PDF
          </Link>
          <Link
            href="/tools/merge"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Merge PDF
          </Link>
        </div>
      </div>
    </div>
  );
}
