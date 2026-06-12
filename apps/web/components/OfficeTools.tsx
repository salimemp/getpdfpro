"use client";

/**
 * 5 Office conversion UIs (Wave C).
 *
 * Each is a thin wrapper over the shared PdfToolShell — file
 * upload, optional options (none for the Office tools in v1,
 * since Adobe handles all the options server-side), download.
 *
 * All 5 are tier-1 Adobe only. The shell surfaces a 503-style
 * error from the server ("Office conversions require Adobe PDF
 * Services to be configured") if the env vars aren't set.
 *
 * Note: Adobe's /operation/exportpdf endpoint is currently
 * returning INVALID_REQUEST_FORMAT for the internal-asset
 * pattern we're using. This is a known issue being debugged
 * in the live env. The UI ships so the structure is in place
 * — once the API works, the UI just works.
 */

import {
  FileType,        // Word
  Presentation,    // PowerPoint
  FileSpreadsheet, // Excel
  Presentation as Presentation2,  // alt alias
  Info,
} from "lucide-react";
import { PdfToolShell, type ToolRunResult } from "./PdfToolShell";
import {
  wordToPdf,
  powerpointToPdf,
  excelToPdf,
  pdfToPowerpoint,
  pdfToExcel,
} from "@/lib/api";

const RELATED = [
  { label: "PDF to Word", href: "/tools/pdf-to-word" },
  { label: "PDF to Image", href: "/tools/pdf-to-image" },
  { label: "OCR PDF", href: "/tools/ocr" },
];

const BANNER = "Office conversions use Adobe PDF Services for highest quality. They require ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET to be configured on the server. The free tier allows 500 document transactions per month (each conversion = 1 DT).";

// ─── 1. Word to PDF ────────────────────────────────────────
export function WordToPdfTool() {
  return (
    <PdfToolShell
      title="Word to PDF"
      description="Convert a .docx file to PDF. Fonts, layout, and images preserved."
      pillLabel="Adobe"
      pillIcon={<FileType className="h-3.5 w-3.5 text-brand-600" />}
      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      runButtonLabel="Convert"
      relatedTools={RELATED}
      infoBanner={BANNER}
      onRun={async (files) => {
        const r = await wordToPdf(files[0]);
        return {
          blob: r.blob,
          filename: r.filename,
          sizeBytes: r.sizeBytes,
          extras: { Format: `${r.sourceFormat} → ${r.targetFormat}`, "Render time": `${(r.elapsedMs / 1000).toFixed(1)}s` },
        };
      }}
    />
  );
}

// ─── 2. PowerPoint to PDF ──────────────────────────────────
export function PowerpointToPdfTool() {
  return (
    <PdfToolShell
      title="PowerPoint to PDF"
      description="Convert a .pptx file to PDF. Slides, notes, and images preserved."
      pillLabel="Adobe"
      pillIcon={<Presentation className="h-3.5 w-3.5 text-brand-600" />}
      accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      runButtonLabel="Convert"
      relatedTools={RELATED}
      infoBanner={BANNER}
      onRun={async (files) => {
        const r = await powerpointToPdf(files[0]);
        return {
          blob: r.blob,
          filename: r.filename,
          sizeBytes: r.sizeBytes,
          extras: { Format: `${r.sourceFormat} → ${r.targetFormat}`, "Render time": `${(r.elapsedMs / 1000).toFixed(1)}s` },
        };
      }}
    />
  );
}

// ─── 3. Excel to PDF ───────────────────────────────────────
export function ExcelToPdfTool() {
  return (
    <PdfToolShell
      title="Excel to PDF"
      description="Convert a .xlsx file to PDF. Sheets, formulas, and formatting preserved."
      pillLabel="Adobe"
      pillIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-brand-600" />}
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      runButtonLabel="Convert"
      relatedTools={RELATED}
      infoBanner={BANNER}
      onRun={async (files) => {
        const r = await excelToPdf(files[0]);
        return {
          blob: r.blob,
          filename: r.filename,
          sizeBytes: r.sizeBytes,
          extras: { Format: `${r.sourceFormat} → ${r.targetFormat}`, "Render time": `${(r.elapsedMs / 1000).toFixed(1)}s` },
        };
      }}
    />
  );
}

// ─── 4. PDF to PowerPoint ──────────────────────────────────
export function PdfToPowerpointTool() {
  return (
    <PdfToolShell
      title="PDF to PowerPoint"
      description="Convert a PDF to .pptx. Slide-by-slide layout via Adobe PDF Services."
      pillLabel="Adobe"
      pillIcon={<Presentation2 className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Convert"
      relatedTools={RELATED}
      infoBanner={BANNER}
      onRun={async (files) => {
        const r = await pdfToPowerpoint(files[0]);
        return {
          blob: r.blob,
          filename: r.filename,
          sizeBytes: r.sizeBytes,
          extras: { Format: `${r.sourceFormat} → ${r.targetFormat}`, "Render time": `${(r.elapsedMs / 1000).toFixed(1)}s` },
        };
      }}
    />
  );
}

// ─── 5. PDF to Excel ───────────────────────────────────────
export function PdfToExcelTool() {
  return (
    <PdfToolShell
      title="PDF to Excel"
      description="Convert a PDF to .xlsx. Tables extracted cell-by-cell via Adobe PDF Services."
      pillLabel="Adobe"
      pillIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-brand-600" />}
      runButtonLabel="Convert"
      relatedTools={RELATED}
      infoBanner={BANNER}
      onRun={async (files) => {
        const r = await pdfToExcel(files[0]);
        return {
          blob: r.blob,
          filename: r.filename,
          sizeBytes: r.sizeBytes,
          extras: { Format: `${r.sourceFormat} → ${r.targetFormat}`, "Render time": `${(r.elapsedMs / 1000).toFixed(1)}s` },
        };
      }}
    />
  );
}
