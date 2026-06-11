"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  Combine,
  Upload,
  X,
  ArrowUp,
  ArrowDown,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { mergePdfs, ApiError } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

type FileItem = {
  id: string;
  file: File;
};

type MergeState =
  | { kind: "idle" }
  | { kind: "uploading"; filename: string }
  | { kind: "done"; filename: string; pages: number; sizeBytes: number; blob: Blob }
  | { kind: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function MergeTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [items, setItems] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<MergeState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (arr.length === 0) {
      setState({ kind: "error", message: "Only PDF files are supported." });
      return;
    }
    setItems((prev) => [
      ...prev,
      ...arr.map((f) => ({ id: newId(), file: f })),
    ]);
    setState({ kind: "idle" });
  }, []);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = ""; // allow re-picking the same file
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

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

  const onMerge = async () => {
    if (items.length < 2) {
      setState({ kind: "error", message: "Add at least 2 PDFs to merge." });
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
    setState({ kind: "uploading", filename: "merged.pdf" });
    try {
      const result = await mergePdfs(items.map((i) => i.file));
      quota.consume();
      setState({
        kind: "done",
        filename: result.filename,
        pages: result.pages,
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
    setItems([]);
    setState({ kind: "idle" });
  };

  const totalBytes = items.reduce((acc, i) => acc + i.file.size, 0);
  const canMerge = items.length >= 2 && state.kind !== "uploading";

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Combine className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Merge PDF
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Combine PDFs in the order you want. Drag, drop, done. Files are
          processed on the server and never stored.
        </p>
      </div>

      {/* Drop zone */}
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
            Click to choose files
          </button>{" "}
          or drag and drop
        </p>
        <p className="mt-1 text-xs text-slate-500">
          PDF only · Up to 50 MB total on the fast track
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={onPickFiles}
        />
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {items.length} file{items.length === 1 ? "" : "s"} ·{" "}
              {formatBytes(totalBytes)} total
            </h2>
            <button
              type="button"
              onClick={onReset}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Clear all
            </button>
          </div>
          <ol className="space-y-2">
            {items.map((item, idx) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, -1)}
                    disabled={idx === 0}
                    aria-label="Move up"
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={idx === items.length - 1}
                    aria-label="Move down"
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove"
                    className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
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
          onClick={onMerge}
          disabled={!canMerge || !quota.canRun}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === "uploading" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Merging…
            </>
          ) : (
            <>
              <Combine className="h-5 w-5" />
              Merge {items.length > 0 ? `${items.length} PDFs` : "PDFs"}
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
              Merged successfully
            </h3>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              {state.filename} · {state.pages} page{state.pages === 1 ? "" : "s"} ·{" "}
              {formatBytes(state.sizeBytes)}
            </p>
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
