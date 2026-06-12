"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Download,
  Globe,
  Languages,
  Copy,
  Check,
} from "lucide-react";
import { summarizePdf, translatePdf, ApiError } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
];

const LENGTH_OPTIONS = [
  { value: "short", label: "Short", desc: "~50 words" },
  { value: "medium", label: "Medium", desc: "~200 words" },
  { value: "long", label: "Long", desc: "~500 words" },
  { value: "bullets", label: "Bullet points", desc: "5-10 bullets" },
] as const;

const RELATED = [
  { label: "OCR PDF", href: "/tools/ocr" },
  { label: "PDF to Word", href: "/tools/pdf-to-word" },
  { label: "Translate PDF", href: "/tools/translate" },
  { label: "Compress PDF", href: "/tools/compress" },
];

export function SummarizeTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
  const [length, setLength] = useState<"short" | "medium" | "long" | "bullets">("medium");
  const [language, setLanguage] = useState("en");
  const [format, setFormat] = useState<"text" | "markdown">("markdown");
  const [result, setResult] = useState<{
    text: string;
    filename: string;
    sourcePages: number;
    model: string;
    elapsedMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
    e.target.value = "";
  };

  const onRun = async () => {
    if (!file) {
      setError("Pick a PDF first.");
      return;
    }
    if (!quota.canRun) {
      setError(
        auth.user
          ? `You've used all ${quota.limit} of today's tasks. Resets at midnight.`
          : "You've used today's free task. Sign up free for 50 tasks/day."
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await summarizePdf(file, { length, language, format });
      quota.consume();
      setResult({
        text: r.text,
        filename: r.filename,
        sourcePages: r.sourcePages,
        model: r.model,
        elapsedMs: r.elapsedMs,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onDownload = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: format === "markdown" ? "text/markdown" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          <span>AI tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">AI Summarize PDF</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Get a concise summary of any PDF using Gemini AI. Pick a length and language. The summary is shown
          inline — you can copy it, download it, or read it directly.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Summarization is best-effort AI. For technical / legal / medical content, always verify the
          summary against the source. Scanned PDFs need OCR first — use <a href="/tools/ocr" className="underline">/tools/ocr</a> before summarizing.
        </div>
      </div>

      {/* File picker */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.name.toLowerCase().endsWith(".pdf")) {
            setFile(f);
            setResult(null);
            setError(null);
          }
        }}
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"
      >
        {file ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{file.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Remove file"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <Sparkles className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-slate-700 dark:text-slate-300">
              Drop a PDF here, or{" "}
              <label className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400">
                browse
                <input type="file" accept="application/pdf,.pdf" onChange={onPick} className="hidden" />
              </label>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF up to 50 MB</p>
          </>
        )}
      </div>

      {/* Options */}
      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Summary length
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLength(opt.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  length === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Output language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="markdown">Markdown</option>
              <option value="text">Plain text</option>
            </select>
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
          disabled={!file || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Summarizing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Summarize
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Summary ready.</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
            {result.sourcePages} pages summarized in {result.elapsedMs}ms · model: {result.model}
          </div>
          <div className="mt-3 max-h-[500px] overflow-y-auto rounded-lg border border-emerald-200 bg-white p-4 text-sm leading-relaxed text-slate-800 dark:border-emerald-900 dark:bg-slate-950 dark:text-slate-200">
            <pre className="whitespace-pre-wrap font-sans">{result.text}</pre>
          </div>
        </div>
      )}

      {RELATED.length > 0 && (
        <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Related tools
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {RELATED.map((t) => (
              <a
                key={t.href}
                href={t.href}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TranslateTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("es");
  const [sourceLang, setSourceLang] = useState("");
  const [outputFormat, setOutputFormat] = useState<"pdf" | "text">("pdf");
  const [result, setResult] = useState<{
    blob: Blob;
    filename: string;
    sourcePages: number;
    outputPages: number;
    sizeBytes: number;
    model: string;
    elapsedMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
    e.target.value = "";
  };

  const onRun = async () => {
    if (!file) {
      setError("Pick a PDF first.");
      return;
    }
    if (!quota.canRun) {
      setError(
        auth.user
          ? `You've used all ${quota.limit} of today's tasks. Resets at midnight.`
          : "You've used today's free task. Sign up free for 50 tasks/day."
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await translatePdf(file, {
        targetLang,
        sourceLang: sourceLang || undefined,
        outputFormat,
      });
      quota.consume();
      setResult({
        blob: r.blob,
        filename: r.filename,
        sourcePages: r.sourcePages,
        outputPages: r.outputPages,
        sizeBytes: r.sizeBytes,
        model: r.model,
        elapsedMs: r.elapsedMs,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Languages className="h-3.5 w-3.5 text-brand-600" />
          <span>AI tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">AI Translate PDF</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Translate a PDF into any language using Gemini AI. Output as a new PDF with the translated text
          on the same page count, or as a plain text file.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong>Quality note:</strong> AI translation is best for general content. For legal, medical,
          or technical documents, always have a professional reviewer. The output PDF does NOT preserve
          the original layout (fonts, images, headers) — only the page count and approximate layout.
          Scanned PDFs need OCR first — use <a href="/tools/ocr" className="underline">/tools/ocr</a> before translating.
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.name.toLowerCase().endsWith(".pdf")) {
            setFile(f);
            setResult(null);
            setError(null);
          }
        }}
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"
      >
        {file ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                <Languages className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{file.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <Languages className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-slate-700 dark:text-slate-300">
              Drop a PDF here, or{" "}
              <label className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400">
                browse
                <input type="file" accept="application/pdf,.pdf" onChange={onPick} className="hidden" />
              </label>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF up to 50 MB</p>
          </>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Translate to
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              From (auto-detect if blank)
            </label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Auto-detect</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Output format
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOutputFormat("pdf")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                outputFormat === "pdf"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              PDF (new file, page count preserved)
            </button>
            <button
              type="button"
              onClick={() => setOutputFormat("text")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                outputFormat === "text"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              Plain text
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {quota.used}/{quota.limit} tasks used today
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={!file || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Translating...
            </>
          ) : (
            <>
              <Languages className="h-4 w-4" />
              Translate
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Translation ready.</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pages</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {result.sourcePages} → {result.outputPages}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Size</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {(result.sizeBytes / 1024).toFixed(1)} KB
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Time</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {(result.elapsedMs / 1000).toFixed(1)}s
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Model</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{result.model}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={onDownload}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Download {result.filename}
          </button>
        </div>
      )}

      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Related tools
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {RELATED.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
