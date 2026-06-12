"use client";

/**
 * Shared PDF tool shell — used by all 16 tools in the new C10 batch.
 *
 * One file, one set of styles, one state machine — every tool page
 * imports this and just supplies:
 *   - the file picker
 *   - the options (as React children)
 *   - the API call (as a callback that takes a File + options)
 *
 * This is deliberately generic. Tools with rich UIs (image cropping,
 * multi-page selection, etc.) can opt to NOT use this and roll their
 * own; but for the 16 new tools in the C10 sprint this gives us a
 * consistent, accessible UI for free.
 */

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

export type ToolState =
  | { kind: "idle" }
  | { kind: "uploading"; filename: string }
  | { kind: "done"; filename: string; sizeBytes: number; [k: string]: any }
  | { kind: "error"; message: string };

export interface ToolRunResult {
  blob: Blob;
  filename: string;
  sizeBytes: number;
  // Free-form extras (pages, elapsedMs, etc.) — surfaced in the
  // "result details" table. Each tool surfaces its own metrics.
  extras?: Record<string, string | number>;
}

export function PdfToolShell(props: {
  /** Page title (H1) */
  title: string;
  /** Short description (1-2 sentences) under the title */
  description: string;
  /** Info banner content (optional). Use for accuracy disclaimers etc. */
  infoBanner?: string;
  /** Pill badge (e.g. "PDF tool", "Advanced") */
  pillLabel?: string;
  /** Tool icon to show in the pill (small) */
  pillIcon?: React.ReactNode;
  /** Accept attribute for the file input */
  accept?: string;
  /** Multiple files (e.g. scan-to-pdf) */
  multiple?: boolean;
  /** Custom dropzone text. Default: "Drop a PDF here, or browse" */
  dropzoneText?: string;
  /** Form fields / options UI */
  options?: React.ReactNode;
  /** Button label (default: "Process") */
  runButtonLabel?: string;
  /** The actual API call. Receives the picked file(s) + form values. */
  onRun: (files: File[], formValues: FormData) => Promise<ToolRunResult>;
  /** Pull result values from the API result to surface in the success state. */
  resultExtras?: (result: ToolRunResult) => React.ReactNode;
  /** Related tools chips (optional) */
  relatedTools?: { label: string; href: string }[];
  /** Quota override — set to false to skip the quota check (e.g. for /compare which takes 2 files) */
  countsAsOneTask?: boolean;
}) {
  const auth = useAuth();
  const quota = useQuota();
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<ToolState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    const picked: File[] = [];
    for (let i = 0; i < list.length; i++) {
      picked.push(list[i]);
    }
    if (picked.length) {
      setFiles(picked);
      setState({ kind: "idle" });
    }
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped: File[] = [];
    if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        dropped.push(e.dataTransfer.files[i]);
      }
    }
    if (dropped.length) {
      setFiles(dropped);
      setState({ kind: "idle" });
    }
  };

  const onRun = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!files.length) {
        setState({ kind: "error", message: "Pick at least one file first." });
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
      // Pull any custom form fields the tool's options UI added.
      // We don't include the file in the FormData we pass to onRun;
      // onRun adds it itself with the right field name.
      const formValues = new FormData();
      if (formRef.current) {
        const fd = new FormData(formRef.current);
        for (const [k, v] of fd.entries()) {
          if (k === "file" || k === "files" || k === "file_a" || k === "file_b") continue;
          formValues.append(k, v);
        }
      }
      setState({ kind: "uploading", filename: files[0].name });
      try {
        const result = await props.onRun(files, formValues);
        quota.consume();
        setState({ kind: "done", ...result });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.detail
            : err instanceof Error
            ? err.message
            : "Unknown error";
        setState({ kind: "error", message });
      }
    },
    [files, props, quota, auth.user]
  );

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
    setFiles([]);
    setState({ kind: "idle" });
  };

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        {props.pillLabel && (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {props.pillIcon}
            <span>{props.pillLabel}</span>
          </div>
        )}
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {props.title}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {props.description}
        </p>
      </div>

      {props.infoBanner && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{props.infoBanner}</div>
        </div>
      )}

      <form ref={formRef} onSubmit={onRun}>
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
          {files.length ? (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {f.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatBytes(f.size)}
                      </p>
                    </div>
                  </div>
                  {i === 0 && (
                    <button
                      type="button"
                      onClick={onReset}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Remove files"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-slate-700 dark:text-slate-300">
                {props.dropzoneText ?? "Drop a PDF here, or "}
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
            accept={props.accept ?? "application/pdf,.pdf"}
            multiple={props.multiple}
            onChange={onPick}
            className="hidden"
          />
        </div>

        {/* Options */}
        {props.options && <div className="mt-6 space-y-4">{props.options}</div>}

        {/* Action */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {quota.used}/{quota.limit} tasks used today
          </div>
          <button
            type="submit"
            disabled={!files.length || state.kind === "uploading"}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.kind === "uploading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Working...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {props.runButtonLabel ?? "Process"}
              </>
            )}
          </button>
        </div>
      </form>

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
            <span className="font-semibold">Done.</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Output</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBytes(state.sizeBytes)}
              </dd>
            </div>
            {state.extras
              ? Object.entries(state.extras).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">
                      {String(v)}
                    </dd>
                  </div>
                ))
              : null}
            {props.resultExtras?.(state as any)}
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
      {props.relatedTools && props.relatedTools.length > 0 && (
        <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Related tools
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {props.relatedTools.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
