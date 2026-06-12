"use client";

/**
 * 16 new PDF tool UIs (C10 sprint).
 *
 * Each is a thin wrapper over the shared PdfToolShell — they all
 * just plug in the right icon, description, options form, and API
 * call. The shell handles file picking, drag/drop, state machine,
 * success/error rendering, download, quota, and accessibility.
 *
 * The 16 tools are listed below in the order they appear in the
 * tools index page:
 *   1. RotatePdfTool         5. OrganizePdfTool         9. HtmlToPdfTool        13. UnlockPdfTool
 *   2. CropPdfTool           6. PageNumbersTool        10. PdfToPdfATool        14. ProtectPdfTool
 *   3. ExtractPagesTool      7. ScanToPdfTool          11. RedactPdfTool        15. SignPdfTool
 *   4. AddRemovePagesTool    8. ComparePdfsTool         12. FormsExtractTool     16. EditPdfTool
 */

import { useState } from "react";
import {
  RotateCw,
  Crop,
  FileMinus,
  Scissors,
  ArrowUpDown,
  Hash,
  ScanLine,
  Globe,
  FileCheck,
  EyeOff,
  GitCompareArrows,
  ListChecks,
  Lock,
  Unlock,
  PenTool,
  Edit3,
  Info,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
} from "lucide-react";
import { PdfToolShell, type ToolRunResult } from "./PdfToolShell";
import {
  rotatePdf,
  cropPdf,
  extractPages,
  addRemovePages,
  organizePages,
  addPageNumbers,
  scanToPdf,
  htmlToPdf,
  pdfToPdfA,
  redactPdf,
  comparePdfs,
  extractForms,
  unlockPdf,
  protectPdf,
  signPdf,
  editPdf,
} from "@/lib/api";

const RELATED = [
  { label: "Merge PDF", href: "/tools/merge" },
  { label: "Split PDF", href: "/tools/split" },
  { label: "Compress PDF", href: "/tools/compress" },
  { label: "OCR PDF", href: "/tools/ocr" },
  { label: "PDF to Word", href: "/tools/pdf-to-word" },
  { label: "Repair PDF", href: "/tools/repair" },
];

// ─── 1. Rotate ──────────────────────────────────────────────
export function RotatePdfTool() {
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [pages, setPages] = useState("");
  return (
    <PdfToolShell
      title="Rotate PDF"
      description="Rotate all or specific pages of a PDF. The /Rotate flag is non-destructive — the underlying page visuals aren't re-rendered."
      pillLabel="PDF tool"
      pillIcon={<RotateCw className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Rotate PDF"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await rotatePdf(files[0], { angle, pages });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Pages: r.pages, Rotated: r.rotatedPages, Angle: `${r.angle}°` } };
      }}
      options={
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Rotation angle</label>
            <div className="flex gap-2">
              {[90, 180, 270].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAngle(a as 90 | 180 | 270)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    angle === a
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {a}°
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Pages (optional)
            </label>
            <input
              type="text"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="e.g. 1,3-5 (blank = all pages)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </>
      }
    />
  );
}

// ─── 2. Crop ─────────────────────────────────────────────────
export function CropPdfTool() {
  const [top, setTop] = useState(36);
  const [bottom, setBottom] = useState(36);
  const [left, setLeft] = useState(36);
  const [right, setRight] = useState(36);
  return (
    <PdfToolShell
      title="Crop PDF"
      description="Crop pages of a PDF by shrinking the visible area. Values in PDF points (1 pt = 1/72 inch). Letter is 612×792 pts."
      pillLabel="PDF tool"
      pillIcon={<Crop className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Crop PDF"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await cropPdf(files[0], { top, bottom, left, right });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Pages: r.pages, Cropped: r.croppedPages } };
      }}
      options={
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {([
            ["Top", top, setTop],
            ["Bottom", bottom, setBottom],
            ["Left", left, setLeft],
            ["Right", right, setRight],
          ] as const).map(([label, value, setter]) => (
            <div key={label}>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {label} <span className="text-slate-500">({value} pt)</span>
              </label>
              <input
                type="number"
                min={0}
                max={200}
                value={value}
                onChange={(e) => setter(parseInt(e.target.value || "0", 10))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          ))}
        </div>
      }
    />
  );
}

