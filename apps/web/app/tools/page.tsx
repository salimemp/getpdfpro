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
  Stamp, // watermark
  Presentation, // PowerPoint (lucide-react uses 'Presentation' not 'PresentationChart')
  FileSpreadsheet, // Excel
  TableProperties, // extract tables
  Volume2, // read aloud (TTS)
  Mic, // dictate (STT)
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "All PDF tools",
  description:
    "39 PDF tools organized by what you want to do: organize, optimize, convert to/from PDF, edit, secure, AI-powered, and accessibility. All private, all in your browser.",
  alternates: { canonical: "/tools" },
};

type Tool = {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  ready: boolean;
};

type Category = {
  id: string;
  title: string;
  description: string;
  tools: Tool[];
};

// Categories mirror the iLovePDF-style organization. Each
// category has an id (used as a stable anchor link), a title
// shown in section headings, and a short description that
// previews what the tools do.
const CATEGORIES: Category[] = [
  {
    id: "organize",
    title: "Organize PDF",
    description:
      "Rearrange, split, and combine pages. Build the PDF you want from the PDFs you have.",
    tools: [
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
        name: "Add / Remove Pages",
        description: "Delete specific pages, or keep only the pages you want.",
        icon: FileMinus,
        href: "/tools/add-remove-pages",
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
        name: "Organize PDF",
        description: "Reorder and/or duplicate pages in any order.",
        icon: ArrowUpDown,
        href: "/tools/organize",
        ready: true,
      },
      {
        name: "Scan to PDF",
        description: "Phone-scanned images to a single searchable PDF. OCR included.",
        icon: ScanLine,
        href: "/tools/scan-to-pdf",
        ready: true,
      },
    ],
  },
  {
    id: "optimize",
    title: "Optimize PDF",
    description:
      "Shrink file size, fix corruption, and make scanned PDFs searchable. Smaller, faster, more useful.",
    tools: [
      {
        name: "Compress PDF",
        description: "Shrink files up to 70% with smart quality preservation.",
        icon: Minimize2,
        href: "/tools/compress",
        ready: true,
      },
      {
        name: "Repair PDF",
        description: "Fix broken, scanned, locked, or slow-loading PDFs in one pass.",
        icon: Wrench,
        href: "/tools/repair",
        ready: true,
      },
      {
        name: "OCR PDF",
        description: "Make scanned PDFs searchable. Adds an invisible text layer.",
        icon: ScanText,
        href: "/tools/ocr",
        ready: true,
      },
    ],
  },
  {
    id: "convert-to",
    title: "Convert to PDF",
    description:
      "Turn Office documents, images, and HTML into clean PDFs. Office conversions use Adobe PDF Services for high fidelity.",
    tools: [
      {
        name: "Image to PDF",
        description: "Turn photos and scans into clean, searchable PDFs. JPG, PNG, WebP, TIFF.",
        icon: FileText,
        href: "/tools/image-to-pdf",
        ready: true,
      },
      {
        name: "HTML to PDF",
        description: "Convert HTML markup or a public URL to a PDF.",
        icon: Globe,
        href: "/tools/html-to-pdf",
        ready: true,
      },
      {
        name: "Word to PDF",
        description: "Convert .docx to PDF with Adobe PDF Services. Fonts, layout preserved.",
        icon: FileType,
        href: "/tools/word-to-pdf",
        ready: true,
      },
      {
        name: "PowerPoint to PDF",
        description: "Convert .pptx to PDF. Slides and notes preserved.",
        icon: Presentation,
        href: "/tools/powerpoint-to-pdf",
        ready: true,
      },
      {
        name: "Excel to PDF",
        description: "Convert .xlsx to PDF. Sheets, formulas, and formatting preserved.",
        icon: FileSpreadsheet,
        href: "/tools/excel-to-pdf",
        ready: true,
      },
    ],
  },
  {
    id: "convert-from",
    title: "Convert from PDF",
    description:
      "Turn PDFs into Office documents, images, and archival formats. Adobe PDF Services handles Office conversions for high fidelity.",
    tools: [
      {
        name: "PDF to Image",
        description: "Convert each page to PNG or JPEG, bundled as a ZIP.",
        icon: FileImage,
        href: "/tools/pdf-to-image",
        ready: true,
      },
      {
        name: "PDF to Word",
        description: "Convert PDF to .docx. Best-effort text, headings, basic tables.",
        icon: FileType,
        href: "/tools/pdf-to-word",
        ready: true,
      },
      {
        name: "PDF to PowerPoint",
        description: "Convert PDF to .pptx. Slide-by-slide layout.",
        icon: Presentation,
        href: "/tools/pdf-to-powerpoint",
        ready: true,
      },
      {
        name: "PDF to Excel",
        description: "Convert PDF tables to .xlsx. Best-effort cell-level extraction.",
        icon: FileSpreadsheet,
        href: "/tools/pdf-to-excel",
        ready: true,
      },
      {
        name: "PDF/A Convert",
        description: "Export a PDF as PDF/A-2b for long-term archival.",
        icon: FileCheck,
        href: "/tools/pdf-to-pdfa",
        ready: true,
      },
      {
        name: "Extract Tables",
        description:
          "Pull every table out of a PDF as CSV or JSON. Self-hosted, no upload needed.",
        icon: TableProperties,
        href: "/tools/extract-tables",
        ready: true,
      },
    ],
  },
  {
    id: "edit",
    title: "Edit PDF",
    description:
      "Make changes to existing PDFs without re-typing anything. Rotate, watermark, crop, annotate.",
    tools: [
      {
        name: "Rotate PDF",
        description: "Rotate pages by 90°, 180°, or 270° — all or specific pages.",
        icon: RotateCw,
        href: "/tools/rotate",
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
        name: "Add Watermark",
        description: "Stamp a text or image watermark on every page. DRAFT, CONFIDENTIAL, logo.",
        icon: Stamp,
        href: "/tools/watermark",
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
        name: "Edit PDF",
        description: "Edit metadata, cover a region, stamp a text label.",
        icon: Edit3,
        href: "/tools/edit-pdf",
        ready: true,
      },
      {
        name: "Form Fields",
        description: "Extract all form field data from a PDF as JSON.",
        icon: ListChecks,
        href: "/tools/forms-extract",
        ready: true,
      },
    ],
  },
  {
    id: "security",
    title: "PDF Security",
    description:
      "Lock down, unlock, sign, and compare PDFs. Real encryption, real signatures, real redaction.",
    tools: [
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
        description: "Visual signature stamp. NOT PKI.",
        icon: PenTool,
        href: "/tools/sign",
        ready: true,
      },
      {
        name: "Redact PDF",
        description: "Remove text patterns. Genuine or visual blackout.",
        icon: EyeOff,
        href: "/tools/redact",
        ready: true,
      },
      {
        name: "Compare PDF",
        description: "Diff two PDFs. Visual (Adobe) or text (self-hosted).",
        icon: GitCompareArrows,
        href: "/tools/compare",
        ready: true,
      },
    ],
  },
  {
    id: "intelligence",
    title: "PDF Intelligence",
    description:
      "AI-powered features. Summarize long documents, translate into 12+ languages. Powered by Gemini.",
    tools: [
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
    ],
  },
  {
    id: "accessibility",
    title: "Accessibility",
    description:
      "Text-to-speech, speech-to-text, and other features that make PDFs usable for everyone. Pure Web Speech API — your audio never leaves your device.",
    tools: [
      {
        name: "Read Aloud",
        description:
          "Paste any text and have it spoken aloud by your browser. 20+ languages, voice + speed + pitch control.",
        icon: Volume2,
        href: "/tools/read-aloud",
        ready: true,
      },
      {
        name: "Dictate",
        description:
          "Speech-to-text. Tap, speak, see your words. 24+ languages, continuous mode, copy or download.",
        icon: Mic,
        href: "/tools/dictate",
        ready: true,
      },
    ],
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
            39 PDF tools. One at a time. Each runs in your browser and is
            free forever for the basics. Use the categories below to find
            what you need.
          </p>

          {/* Category nav — quick anchor links so users can jump
              straight to the group they want. On mobile this
              wraps; on desktop it's a single line. */}
          <nav
            aria-label="Tool categories"
            className="mt-6 flex flex-wrap gap-2 text-sm"
          >
            {CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {cat.title}
              </a>
            ))}
          </nav>

          {/* Category sections — one per group */}
          <div className="mt-10 space-y-14">
            {CATEGORIES.map((cat) => (
              <section key={cat.id} id={cat.id} className="scroll-mt-20">
                <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {cat.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {cat.description}
                  </p>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.tools.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="group relative rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-700"
                    >
                      {!tool.ready && (
                        <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Coming soon
                        </span>
                      )}
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                        <tool.icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3 font-semibold">{tool.name}</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {tool.description}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 dark:text-brand-400">
                        Open tool
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
