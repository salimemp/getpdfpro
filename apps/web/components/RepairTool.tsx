"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  Wrench,
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Lock,
  ScanText,
  FileWarning,
  Zap,
} from "lucide-react";
import { repairPdf, ApiError, type RepairOptions } from "@/lib/api";
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
      actionsApplied: string[];
      needsOcr: boolean;
      elapsedMs: number;
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

export function RepairTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
  // Each option is a checkbox the user can toggle. Default values:
  // ocr=ON, repair=ON, unlock=OFF, linearize=ON. lang/dpi only
  // matter if ocr is enabled.
  const [ocr, setOcr] = useState(true);
  const [repair, setRepair] = useState(true);
  const [unlock, setUnlock] = useState(false);
  const [password, setPassword] = useState("");
  const [linearize, setLinearize] = useState(true);
  const [lang, setLang] = useState("eng");
  const [dpi, setDpi] = useState(300);
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

  const onRun = useCallback(async () => {
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
    const options: RepairOptions = {
      ocr,
      repair,
      unlock,
      linearize,
      lang,
      dpi,
    };
    if (password) options.password = password;
    try {
      const result = await repairPdf(file, options);
      quota.consume();
      setState({
        kind: "done",
        filename: result.filename,
        pages: result.pages,
        sizeBytes: result.sizeBytes,
        actionsApplied: result.actionsApplied,
        needsOcr: result.needsOcr,
        elapsedMs: result.elapsedMs,
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
  }, [file, ocr, repair, unlock, password, linearize, lang, dpi, quota, auth.user]);

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
          <Wrench className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Repair PDF
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Fix a broken, scanned, locked, or slow-loading PDF in one
          pass. Recovers corrupt files, adds a text layer to scans,
          strips password restrictions, and optimizes for web.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          All four repair passes are safe — they preserve the
          original page visuals. OCR adds an invisible text layer
          only if the PDF is scanned (no text layer detected). Linearize
          is recommended for any PDF you serve over the web. Unlock
          requires the actual PDF password.
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
                <Wrench className="h-5 w-5" />
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

      {/* Repair options */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <RepairOption
          icon={<FileWarning className="h-4 w-4" />}
          title="Repair structure"
          description="Rebuild the PDF's internal xref table and trailer. Fixes most 'won't open in any viewer' errors caused by partial downloads, bad copies, or file corruption."
          checked={repair}
          onChange={setRepair}
          defaultOn
        />
        <RepairOption
          icon={<ScanText className="h-4 w-4" />}
          title="Add OCR text layer"
          description="If the PDF is scanned (no text layer), run Tesseract OCR to add an invisible text layer so it becomes searchable (Ctrl+F) and text-selectable. Skipped if a text layer already exists."
          checked={ocr}
          onChange={setOcr}
          defaultOn
        />
        <RepairOption
          icon={<Zap className="h-4 w-4" />}
          title="Linearize (Fast Web View)"
          description="Re-save the PDF with the cross-reference table at the start of the file. The first page renders before the whole file is downloaded. Recommended for any PDF served over the web."
          checked={linearize}
          onChange={setLinearize}
          defaultOn
        />
        <RepairOption
          icon={<Lock className="h-4 w-4" />}
          title="Unlock (remove password / permissions)"
          description="Strip the owner password (edit/print/copy restrictions). If the PDF also has a user password, supply it below so we can remove that too."
          checked={unlock}
          onChange={setUnlock}
          defaultOn={false}
        />
      </div>

      {/* Password field — only shown when unlock is on */}
      {unlock && (
        <div className="mt-4">
          <label
            htmlFor="repair-password"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            PDF password{" "}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              (only needed if the PDF is encrypted with a user password)
            </span>
          </label>
          <input
            id="repair-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank if you only need to remove the owner password"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            autoComplete="off"
          />
        </div>
      )}

      {/* OCR-specific options (only show if OCR is enabled) */}
      {ocr && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="repair-lang"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              OCR language
            </label>
            <select
              id="repair-lang"
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
          </div>
          <div>
            <label
              htmlFor="repair-dpi"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Render DPI: <span className="font-semibold">{dpi}</span>
            </label>
            <input
              id="repair-dpi"
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
      )}

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
              Repairing...
            </>
          ) : (
            <>
              <Wrench className="h-4 w-4" />
              Repair PDF
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
            <span className="font-semibold">Repaired PDF ready.</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pages</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.pages}
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
            <div>
              <dt className="text-slate-500 dark:text-slate-400">OCR used</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {state.needsOcr ? "yes" : "no"}
              </dd>
            </div>
          </dl>
          {state.actionsApplied.length > 0 && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Applied
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {state.actionsApplied.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
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
            href="/tools/pdf-to-word"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            PDF to Word
          </Link>
        </div>
      </div>
    </div>
  );
}

function RepairOption({
  icon,
  title,
  description,
  checked,
  onChange,
  defaultOn,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  defaultOn: boolean;
}) {
  return (
    <label className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-brand-600 dark:text-brand-400">{icon}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {title}
            </span>
            {defaultOn && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                default
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </label>
  );
}
