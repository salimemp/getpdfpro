"use client";

import { useCallback, useRef, useState } from "react";
import {
  Scissors,
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { splitPdf, ApiError } from "@/lib/api";

type SplitMode = "all" | "ranges";

type SplitState =
  | { kind: "idle" }
  | { kind: "splitting"; filename: string }
  | {
      kind: "done";
      filename: string;
      sourcePages: number;
      parts: number;
      sizeBytes: number;
      blob: Blob;
    }
  | { kind: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SplitMode>("all");
  const [ranges, setRanges] = useState<string>("1-3,5,7-9");
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<SplitState>({ kind: "idle" });
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

  const onSplit = async () => {
    if (!file) {
      setState({ kind: "error", message: "Choose a PDF first." });
      return;
    }
    if (mode === "ranges" && !ranges.trim()) {
      setState({
        kind: "error",
        message: "Enter page ranges (e.g. 1-3,5,7-9) or switch to All pages.",
      });
      return;
    }
    setState({ kind: "splitting", filename: file.name });
    try {
      const result = await splitPdf(file, {
        mode,
        ranges: mode === "ranges" ? ranges : undefined,
      });
      setState({
        kind: "done",
        filename: result.filename,
        sourcePages: result.sourcePages,
        parts: result.parts,
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

  const isSplitting = state.kind === "splitting";

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Scissors className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Split PDF
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Extract pages or split by ranges. The output is a ZIP of one-PDF-per-page.
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

      {/* Mode selector */}
      {file && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            How do you want to split?
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                mode === "all"
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="all"
                checked={mode === "all"}
                onChange={() => setMode("all")}
                className="mt-1 h-4 w-4 accent-brand-600"
              />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  One PDF per page
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Every page becomes its own single-page PDF.
                </p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                mode === "ranges"
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="ranges"
                checked={mode === "ranges"}
                onChange={() => setMode("ranges")}
                className="mt-1 h-4 w-4 accent-brand-600"
              />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Custom page ranges
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Pick specific pages or ranges to extract.
                </p>
              </div>
            </label>
          </div>

          {mode === "ranges" && (
            <div className="mt-4">
              <label
                htmlFor="ranges"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Page ranges
              </label>
              <input
                id="ranges"
                type="text"
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                placeholder="1-3,5,7-9"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Comma-separated. Examples:{" "}
                <code className="text-slate-700 dark:text-slate-300">1-3</code>,{" "}
                <code className="text-slate-700 dark:text-slate-300">5</code>, or{" "}
                <code className="text-slate-700 dark:text-slate-300">7-9</code>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onSplit}
          disabled={!file || isSplitting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSplitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Splitting…
            </>
          ) : (
            <>
              <Scissors className="h-5 w-5" />
              Split PDF
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
              Split complete
            </h3>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              {state.parts} PDF{state.parts === 1 ? "" : "s"} from{" "}
              {state.sourcePages} page{state.sourcePages === 1 ? "" : "s"} ·{" "}
              {formatBytes(state.sizeBytes)}
            </p>
            <button
              type="button"
              onClick={onDownload}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Download ZIP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
