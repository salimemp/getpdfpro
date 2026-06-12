import type { Metadata } from "next";
import Link from "next/link";
import {
  Combine,
  Scissors,
  Minimize2,
  FileImage,
  FileText,
  FileType,
  ScanText,
  Wrench,
  PenTool,
  ArrowRight,
  RotateCw,
  Crop,
  FileMinus,
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
  Edit3,
  Sparkles,
  Languages,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "All PDF tools",
  description:
    "26 PDF tools: merge, split, compress, convert, OCR, rotate, crop, repair, sign, redact, AI summarize, AI translate, and more — all private.",
  alternates: { canonical: "/tools" },
};

const tools = [
  {
    name: "Merge PDF",
    description: "Combine PDFs in the order you want. Drag, drop, done.",
    icon: Combine,
    href: "/tools/merge",
    ready: true,
  },
  {
    name: "Split PDF",
    description: "Extract pages or split by custom ranges. ZIP of one-PDF-per-page.",
    icon: Scissors,
    href: "/tools/split",
    ready: true,
  },
  {
    name: "Compress PDF",
    description: "Shrink files up to 70% with smart quality preservation.",
    icon: Minimize2,
    href: "/tools/compress",
    ready: true,
  },
  {
    name: "PDF to Image",
    description: "Convert each page to PNG or JPEG, bundled as a ZIP.",
    icon: FileImage,
    href: "/tools/pdf-to-image",
    ready: true,
  },
  {
    name: "Image to PDF",
    description: "Turn photos and scans into clean, searchable PDFs.",
    icon: FileText,
    href: "/tools/image-to-pdf",
    ready: true,
  },
  {
    name: "OCR PDF",
    description:
      "Make scanned PDFs searchable. Adds an invisible text layer or extracts plain text.",
    icon: ScanText,
    href: "/tools/ocr",
    ready: true,
  },
  {
    name: "PDF to Word",
    description:
      "Convert PDF to .docx. Best-effort text, headings, and basic tables.",
    icon: FileType,
    href: "/tools/pdf-to-word",
    ready: true,
  },
  {
    name: "Repair PDF",
    description:
      "Fix a broken, scanned, locked, or slow-loading PDF. Repairs, OCRs, unlocks, linearizes.",
    icon: Wrench,
    href: "/tools/repair",
    ready: true,
  },
  {
    name: "Rotate PDF",
    description: "Rotate pages by 90°, 180°, or 270° — all or specific pages.",
    icon: RotateCw,
    href: "/tools/rotate",
    ready: true,
  },
  {
    name: "Crop PDF",
    description: "Shrink the visible area of pages. Values in PDF points.",
    icon: Crop,
    href: "/tools/crop",
    ready: true,
  },
  {
    name: "Extract Pages",
    description: "Pull specific pages from a PDF into a new PDF.",
    icon: FileMinus,
    href: "/tools/extract-pages",
    ready: true,
  },
  {
    name: "Add / Remove Pages",
    description: "Delete specific pages, or keep only what you need.",
    icon: Scissors,
    href: "/tools/add-remove-pages",
    ready: true,
  },
  {
    name: "Organize PDF",
    description: "Reorder and/or duplicate pages in any order.",
    icon: ArrowUpDown,
    href: "/tools/organize",
    ready: true,
  },
  {
    name: "Add Page Numbers",
    description: "Stamp 'Page N of M' on every page. 6 positions, 3 formats.",
    icon: Hash,
    href: "/tools/page-numbers",
    ready: true,
  },
  {
    name: "Scan to PDF",
    description: "Phone-scanned images to a single searchable PDF. OCR included.",
    icon: ScanLine,
    href: "/tools/scan-to-pdf",
    ready: true,
  },
  {
    name: "HTML to PDF",
    description: "Convert HTML markup or a URL to a PDF.",
    icon: Globe,
    href: "/tools/html-to-pdf",
    ready: true,
  },
  {
    name: "PDF to PDF/A",
    description: "Archival format with embedded fonts and sRGB color.",
    icon: FileCheck,
    href: "/tools/pdf-to-pdfa",
    ready: true,
  },
  {
    name: "Redact PDF",
    description: "Remove text patterns. Adobe = genuine. Self-hosted = blackout.",
    icon: EyeOff,
    href: "/tools/redact",
    ready: true,
  },
  {
    name: "Compare PDF",
    description: "Diff two PDFs. Adobe = visual. Self-hosted = text-only.",
    icon: GitCompareArrows,
    href: "/tools/compare",
    ready: true,
  },
  {
    name: "Extract Form Fields",
    description: "Pull all form field data from a PDF as JSON.",
    icon: ListChecks,
    href: "/tools/forms-extract",
    ready: true,
  },
  {
    name: "Unlock PDF",
    description: "Remove the user/owner password from an encrypted PDF.",
    icon: Unlock,
    href: "/tools/unlock",
    ready: true,
  },
  {
    name: "Protect PDF",
    description: "Encrypt with AES-256 and a user/owner password.",
    icon: Lock,
    href: "/tools/protect",
    ready: true,
  },
  {
    name: "Sign PDF",
    description: "Visual signature stamp. NOT a PKI signature.",
    icon: PenTool,
    href: "/tools/sign",
    ready: true,
  },
  {
    name: "Edit PDF",
    description: "Edit metadata, cover a region, stamp a text label.",
    icon: Edit3,
    href: "/tools/edit-pdf",
    ready: true,
  },
  {
    name: "AI Summarize",
    description: "Get a concise summary of a PDF using Gemini. Inline results.",
    icon: Sparkles,
    href: "/tools/summarize",
    ready: true,
  },
  {
    name: "AI Translate",
    description: "Translate a PDF into 12+ languages. PDF or text output.",
    icon: Languages,
    href: "/tools/translate",
    ready: true,
  },
];

export default function ToolsIndexPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="container-narrow py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            All PDF tools
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            One tool at a time. Each one runs in your browser and is free
            forever for the basics.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.name}
                href={tool.href}
                className="group relative rounded-xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-700"
              >
                {!tool.ready && (
                  <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Coming soon
                  </span>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <tool.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{tool.name}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {tool.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2">
                  {tool.ready ? "Open tool" : "Notify me"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