// ─── 3. Extract Pages ───────────────────────────────────────
export function ExtractPagesTool() {
  const [pages, setPages] = useState("1,3-5");
  return (
    <PdfToolShell
      title="Extract Pages"
      description="Pull specific pages from a PDF into a new PDF. Use this for 'give me just chapter 3' or 'extract the cover and table of contents'."
      pillLabel="PDF tool"
      pillIcon={<FileMinus className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Extract Pages"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await extractPages(files[0], pages);
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { "Source pages": r.sourcePages, "Output pages": r.outputPages } };
      }}
      options={
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Pages to extract
          </label>
          <input
            type="text"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder="e.g. 1,3-5,7"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <p className="mt-1 text-xs text-slate-500">1-based, ranges OK. Example: 1,3-5 → pages 1, 3, 4, 5.</p>
        </div>
      }
    />
  );
}

// ─── 4. Add / Remove Pages ──────────────────────────────────
export function AddRemovePagesTool() {
  const [mode, setMode] = useState<"delete" | "keep">("delete");
  const [spec, setSpec] = useState("2,4-6");
  return (
    <PdfToolShell
      title="Add or Remove Pages"
      description="Delete specific pages from a PDF, or keep only the pages you specify. Useful for trimming a long document before sharing."
      pillLabel="PDF tool"
      pillIcon={<Scissors className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Apply"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await addRemovePages(files[0], mode === "delete" ? { delete: spec } : { keep: spec });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { "Source pages": r.sourcePages, "Output pages": r.outputPages, Removed: r.removedPages } };
      }}
      options={
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Mode</label>
            <div className="flex gap-2">
              {(["delete", "keep"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    mode === m
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {m === "delete" ? "Delete these pages" : "Keep only these pages"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Page spec
            </label>
            <input
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder={mode === "delete" ? "e.g. 2,4-6 (pages to remove)" : "e.g. 1,3-5 (pages to keep)"}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </>
      }
    />
  );
}

// ─── 5. Organize (Reorder) ──────────────────────────────────
export function OrganizePdfTool() {
  const [order, setOrder] = useState("3,1,2,4");
  return (
    <PdfToolShell
      title="Organize PDF"
      description="Reorder the pages of a PDF. Pages can appear multiple times (to duplicate) or be omitted (to remove)."
      pillLabel="PDF tool"
      pillIcon={<ArrowUpDown className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Organize"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await organizePages(files[0], order);
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { "Source pages": r.sourcePages, "Output pages": r.outputPages } };
      }}
      options={
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            New page order
          </label>
          <input
            type="text"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="e.g. 3,1,2,4-7 (puts page 3 first, then 1, 2, then 4 through 7)"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <p className="mt-1 text-xs text-slate-500">Use a page number twice to duplicate. Omit a page to remove it.</p>
        </div>
      }
    />
  );
}

// ─── 6. Page Numbers ────────────────────────────────────────
export function PageNumbersTool() {
  const [position, setPosition] = useState<"bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left">("bottom-center");
  const [format, setFormat] = useState<"n-of-m" | "n" | "page-n">("n-of-m");
  const [start, setStart] = useState(1);
  return (
    <PdfToolShell
      title="Add Page Numbers"
      description="Stamp 'Page N of M' on every page of a PDF. Pick the position, font, and starting number."
      pillLabel="PDF tool"
      pillIcon={<Hash className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Add Page Numbers"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await addPageNumbers(files[0], { position, format, start });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Pages: r.pages, Format: format } };
      }}
      options={
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as typeof position)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="bottom-center">Bottom center</option>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="top-center">Top center</option>
              <option value="top-right">Top right</option>
              <option value="top-left">Top left</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="n-of-m">Page 3 of 10</option>
                <option value="n">3</option>
                <option value="page-n">Page 3</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Start at</label>
              <input
                type="number"
                min={1}
                value={start}
                onChange={(e) => setStart(parseInt(e.target.value || "1", 10))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </>
      }
    />
  );
}

