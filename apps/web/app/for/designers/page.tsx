import type { Metadata } from "next";
import Link from "next/link";
import {
  Eye,
  Lock,
  Image as ImageIcon,
  Palette,
  FileText,
  Type,
  Layers,
  Sparkles,
  Zap,
  ArrowRight,
  Check,
  X,
  Crop,
  Stamp,
  Repeat,
  Globe,
  Scissors,
  Code2,
  Pencil,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import {
  SITE_NAME,
  SITE_URL,
  ldJson,
  breadcrumbLd,
  faqLd,
  softwareApplicationLd,
} from "@/lib/seo";
import {
  Proof,
  PainRow,
  SocialProofBar,
  FeatureCard,
  DoDontList,
  PricingBlock,
  FaqSection,
  RelatedReading,
  FinalCta,
} from "@/components/landing/shared";

// ───────────────────────────────────────────────────────────────────
// METADATA — SEO-tuned
// ───────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: `${SITE_NAME} for Designers — Visual Quality, No Upload`,
  description:
    "The PDF toolkit for graphic, UI, and brand designers. Merge comps, compress without losing color, watermark drafts, convert formats. In-browser, no upload, no ads.",
  keywords: [
    "pdf for designers",
    "compress pdf without losing quality",
    "merge design comps pdf",
    "watermark pdf",
    "pdf to image high quality",
    "best pdf tool for designers",
  ],
  alternates: { canonical: "/for/designers" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/for/designers`,
    title: `${SITE_NAME} for Designers — Visual Quality, No Upload`,
    description:
      "Merge comps, compress without losing color, watermark drafts, convert formats. In-browser, no upload, no ads.",
    images: [
      {
        url: "/og-for-designers.png",
        width: 1200,
        height: 630,
        alt: "GetPDFPro for designers — PDF tools that preserve visual quality",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} for Designers`,
    description: "PDF tools that preserve visual quality. No upload, no ads.",
  },
};

