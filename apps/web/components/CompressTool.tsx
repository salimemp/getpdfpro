"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  Minimize2,
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  compressPdf,
  type CompressionLevel,
  ApiError,
} from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

type CompressState =
  | { kind: "idle" }
  | { kind: "compressing"; filename: string }
  | {
      kind: "done";
      filename: string;
      level: CompressionLevel;
      originalBytes: number;
      compressedBytes: number;
      savedPercent: number;
      blob: Blob;
    }
  | { kind: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const LEVELS: {
  id: CompressionLevel;
  label: string;
  description: string;
  badge: string;
}[] = [
  {
    id: "low",
    label: "Low compression",
    description: "Best quality. Garbage-collects unused objects only. ~10% smaller.",
    badge: "Best quality",
  },
  {
    id: "medium",
    label: "Medium compression",
    description: "Balanced. Re-encodes JPEGs at quality 70. ~40% smaller for image PDFs.",
    badge: "Recommended",
  },
  {
    id: "high",
    label: "High compression",
    description: "Smallest file. Downsamples images to ~150 DPI, JPEG quality 50. ~70% smaller.",
    badge: "Smallest",
  },
];

export function CompressTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressionLevel>("medium");
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<CompressState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (arr.length === 0) {
      setState({ kind: "error", message: "Only PDF files are supported." });
      return;
    }
    setFile(arr[0]);
    setState({ kind: "idle" });
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) setFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);

  const onCompress = async () => {
    if (!file) {
      setState({ kind: "error", message: "Choose a PDF first." });
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
    setState({ kind: "compressing", filename: file.name });
    try {
      const result = await compressPdf(file, level);
      quota.consume();
      setState({
        kind: "done",
        filename: result.filename,
        level: result.level,
        originalBytes: result.originalBytes,
        compressedBytes: result.compressedBytes,
        savedPercent: result.savedPercent,
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

  const isCompressing = state.kind === "compressing";

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Minimize2 className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Compress PDF
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Shrink a PDF with smart quality preservation. Image-heavy PDFs
          compress the most.
        </p>
      </div>

      {/* Drop zone (or picked file) */}
      {!file ? (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
            dragging
              ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
              : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
          }`}
        >
          <Upload className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Click to choose a file
            </button>{" "}
            or drag and drop
          </p>
          <p className="mt-1 text-xs text-slate-500">PDF only · Up to 50 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={onPick}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {file.name}
              </p>
              <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={onReset}
              aria-label="Remove"
              className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Level selector */}
      {file && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Compression level
          </h2>
          <div className="mt-3 grid gap-3">
            {LEVELS.map((l) => (
              <label
                key={l.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  level === l.id
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value={l.id}
                  checked={level === l.id}
                  onChange={() => setLevel(l.id)}
                  className="mt-1 h-4 w-4 accent-brand-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {l.label}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {l.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{l.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          <span>
            {auth.user
              ? `${quota.remaining} of ${quota.limit} free tasks left today`
              : `${quota.remaining} of ${quota.limit} free task left today`}{" "}
            {!auth.user && (
              <Link
                href="/signup"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                · Sign up free
              </Link>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={onCompress}
          disabled={!file || isCompressing || !quota.canRun}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCompressing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Compressing…
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Compress PDF
            </>
          )}
        </button>

        {state.kind === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}

        {state.kind === "done" && (
          <div className="w-full max-w-md rounded-xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-900 dark:bg-green-950">
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-600 dark:text-green-400" />
            <h3 className="mt-2 font-semibold text-green-900 dark:text-green-100">
              Compressed successfully
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-green-700 dark:text-green-300">Before</p>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {formatBytes(state.originalBytes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-green-700 dark:text-green-300">After</p>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {formatBytes(state.compressedBytes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-green-700 dark:text-green-300">Saved</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  {state.savedPercent}%
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDownload}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
