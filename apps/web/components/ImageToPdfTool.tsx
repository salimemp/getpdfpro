"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  X,
  ArrowUp,
  ArrowDown,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { imagesToPdf, ApiError, PageSize } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

type FileItem = {
  id: string;
  file: File;
};

type State =
  | { kind: "idle" }
  | { kind: "uploading"; filename: string }
  | {
      kind: "done";
      filename: string;
      sourceCount: number;
      pages: number;
      sizeBytes: number;
      pageSize: PageSize;
      blob: Blob;
    }
  | { kind: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/gif",
  "image/tiff",
];
const ACCEPTED_EXT = /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i;

export function ImageToPdfTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [items, setItems] = useState<FileItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("fit");
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(
      (f) =>
        ACCEPTED_IMAGE_TYPES.includes(f.type) ||
        ACCEPTED_EXT.test(f.name)
    );
    if (arr.length === 0) {
      setState({ kind: "error", message: "Only image files (JPG, PNG, WebP) are supported." });
      return;
    }
    setItems((prev) => [
      ...prev,
      ...arr.map((f) => ({ id: newId(), file: f })),
    ]);
    setState({ kind: "idle" });
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const onConvert = async () => {
    if (items.length < 1) {
      setState({ kind: "error", message: "Add at least 1 image." });
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
    setState({ kind: "uploading", filename: "images.pdf" });
    try {
      const result = await imagesToPdf(
        items.map((i) => i.file),
        { pageSize }
      );
      quota.consume();
      setState({
        kind: "done",
        filename: result.filename,
        sourceCount: result.sourceCount,
        pages: result.pages,
        sizeBytes: result.sizeBytes,
        pageSize: result.pageSize,
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
    setItems([]);
    setState({ kind: "idle" });
  };

  const totalBytes = items.reduce((acc, i) => acc + i.file.size, 0);
  const canConvert = items.length >= 1 && state.kind !== "uploading";

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <FileText className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Image to PDF
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Combine one or more images (JPG, PNG, WebP) into a single PDF.
          Each image becomes one page. Files are processed on the server
          and never stored.
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
        {items.length === 0 ? (
          <>
            <Upload className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-slate-700 dark:text-slate-300">
              Drop images here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              JPG, PNG, WebP, BMP, GIF, TIFF — total up to 50 MB (free)
            </p>
          </>
        ) : (
          <ul className="space-y-2 text-left">
            {items.map((it, idx) => (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {it.file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(it.file.size)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(it.id, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(it.id, 1)}
                    disabled={idx === items.length - 1}
                    className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
            <li className="pt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                + Add more images
              </button>
            </li>
          </ul>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp,image/gif,image/tiff,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tif,.tiff"
          onChange={onPick}
          className="hidden"
        />
      </div>

      {/* Page size option */}
      <div className="mt-6">
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Page size
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              { value: "fit", label: "Fit", desc: "A4 with margins" },
              { value: "a4", label: "A4", desc: "8.27 × 11.69 in" },
              { value: "letter", label: "Letter", desc: "8.5 × 11 in" },
              { value: "original", label: "Original", desc: "1px = 1pt" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPageSize(opt.value)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                pageSize === opt.value
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              <div
                className={`font-semibold ${
                  pageSize === opt.value
                    ? "text-brand-700 dark:text-brand-300"
                    : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {opt.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {items.length} image{items.length === 1 ? "" : "s"}
          {items.length > 0 && ` · ${formatBytes(totalBytes)} total`} ·{" "}
          {quota.used}/{quota.limit} tasks today
        </div>
        <button
          type="button"
          onClick={onConvert}
          disabled={!canConvert}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === "uploading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Convert to PDF
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
            <span className="font-semibold">Done! Your PDF is ready.</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Source images</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.sourceCount}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">PDF pages</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.pages}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Page size</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.pageSize}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">PDF size</dt>
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

      {/* Related */}
      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Related tools
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href="/tools/pdf-to-image"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            PDF to Image
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