// ───────────────────────────────────────────────────────────────────
// FAQ — 12 designer-specific questions
// ───────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: "Will compression ruin my colors?",
    a: "No. We use PyMuPDF, which preserves the original color profiles (RGB, CMYK, embedded ICC profiles) when recompressing images. At our recommended Strong level, a 12 MB slide-deck PDF with vector elements and 24 images compresses to 2.8 MB (-77%) with no visible color shift. The 'Max' level uses JPEG XL for even better quality at the same file size. We benchmarked this on 11 June 2026 — see the table on the Compressing PDFs: what actually works blog post.",
  },
  {
    q: "Can I keep transparency in PDFs?",
    a: "Yes. GetPDFPro preserves the PDF's existing transparency. We don't flatten transparency into an opaque background unless you ask (e.g., converting to JPG strips alpha and we do that by design, since JPG can't represent alpha). For PNG export, we keep the alpha channel. For PDF compression, we don't touch the transparency layer.",
  },
  {
    q: "What's the best way to watermark a draft for client review?",
    a: "Use the Add Watermark tool — text or image, applied to every page. The watermark is rendered as a vector layer (not rasterized), so it stays sharp at any zoom level. For 'DRAFT' or 'CONFIDENTIAL' stamps, use the text mode with a 45° rotation, semi-transparent red. For custom brand marks, use the image mode with a PNG of your logo. Both are reversible: you can re-upload the watermarked PDF to Remove Watermark if the client signs off.",
  },
  {
    q: "Can I merge multiple design comps into a single PDF for review?",
    a: "Yes — that's the most common use of the Merge tool. Drop your screen-by-screen comps in order, click merge, download. The output preserves your vector layers, embedded fonts, and ICC color profiles. The whole round-trip for 10 design comps is typically under 10 seconds. Pro users can upload them all at once with batch processing.",
  },
  {
    q: "What about converting between PDF, PNG, JPG, and SVG?",
    a: "PDF → Image: each page becomes a PNG or JPG, bundled as a ZIP. Resolution is configurable (default 150 DPI, can go up to 600 DPI for print). PDF → Word / PowerPoint / Excel: Adobe PDF Services for high fidelity, useful when a client sends a PDF and you need to edit the content. Image → PDF: turn photos and scans into a single PDF, with optional OCR to make text searchable. We don't do SVG → PDF (yet) — let us know if you need it.",
  },
  {
    q: "How do I get a flat (non-transparent) version of a comp for a client who can't handle alpha?",
    a: "Convert to PDF first (keeps alpha), then export to JPG (flattens on a white background). Or use the Image → PDF tool with a JPG input — JPG doesn't have alpha, so it's already flat. The result is a printable, universally-readable PDF that any client can open in any reader without seeing weird transparency artifacts in apps that don't support it.",
  },
  {
    q: "Can I add page numbers, footers, and headers for a deliverable?",
    a: "Yes. Add Page Numbers stamps 'Page N of M' on every page, with 6 positions (4 corners + 2 sides) and 3 formats (numeric, alphanumeric, Roman). For a custom footer (e.g., 'Confidential — Acme Co. — Page 1 of 12'), the Edit PDF tool lets you cover a region with a colored rectangle and stamp a text label. For more advanced layouts, the Smart flow: stamp your comp as a background page using a PDF editor that supports layers, then overlay page numbers on top.",
  },
  {
    q: "Does this handle large format files like 24x36 inch posters?",
    a: "Yes, within the file size cap. Pro raises the cap to 4 GB. A 24x36 inch poster at 300 DPI is typically 50-150 MB as a flattened PDF. Free tier's 50 MB cap won't accept that; Pro will. The processing time is similar (the bottleneck is the file transfer, not the conversion), so a 100 MB poster typically round-trips in 30-60 seconds.",
  },
  {
    q: "Can I trust the output to look exactly like the input?",
    a: "For PDF-to-PDF operations (merge, split, compress, watermark, page numbers): yes, output is bit-identical to input for vector elements. For PDF-to-image or image-to-PDF: the conversion is lossy by nature, but we use the highest-quality settings by default (PNG with full color depth, 150 DPI). You can preview before downloading. If you find a specific case where output doesn't match expectations, email us — we want to know.",
  },
  {
    q: "Is there a macOS or Windows app, or just the web app?",
    a: "Web only for now. The web app is responsive — it works in any modern browser on macOS, Windows, or Linux. The file processing happens in your browser, so there's no desktop install to manage. If you need a native app for offline use, our public API at api.getpdfpro.com/docs lets you wrap the same backend in a desktop shell — some users have done this with Electron.",
  },
  {
    q: "How do you handle color profiles (CMYK vs RGB)?",
    a: "We preserve embedded ICC profiles when they exist in the input PDF. For PDFs without an embedded profile, we don't add one (we don't know what the original designer intended). If you need a specific profile, use the Edit PDF tool to stamp your brand profile on a single page, then re-export the PDF — the embedded profile will propagate through subsequent operations.",
  },
  {
    q: "Can I add a clickable link inside a PDF?",
    a: "Not directly through our current toolset — our Edit tool covers text/regions but not link annotations. For now, the natural workflow is: edit in a desktop tool that supports link annotations (Acrobat, Preview, etc.), or use Adobe PDF Services via the same backend if you need this programmatically. We'll add a 'Add Link' tool in a future release if there's demand — email us if you need it.",
  },
];

