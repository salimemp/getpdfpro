import Link from "next/link";
import {
  FileText,
  Combine,
  Scissors,
  Minimize2,
  FileImage,
  FileType,
  ScanText,
  Wrench,
  PenTool,
  Lock,
  Globe,
  Sparkles,
  Shield,
  Zap,
  Check,
  ArrowRight,
  RotateCw,
  Crop,
  FileMinus,
  ArrowUpDown,
  Hash,
  ScanLine,
  FileCheck,
  EyeOff,
  GitCompareArrows,
  ListChecks,
  Unlock,
  Edit3,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

const tools = [
  {
    name: "Merge PDF",
    description: "Combine PDFs in the order you want. Drag, drop, done.",
    icon: Combine,
    href: "/tools/merge",
  },
  {
    name: "Split PDF",
    description: "Extract pages or split by bookmarks, size, or ranges.",
    icon: Scissors,
    href: "/tools/split",
  },
  {
    name: "Compress PDF",
    description: "Shrink files up to 90% with smart quality preservation.",
    icon: Minimize2,
    href: "/tools/compress",
  },
  {
    name: "OCR PDF",
    description: "Make scanned PDFs searchable. Tesseract-powered.",
    icon: ScanText,
    href: "/tools/ocr",
  },
  {
    name: "PDF to Word",
    description: "Best-effort PDF to .docx. Text, headings, basic tables.",
    icon: FileType,
    href: "/tools/pdf-to-word",
  },
  {
    name: "PDF to Image",
    description: "Convert each page to PNG or JPEG, bundled as a ZIP.",
    icon: FileImage,
    href: "/tools/pdf-to-image",
  },
  {
    name: "Image to PDF",
    description: "Turn photos and scans into clean, searchable PDFs.",
    icon: FileText,
    href: "/tools/image-to-pdf",
  },
  {
    name: "Repair PDF",
    description:
      "Fix a broken, scanned, locked, or slow-loading PDF in one pass.",
    icon: Wrench,
    href: "/tools/repair",
  },
  {
    name: "Rotate PDF",
    description: "Rotate pages by 90°, 180°, or 270°.",
    icon: RotateCw,
    href: "/tools/rotate",
  },
  {
    name: "Crop PDF",
    description: "Shrink the visible area of pages. PDF-point values.",
    icon: Crop,
    href: "/tools/crop",
  },
  {
    name: "Extract Pages",
    description: "Pull specific pages into a new PDF.",
    icon: FileMinus,
    href: "/tools/extract-pages",
  },
  {
    name: "Add / Remove Pages",
    description: "Delete or keep-only. Trim a PDF before sharing.",
    icon: Scissors,
    href: "/tools/add-remove-pages",
  },
  {
    name: "Organize PDF",
    description: "Reorder and/or duplicate pages in any order.",
    icon: ArrowUpDown,
    href: "/tools/organize",
  },
  {
    name: "Add Page Numbers",
    description: "Stamp 'Page N of M' on every page.",
    icon: Hash,
    href: "/tools/page-numbers",
  },
  {
    name: "Scan to PDF",
    description: "Phone-scanned images to a single searchable PDF.",
    icon: ScanLine,
    href: "/tools/scan-to-pdf",
  },
  {
    name: "HTML to PDF",
    description: "Convert HTML markup or a URL to a PDF.",
    icon: Globe,
    href: "/tools/html-to-pdf",
  },
  {
    name: "PDF to PDF/A",
    description: "Archival format. Adobe tier or self-hosted fallback.",
    icon: FileCheck,
    href: "/tools/pdf-to-pdfa",
  },
  {
    name: "Redact PDF",
    description: "Remove text patterns. Genuine or visual blackout.",
    icon: EyeOff,
    href: "/tools/redact",
  },
  {
    name: "Compare PDF",
    description: "Diff two PDFs. Visual (Adobe) or text (self-hosted).",
    icon: GitCompareArrows,
    href: "/tools/compare",
  },
  {
    name: "Form Fields",
    description: "Extract all form field data as JSON.",
    icon: ListChecks,
    href: "/tools/forms-extract",
  },
  {
    name: "Unlock PDF",
    description: "Remove the user/owner password.",
    icon: Unlock,
    href: "/tools/unlock",
  },
  {
    name: "Protect PDF",
    description: "Encrypt with AES-256 and a password.",
    icon: Lock,
    href: "/tools/protect",
  },
  {
    name: "Sign PDF",
    description: "Visual signature stamp. NOT PKI.",
    icon: PenTool,
    href: "/tools/sign",
  },
  {
    name: "Edit PDF",
    description: "Edit metadata, cover regions, stamp labels.",
    icon: Edit3,
    href: "/tools/edit-pdf",
  },
];

const features = [
  {
    icon: Lock,
    title: "End-to-end encrypted",
    body: "Files are encrypted in your browser and decrypted only by you. We can't read them, and neither can anyone else.",
  },
  {
    icon: Globe,
    title: "25+ languages",
    body: "Read and write in your language. AI features and the interface are localized at launch.",
  },
  {
    icon: Sparkles,
    title: "AI assistant",
    body: "Summarize, translate, rewrite, and answer questions about your PDFs with Gemini under the hood.",
  },
  {
    icon: Shield,
    title: "GDPR & CCPA ready",
    body: "Built for privacy from day one. SOC 2 controls in place. Your files are auto-deleted in 1 hour.",
  },
  {
    icon: Zap,
    title: "Actually fast",
    body: "Processing starts in under a second on the fast track. No queues, no waiting, no upsells.",
  },
  {
    icon: Check,
    title: "WCAG 2.1 AA",
    body: "Keyboard navigable, screen-reader friendly, voice-controllable. Built for everyone.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="container-narrow py-20 text-center sm:py-28">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>AI-powered PDF tools, end-to-end encrypted</span>
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            The professional PDF toolkit.
            <br />
            <span className="text-brand-600">Free, fast, and private.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Merge, split, compress, convert, sign, and edit PDFs in your browser.
            Your files never leave your control — encrypted, processed, and gone
            in an hour.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tools/merge"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-brand-700"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/vs/ilovepdf"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              See how we compare
            </Link>
          </div>
        </section>

        {/* Tools grid */}
        <section className="border-t border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900">
          <div className="container-narrow">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Every PDF tool you need
              </h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                No installs, no sign-ups, no file size limits on the fast track.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <Link
                  key={tool.name}
                  href={tool.href}
                  className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-700"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                    <tool.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{tool.name}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {tool.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2">
                    Open tool
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="container-narrow">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Built for the way you actually work
              </h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                Not just another PDF site. A real toolkit.
              </p>
            </div>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900">
          <div className="container-narrow text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to leave iLovePDF behind?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
              Same tools, stronger privacy, smarter AI, and a UI that doesn&apos;t
              yell at you. Free forever for the basics.
            </p>
            <Link
              href="/tools/merge"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-brand-700"
            >
              Try it now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