// ─── 7. Scan to PDF (with OCR) ──────────────────────────────
export function ScanToPdfTool() {
  const [skipOcr, setSkipOcr] = useState(false);
  return (
    <PdfToolShell
      title="Scan to PDF"
      description="Convert phone-scanned images (JPG/PNG/WebP/TIFF) to a single searchable PDF. Adds an invisible OCR text layer by default."
      pillLabel="PDF tool"
      pillIcon={<ScanLine className="h-3.5 w-3.5 text-brand-600" />}
      accept="image/*"
      multiple
      dropzoneText="Drop one or more scanned images, or "
      runButtonLabel="Create PDF"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await scanToPdf(files, { skipOcr });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Pages: r.pages, "Source images": r.sourceImages, "OCR words": r.wordsInserted } };
      }}
      options={
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={skipOcr}
            onChange={(e) => setSkipOcr(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Skip OCR (faster; output is not searchable)</span>
        </label>
      }
    />
  );
}

// ─── 8. Compare (handled separately, needs 2 files) ─────────
export function ComparePdfsTool() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [result, setResult] = useState<ToolRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onRun = async () => {
    if (!fileA || !fileB) {
      setError("Pick both PDFs.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await comparePdfs(fileA, fileB);
      setResult({ blob: r.blob, filename: r.filename, sizeBytes: r.blob.size, extras: { Adapter: r.adapter } });
    } catch (e: any) {
      setError(e.detail || e.message || "Compare failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          <GitCompareArrows className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Compare PDF</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Compare two PDFs and get a difference report. Tier 1: Adobe visual diff. Tier 2: text-only word set diff.
        </p>
      </div>
      <div className="mb-6 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>The self-hosted fallback returns a JSON report with per-page word-difference stats, not a visual diff. Set <code>ADOBE_CLIENT_ID</code> + <code>ADOBE_CLIENT_SECRET</code> on the server to enable the Adobe tier.</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Base PDF (old)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFileA(e.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700 dark:border-slate-700 dark:bg-slate-900" />
          {fileA && <p className="mt-1 text-xs text-slate-500">{fileA.name}</p>}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Target PDF (new)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFileB(e.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700 dark:border-slate-700 dark:bg-slate-900" />
          {fileB && <p className="mt-1 text-xs text-slate-500">{fileB.name}</p>}
        </div>
      </div>
      <div className="mt-6">
        <button
          type="button"
          onClick={onRun}
          disabled={!fileA || !fileB || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
          Compare
        </button>
      </div>
      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Compare report ready.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const url = URL.createObjectURL(result.blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = result.filename;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            <Download className="h-4 w-4" /> Download {result.filename}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 9. HTML to PDF ─────────────────────────────────────────
export function HtmlToPdfTool() {
  const [mode, setMode] = useState<"html" | "url">("html");
  const [html, setHtml] = useState("<h1>Hello world</h1><p>This is a paragraph.</p>");
  const [url, setUrl] = useState("https://example.com");
  return (
    <PdfToolShell
      title="HTML to PDF"
      description="Convert HTML markup or a public URL to a PDF. xhtml2pdf engine — pure-Python, ~80% fidelity vs WeasyPrint."
      pillLabel="PDF tool"
      pillIcon={<Globe className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Render to PDF"
      relatedTools={RELATED}
      onRun={async () => {
        const r = await htmlToPdf(mode === "html" ? { html } : { url });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Pages: r.pages, "Render time": `${r.elapsedMs}ms` } };
      }}
      options={
        <>
          <div className="flex gap-2">
            {(["html", "url"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                  mode === m ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                From {m === "html" ? "HTML" : "URL"}
              </button>
            ))}
          </div>
          {mode === "html" ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">HTML markup</label>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          )}
        </>
      }
    />
  );
}

// ─── 10. PDF to PDF/A ───────────────────────────────────────
export function PdfToPdfATool() {
  return (
    <PdfToolShell
      title="Convert PDF to PDF/A"
      description="Convert a PDF to PDF/A-2b (archival format). Embeds fonts, normalizes color, and writes XMP metadata."
      pillLabel="Advanced"
      pillIcon={<FileCheck className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Convert"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await pdfToPdfA(files[0]);
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Conformance: r.conformance, Adapter: r.adapter } };
      }}
      options={
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Tier 1: Adobe PDF Services (true PDF/A conformance). Tier 2 (fallback): pikepdf metadata cleanup — approximate. The X-Adapter header tells you which.
        </p>
      }
    />
  );
}

// ─── 11. Redact ─────────────────────────────────────────────
export function RedactPdfTool() {
  const [words, setWords] = useState("");
  const [regex, setRegex] = useState("");
  return (
    <PdfToolShell
      title="Redact PDF"
      description="Remove text patterns from a PDF. Tier 1: Adobe genuine redaction. Tier 2: black rectangles (NOT real redaction)."
      pillLabel="Advanced"
      pillIcon={<EyeOff className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Redact"
      relatedTools={RELATED}
      infoBanner="The self-hosted fallback draws black rectangles on matches. The underlying text is NOT deleted — anyone with a text extraction tool can still read the 'redacted' content. Only use for non-sensitive material. For real redaction, configure Adobe PDF Services on the server."
      onRun={async (files) => {
        const r = await redactPdf(files[0], { words, regex });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { "Words redacted": r.wordsRedacted, "Regex patterns": r.regexRedacted, Adapter: r.adapter } };
      }}
      options={
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Words to redact (comma-separated)</label>
            <input
              type="text"
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder="e.g. John Smith,SSN,123-45-6789"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Regular expressions (comma-separated)</label>
            <input
              type="text"
              value={regex}
              onChange={(e) => setRegex(e.target.value)}
              placeholder='e.g. \d{3}-\d{2}-\d{4},confidential'
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </>
      }
    />
  );
}

// ─── 12. Forms Extract ─────────────────────────────────────
export function FormsExtractTool() {
  return (
    <PdfToolShell
      title="Extract Form Fields"
      description="Extract form field data from a PDF as JSON. Tier 1: Adobe (AcroForm + XFA). Tier 2: PyMuPDF widget walk (AcroForm only)."
      pillLabel="Advanced"
      pillIcon={<ListChecks className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Extract"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await extractForms(files[0]);
        return { blob: r.blob, filename: r.filename, sizeBytes: r.blob.size, extras: { "Field count": r.fieldCount, Adapter: r.adapter } };
      }}
    />
  );
}

// ─── 13. Unlock ─────────────────────────────────────────────
export function UnlockPdfTool() {
  const [password, setPassword] = useState("");
  return (
    <PdfToolShell
      title="Unlock PDF"
      description="Remove the user and/or owner password from a PDF. Result opens without any password and has no restrictions."
      pillLabel="PDF tool"
      pillIcon={<Unlock className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Unlock"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await unlockPdf(files[0], password);
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes };
      }}
      options={
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            User password <span className="font-normal text-slate-500">(leave blank if PDF only has owner password)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      }
    />
  );
}

// ─── 14. Protect ────────────────────────────────────────────
export function ProtectPdfTool() {
  const [userPwd, setUserPwd] = useState("");
  const [allow, setAllow] = useState<string[]>([]);
  return (
    <PdfToolShell
      title="Protect PDF"
      description="Encrypt a PDF with AES-256. Set a user password (required to open) and optionally allow specific actions."
      pillLabel="PDF tool"
      pillIcon={<Lock className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Protect"
      relatedTools={RELATED}
      onRun={async (files) => {
        const r = await protectPdf(files[0], { userPassword: userPwd, permissions: allow.join(",") || undefined });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Algorithm: r.algorithm } };
      }}
      options={
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">User password (required, min 4 chars)</label>
            <input
              type="password"
              value={userPwd}
              onChange={(e) => setUserPwd(e.target.value)}
              minLength={4}
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Allow specific actions <span className="font-normal text-slate-500">(empty = deny all except accessibility)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {["print", "modify", "copy", "annotate", "forms", "print_highres"].map((p) => (
                <label key={p} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={allow.includes(p)}
                    onChange={(e) => setAllow(e.target.checked ? [...allow, p] : allow.filter((x) => x !== p))}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600"
                  />
                  <span>{p.replace("_", " ")}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      }
    />
  );
}

// ─── 15. Sign (visual only) ─────────────────────────────────
export function SignPdfTool() {
  const [name, setName] = useState("Your Name");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [pages, setPages] = useState("");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left" | "bottom-center" | "top-right" | "top-left" | "top-center">("bottom-right");
  return (
    <PdfToolShell
      title="Sign PDF"
      description="Add a visual signature stamp to a PDF. NOT a PKI signature — anyone with image editing can remove it. For legal non-repudiation, use Adobe Acrobat or DocuSign."
      pillLabel="PDF tool"
      pillIcon={<PenTool className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Sign"
      relatedTools={RELATED}
      infoBanner="This is a visual signature, not a certificate-based PKI signature. The output X-Signature-Kind header reports 'visual-no-pki'. For legal binding signatures, use Adobe Acrobat, DocuSign, or another PKI service."
      onRun={async (files) => {
        const r = await signPdf(files[0], { name: sigFile ? undefined : name, signatureImage: sigFile || undefined, pages, position });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Kind: r.signatureKind, Pages: r.pages } };
      }}
      options={
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Signature image (optional)</label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setSigFile(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700 dark:file:bg-brand-950 dark:file:text-brand-300"
            />
            <p className="mt-1 text-xs text-slate-500">PNG with transparent background works best. Max 5 MB.</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Or render a typed name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as typeof position)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-center">Bottom center</option>
                <option value="top-right">Top right</option>
                <option value="top-left">Top left</option>
                <option value="top-center">Top center</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Pages (blank = last)</label>
              <input
                type="text"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder="e.g. 1,3-5"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </>
      }
    />
  );
}

// ─── 16. Edit PDF ───────────────────────────────────────────
export function EditPdfTool() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [stampText, setStampText] = useState("");
  return (
    <PdfToolShell
      title="Edit PDF"
      description="Edit metadata, cover a region with white, and/or stamp a label. NOT a click-to-edit WYSIWYG editor — that requires a more advanced tool."
      pillLabel="PDF tool"
      pillIcon={<Edit3 className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Apply"
      relatedTools={RELATED}
      infoBanner="MVP scope: metadata + whiteout + text stamps. We don't support click-to-edit text on the page — that's a multi-week WYSIWYG project. For that, use Adobe Acrobat Pro or Foxit PDF Editor."
      onRun={async (files) => {
        const r = await editPdf(files[0], { title, author, stampText });
        return { blob: r.blob, filename: r.filename, sizeBytes: r.sizeBytes, extras: { Metadata: String(r.editedMetadata), Whiteout: String(r.editedWhiteout), Stamp: String(r.editedStamp) } };
      }}
      options={
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Document title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Stamp text on every page (e.g. DRAFT, CONFIDENTIAL)</label>
            <input
              type="text"
              value={stampText}
              onChange={(e) => setStampText(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </>
      }
    />
  );
}