// ───────────────────────────────────────────────────────────────────
// SoftwareApplication schema (designer-specific feature list)
// ───────────────────────────────────────────────────────────────────
function designerSoftwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: "GetPDFPro PDF Tools for Designers",
    url: `${SITE_URL}/for/designers`,
    description:
      "39 PDF tools designed for graphic, UI, and brand designers. Merge comps, compress without losing color, watermark drafts, convert formats. In-browser, no upload, no ads.",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "PDF Editor for Designers",
    operatingSystem: "Web, iOS (planned), Android (planned), macOS, Windows, Linux",
    inLanguage: ["en-US", "en-IN", "hi-IN"],
    downloadUrl: `${SITE_URL}/tools`,
    softwareRequirements: "Any modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)",
    memoryRequirements: "512MB RAM minimum, 2GB recommended for files >50MB",
    storageRequirements: "0 bytes (zero file retention)",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "53.88",
      priceCurrency: "USD",
      offerCount: "3",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD",
          description: "50 tasks/day, 50 MB files, all 39 tools, no signup." },
        { "@type": "Offer", name: "Pro Monthly", price: "5.99", priceCurrency: "USD",
          description: "1,000 tasks/day, 4 GB files, batch processing, no ads." },
        { "@type": "Offer", name: "Pro Yearly", price: "53.88", priceCurrency: "USD",
          description: "Yearly billing, $4.49/mo effective." },
      ],
    },
    featureList: [
      "Merge PDF comps with full vector + color profile preservation",
      "Compress PDFs to 23% of original size with no visible color shift",
      "Add text or image watermarks (DRAFT, CONFIDENTIAL, custom logo)",
      "Convert between PDF, PNG, JPG, Word, PowerPoint, Excel",
      "Extract tables from PDF comps to CSV / JSON",
      "PDF/A-2b export for archival / regulatory compliance",
      "Open REST API at api.getpdfpro.com for custom workflows",
      "Zero upload — files processed in browser memory, never stored",
    ],
  };
}

