"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  FileImage,
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { pdfToImages, ApiError, ImageFormat } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

type State =
  | { kind: "idle" }
  | { kind: "uploading"; filename: string }
  | {
      kind: "done";
      filename: string;
      pages: number;
      format: ImageFormat;
      dpi: number;
      sizeBytes: number;
      blob: Blob;
    }
  | { kind: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function PdfToImageTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [dpi, setDpi] = useState<number>(144);
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
      const result = await pdfToImages(file, { format, dpi });
      quota.consume();
      setState({
        kind: "done",
        filename: result.filename,
        pages: result.sourcePages,
        format: result.format,
        dpi: result.dpi,
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
          <FileImage className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          PDF to Image
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Convert each page of a PDF into a PNG or JPEG. Bundled as a ZIP.
          Free, fast, and private — files are processed on the server and
          never stored.
        </p>
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
                <FileImage className="h-5 w-5" />
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
              One PDF up to 50 MB (free tier)
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
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Image format
          </label>
          <div className="flex gap-2">
            {(["png", "jpeg"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  format === f
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            PNG = lossless, larger files. JPEG = smaller, lossy.
          </p>
        </div>
        <div>
          <label
            htmlFor="dpi"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Resolution: <span className="font-semibold">{dpi} DPI</span>
          </label>
          <input
            id="dpi"
            type="range"
            min={72}
            max={300}
            step={12}
            value={dpi}
            onChange={(e) => setDpi(parseInt(e.target.value, 10))}
            className="w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>72 (screen)</span>
            <span>150 (print)</span>
            <span>300 (high-res)</span>
          </div>
        </div>
      </div>

      {/* Action button */}
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
              <FileImage className="h-4 w-4" />
              Convert to images
            </>
          )}
        </button>
      </div>

      {/* Error / success */}
      {state.kind === "error" && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      {state.kind === "done" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Done! Your images are ready.</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pages</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.pages}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Format</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.format.toUpperCase()}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">DPI</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.dpi}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">ZIP size</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBytes(state.sizeBytes)}
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

      {/* Related tools */}
      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Related tools
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href="/tools/image-to-pdf"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Image to PDF
          </Link>
          <Link
            href="/tools/merge"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Merge PDF
          </Link>
          <Link
            href="/tools/compress"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Compress PDF
          </Link>
        </div>
      </div>
    </div>
  );
}