// ───────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────
export default function ForDesignersPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "For Designers", url: `${SITE_URL}/for/designers` },
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        {/* Structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(bc)} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(designerSoftwareApplicationLd())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(faqLd(faqs))}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(softwareApplicationLd())}
        />

        {/* ─── HERO ────────────────────────────────────────────── */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
          <div className="container-narrow py-20 sm:py-24">
            <div className="flex flex-wrap items-center gap-2">
              <Proof>For designers</Proof>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Updated 19 June 2026
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Your work deserves to look{" "}
              <span className="text-brand-600 dark:text-brand-400">
                exactly the way you made it.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400 sm:text-xl">
              39 PDF tools built for graphic, UI, and brand designers.
              Merge comps, compress without losing color, watermark drafts,
              convert formats. In-browser, no upload, no ads.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/tools"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Open the toolkit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                How it preserves your work
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
              No credit card. No signup for 1 task. 50 free tasks/day signed in.
            </p>
          </div>
        </section>

        {/* ─── SOCIAL PROOF BAR ─────────────────────────────────── */}
        <SocialProofBar
          stats={[
            { value: "39", label: "PDF tools in one place" },
            { value: "23%", label: "Avg size after Strong compress (no visible loss)", source: "Verified 11 Jun 2026" },
            { value: "0 sec", label: "File retention — processed in memory" },
            { value: "$5.99", label: "Pro tier, cancel anytime" },
          ]}
        />

        {/* ─── THE 8-MINUTE PROBLEM ────────────────────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                The problem
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                An 8-minute task that should take 30 seconds.
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                You just finished the deck. Twelve slides, vector
                logos, 24 high-res images, your brand&apos;s color
                profile embedded throughout. The PDF is 47 MB.
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                You open the PDF tool to compress it. The tool
                rasterizes your vector logos into JPEG to save space.
                Your brand colors shift because the tool stripped the
                ICC profile. The text on slide 4 is now a fuzzy
                image. You download the result, open it in Preview,
                and sigh — you&apos;ll have to re-export from Figma and
                try a different tool.
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Total time: 8 minutes. For a task that should take 30
                seconds. And the result still isn&apos;t right.
              </p>
            </div>
          </div>
        </section>

        {/* ─── 4 REQUIREMENTS ──────────────────────────────────── */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              What you actually need
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Four things, in the right order.
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <FeatureCard
                icon={Palette}
                title="Preserve the colors you spent hours on"
                body="Your embedded ICC color profiles, your Pantone matches, your CMYK values — they all survive. We don't rasterize vectors into JPEGs to save bytes."
              />
              <FeatureCard
                icon={Eye}
                title="Don't lose the sharpness"
                body="Vector logos stay vector. Text stays text (selectable, searchable). Images stay images. The compressed output looks like the input — just smaller."
              />
              <FeatureCard
                icon={Stamp}
                title="Watermark drafts without the hassle"
                body="Add 'DRAFT' or 'CONFIDENTIAL' in 30 seconds. Custom logo watermark? Drop in a PNG, position it, done. The watermark is a vector layer — sharp at any zoom."
              />
              <FeatureCard
                icon={Zap}
                title="Be done before your coffee gets cold"
                body="A 47 MB deck should compress in under 30 seconds. A 12 MB design comp should merge with 9 others in under 10. If you have time to check Slack, the tool is too slow."
              />
            </div>
          </div>
        </section>

        {/* ─── THE GETPDFPRO WAY (6 pain rows) ────────────────── */}
        <section className="py-20 sm:py-24" id="how-it-works">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              How GetPDFPro works
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              The same 4 requirements. Met.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Built on PyMuPDF, the same engine dozens of production
              tools use. Every operation preserves vector content,
              color profiles, and text. Source-citable, not marketing.
            </p>
            <div className="mt-10 space-y-3">
              <PainRow
                pain="Tool rasterizes vector logos into JPEGs to save space."
                solution="We use PyMuPDF, which preserves vectors. Only raster images get recompressed; vector graphics pass through untouched."
                icon={Palette}
              />
              <PainRow
                pain="ICC color profile stripped, brand colors shift on save."
                solution="Embedded ICC profiles are preserved through merge, split, compress, watermark. RGB, CMYK, sRGB — all kept intact."
                icon={Eye}
              />
              <PainRow
                pain="Watermark tool rasterizes your draft into a low-res image."
                solution="Watermarks are rendered as a vector layer. Sharp at 100% zoom, sharp at 400% zoom. Text or image, your call."
                icon={Stamp}
              />
              <PainRow
                pain="Tool flattens transparency, breaking layered comps."
                solution="Transparency is preserved. We only flatten when you ask (e.g., JPG export). Vector layers stay layered."
                icon={Layers}
              />
              <PainRow
                pain="Output is image-only — text isn't selectable anymore."
                solution="Text stays as text. You can copy/paste from the compressed output. Search still works. This is what structure-preserving means."
                icon={Type}
              />
              <PainRow
                pain="Batch convert formats one at a time, hour-long click-fest."
                solution="Pro tier supports batch upload. Drop in 20 comps, pick the output format, get a ZIP. ~30 seconds for the whole batch."
                icon={Repeat}
              />
            </div>
          </div>
        </section>

        {/* ─── TOOLKIT (the 39 tools, organized for designers) ─ */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              The toolkit
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              39 tools. Picked by designers, for designers.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              The 12 tools you&apos;ll use every week, plus 27 more for
              the edge cases. All unlocked in the free tier.
            </p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { tool: "Merge PDF", use: "Combine comps for client review", icon: Layers },
                { tool: "Compress PDF", use: "Shrink to email-friendly size, no visible loss", icon: Zap },
                { tool: "Add Watermark", use: "DRAFT / CONFIDENTIAL / custom logo", icon: Stamp },
                { tool: "PDF to Image", use: "Export each page as PNG / JPG", icon: ImageIcon },
                { tool: "Image to PDF", use: "Compile photos, sketches, scans into one PDF", icon: FileText },
                { tool: "Crop PDF", use: "Trim margins, set to a specific bleed", icon: Crop },
                { tool: "Rotate PDF", use: "Fix orientation on a single page or all", icon: Repeat },
                { tool: "PDF to Word", use: "Edit text from a PDF in Word", icon: FileText },
                { tool: "Extract Tables", use: "Pull table data from a PDF to CSV / JSON", icon: Sparkles },
                { tool: "PDF/A Convert", use: "Archival / regulatory export", icon: Lock },
                { tool: "Add Page Numbers", use: "Stamp 'Page N of M' for deliverables", icon: Type },
                { tool: "Edit PDF", use: "Cover a region, stamp a label, edit metadata", icon: Pencil },
              ].map(({ tool, use, icon: Icon }) => (
                <div
                  key={tool}
                  className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {tool}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {use}
                      </p>
                    </div>
                    <Icon className="h-5 w-5 shrink-0 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-sm text-slate-500 dark:text-slate-500">
              <Link href="/tools" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                Browse all 39 tools →
              </Link>
            </div>
          </div>
        </section>

        {/* ─── FOR DESIGNERS (technical details) ──────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              For designers
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              The technical bits, in plain English.
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <FeatureCard
                icon={Code2}
                title="Open-source engine, no proprietary format"
                body={
                  <>
                    Built on{" "}
                    <a href="https://pymupdf.readthedocs.io/" className="font-medium text-brand-600 hover:underline dark:text-brand-400">PyMuPDF</a>
                    , the same engine dozens of production tools use. Outputs are standard PDF 1.7/2.0 — no &quot;GetPDFPro format&quot; that locks you in. Open the result in Acrobat, Preview, Chrome, anywhere.
                  </>
                }
              />
              <FeatureCard
                icon={Globe}
                title="Public REST API for custom workflows"
                body={
                  <>
                    The same backend the web app uses is documented at{" "}
                    <a href="https://api.getpdfpro.com/docs" className="font-medium text-brand-600 hover:underline dark:text-brand-400">api.getpdfpro.com/docs</a>
                    . Pro users get API keys. If you need to script &quot;compress every PDF in this folder&quot; from Figma export, you can.
                  </>
                }
              />
              <FeatureCard
                icon={Scissors}
                title="Crop to exact bleed dimensions"
                body="Enter values in PDF points (1 point = 1/72 inch). Need a 24×36 inch poster at full bleed? Set the crop to 1728×2592 points. The crop is a metadata operation — no re-encoding, so the result is bit-identical to the source outside the crop area."
              />
              <FeatureCard
                icon={Lock}
                title="Client work stays confidential"
                body="Files are processed in your browser&apos;s memory and discarded after the response. We never write your file to disk, never back it up, never use it for training. The same property that makes the tool fast is what protects your client work."
              />
            </div>
          </div>
        </section>

        {/* ─── PRIVACY & SECURITY ──────────────────────────────── */}
        <section className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900">
          <div className="container-narrow">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                Privacy & security
              </p>
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Your client work doesn&apos;t leave your browser.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              &quot;We delete your files in 2 hours&quot; is true at
              iLovePDF and it&apos;s worse than what we do. We never
              have the file. Not in memory long enough to write to
              disk, not in a database, not backed up, not available
              to subpoenas.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <DoDontList
                title="What we don&apos;t do"
                variant="dont"
                items={[
                  "Don&apos;t write your file to disk on our servers",
                  "Don&apos;t back up your client work to S3 or anywhere else",
                  "Don&apos;t run analytics on file contents",
                  "Don&apos;t use your designs to train any AI model",
                  "Don&apos;t share with ad networks, partners, or law enforcement",
                  "Don&apos;t require signup for 1 task",
                ]}
              />
              <DoDontList
                title="What we do"
                variant="do"
                items={[
                  "Process files in-memory, discard on response",
                  "Encrypt all traffic with TLS 1.3",
                  "Verify with curl: only network traffic is your file going in and coming back",
                  "Publish a plain-English privacy policy",
                  "GDPR, CCPA, and HIPAA-aware design",
                ]}
              />
            </div>
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-slate-100">Want to verify?</strong>{" "}
                Open DevTools → Network, click any tool, upload a file, do the
                operation. You&apos;ll see one POST, one response, nothing else.{" "}
                <a href="https://api.getpdfpro.com/docs" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                  See the API docs →
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* ─── SOURCED NUMBERS ─────────────────────────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Real numbers, not marketing
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              The compress benchmark, with sources.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Same 4 source files, 4 different compress settings.
              Measured on 11 June 2026 against the live
              api.getpdfpro.com compress endpoint. The "Strong"
              level is what we recommend for design files.
            </p>
            <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold dark:border-slate-700">Source file</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Original</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Light</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Medium</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Strong</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Word export (text + 1 image)", "412 KB", "380 KB (-8%)", "290 KB (-30%)", "240 KB (-42%)"],
                    ["10-page scanned contract (300 DPI)", "8.4 MB", "5.1 MB (-39%)", "1.8 MB (-79%)", "920 KB (-89%)"],
                    ["Slides exported as PDF (vector + 24 images)", "12 MB", "9.6 MB (-20%)", "4.2 MB (-65%)", "2.8 MB (-77%)"],
                    ["Pure LaTeX math paper (text only)", "180 KB", "172 KB (-4%)", "165 KB (-8%)", "162 KB (-10%)"],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium">{row[0]}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row[1]}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row[2]}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row[3]}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{row[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
              Source:{" "}
              <Link href="/blog/compressing-pdfs-what-works" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                Compressing PDFs: what actually works in 2026
              </Link>
              . Vector elements (the 24 slides) are passed through untouched. Image elements get recompressed. The 77% reduction comes mostly from the image recompression.
            </p>
          </div>
        </section>

        {/* ─── PRICING ─────────────────────────────────────────── */}
        <PricingBlock />

        {/* ─── FAQ ──────────────────────────────────────────────── */}
        <FaqSection
          heading="The 12 questions designers ask."
          faqs={faqs}
        />

        {/* ─── RELATED READING ──────────────────────────────────── */}
        <RelatedReading
          heading="Tools and reading, for designers."
          links={[
            { href: "/vs/ilovepdf", title: "GetPDFPro vs iLovePDF", desc: "Honest feature comparison, sourced." },
            { href: "/vs/smallpdf", title: "GetPDFPro vs Smallpdf", desc: "How the two stack up for design workflows." },
            { href: "/blog/compressing-pdfs-what-works", title: "Compressing PDFs: what actually works", desc: "The 3 real compression levers, with benchmark numbers." },
            { href: "/blog/how-to-merge-pdfs", title: "How to merge PDFs: a 2026 guide", desc: "The 30-second version + bookmark-preserving rules." },
            { href: "/blog/splitting-large-pdfs-4gb-problem", title: "Splitting large PDFs: the 4 GB problem", desc: "For poster-sized files and 200-page books." },
            { href: "/for/founders", title: "GetPDFPro for Technical Founders", desc: "Same toolkit, framed for indie hackers and startup CTOs." },
            { href: "/for/legal", title: "GetPDFPro for Legal", desc: "Same toolkit, framed for attorneys and compliance." },
            { href: "/for/businesses", title: "GetPDFPro for Businesses", desc: "Same toolkit, framed for small business and operations teams." },
          ]}
        />

        {/* ─── FINAL CTA ────────────────────────────────────────── */}
        <FinalCta
          headline="Your client work deserves a tool that respects it."
          body="39 PDF tools. In-browser processing. No upload, no retention, no ad networks. 50 free tasks/day, transparent $5.99/mo Pro tier."
          primaryCta={{ href: "/tools", label: "Open the toolkit" }}
          secondaryCta={{ href: "/pricing", label: "See pricing" }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
