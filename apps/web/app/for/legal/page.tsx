import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Lock,
  FileText,
  Stamp,
  Eye,
  EyeOff,
  Scissors,
  FileCheck,
  Scale,
  Search,
  Zap,
  ArrowRight,
  Hash,
  Layers,
  AlertTriangle,
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
  title: `${SITE_NAME} for Legal — True Redaction, PDF/A, Confidentiality`,
  description:
    "PDF toolkit for attorneys and compliance. True redaction that destroys text, PDF/A-2b for court filings, Bates numbering, zero file retention. In-browser.",
  keywords: [
    "redact pdf properly",
    "pdfa court filing",
    "confidential pdf tool",
    "bates numbering pdf",
    "redact pdf for legal filing",
    "best pdf tool for lawyers",
  ],
  alternates: { canonical: "/for/legal" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/for/legal`,
    title: `${SITE_NAME} for Legal — True Redaction, PDF/A, Confidentiality`,
    description:
      "Redaction that actually destroys the underlying text. PDF/A-2b for court filings. Bates numbering. Zero file retention. In-browser.",
    images: [
      {
        url: "/og-for-legal.png",
        width: 1200,
        height: 630,
        alt: "GetPDFPro for legal — true redaction and PDF/A-2b for court filings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} for Legal`,
    description:
      "True redaction. PDF/A-2b. Bates numbering. Zero file retention.",
  },
};

// ───────────────────────────────────────────────────────────────────
// FAQ — 12 legal-specific questions
// ───────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: "What does “true redaction” actually mean?",
    a: "Visual redaction (a black rectangle drawn on top of text) is not redaction — the text underneath is still in the PDF content stream, copy-pasteable and recoverable. True redaction removes the underlying glyphs from the content stream entirely. GetPDFPro's Redact tool does two things in sequence: (1) applies a visual black rectangle, and (2) deletes the character data underneath it from the PDF object tree. After running Redact on a name or SSN, opening the file in a hex editor or running pdftotext shows nothing — the text is gone, not just covered. The same protection holds for redacted images: the pixels under the redaction box are overwritten with opaque black in the actual bitmap, not in an overlay layer.",
  },
  {
    q: "Is the tool approved for court filings?",
    a: "We don't apply for vendor approvals ourselves — that's between you, your bar, and the court. What we can tell you is that the PDF/A-2b output from the PDF/A Convert tool passes the veraPDF validator (the de-facto standard used by courts and government archives to test PDF/A conformance). We run our own validation against the public eIDAS test corpus — see the conformance table below. For PACER, state e-filing systems (CM/ECF, File & Serve, Odyssey, etc.), and federal court ECF, the standard is PDF/A-1b or PDF/A-2b — both are supported. The output is not encrypted, has no JS, and embeds all fonts.",
  },
  {
    q: "Where do my files actually go?",
    a: "For browser-side operations (the ones you'll use for sensitive work — Redact, Watermark, Compress, Bates Number, Page Numbers), the file is processed in your browser's memory and never sent to a server. For server-side operations (PDF/A validation, large-file compress, OCR, AI Summarize), the file is uploaded over TLS 1.3, processed in RAM, and the response is streamed back. The server does not write the file to disk, has no S3 bucket, and does not retain a copy. The same property that makes the tool fast — short-lived, in-memory processing — is what protects client confidentiality. We have a plain-English privacy policy and a one-page no-retention statement linked from the footer of every page.",
  },
  {
    q: "Can I do a privilege / redaction review?",
    a: "Yes — that's a common use of the Redact tool. The standard workflow: (1) open the source document, (2) for every privileged span, draw a redaction box (the text under the box is destroyed when you click Apply), (3) for every PII span (SSN, DOB, account number, minor's name), draw a redaction box, (4) re-export the redacted file. The original file is never modified — Redact produces a new file. We recommend keeping the original on your encrypted local drive and the redacted version in your production case folder. Some teams maintain a privilege log alongside the redacted document; the same toolset can stamp Bates numbers on the redaction log.",
  },
  {
    q: "How do I add Bates numbers to discovery productions?",
    a: "Use the Add Page Numbers tool with the “Custom prefix” option. Set the prefix (e.g., “ACME_0001”), the start number, and the position. Every page gets stamped in the order it appears. For multi-document productions, use the Merge tool to combine the PDFs in production order first, then apply Bates numbers — the stamping is sequential across the merged document. Output is search-stable: the Bates stamp is a vector text layer, so it's selectable, searchable, and recoverable in pdftotext output. Pro tier supports batch upload, which is what most production teams use for high-volume productions.",
  },
  {
    q: "Can I add a signature stamp or certification page?",
    a: "Yes. Two approaches: (1) the Add Watermark tool with an image of your signature PNG (transparent background) gives you a flat, repeatable signature that appears on every page or a selected subset. (2) the Edit PDF tool lets you cover a region (signature line, date, “/s/ Jane Doe”) and stamp a text label. For a certification page (the FRCP 26(g) signature/certification page, for example), use Merge to add a custom certification PDF as the last page of the production. The Merge tool preserves the certification page's vector text and embedded fonts, so the signature stamp is bit-identical to your template.",
  },
  {
    q: "What about converting between formats — Word to PDF, PDF to Word?",
    a: "Word to PDF: use Microsoft Word's “Save as PDF” directly for the most reliable result — that's the gold standard for fidelity. If you need to script it, the Python pipeline on our API (api.getpdfpro.com/docs) wraps LibreOffice headless and produces a clean PDF/A-2b output. PDF to Word: we use Adobe PDF Services for the conversion, which is the highest-fidelity option on the market (significantly better than open-source alternatives on tables, headers, and footnotes). Useful for editing text from a PDF in a Word-based workflow. The output is .docx with embedded fonts and an optional tagged-PDF structure for accessibility compliance.",
  },
  {
    q: "What about Bates numbering across multiple documents?",
    a: "The cleanest approach: (1) sort the documents in production order, (2) use the Merge tool to combine them into a single PDF (this preserves individual document boundaries in the page count), (3) apply the Add Page Numbers tool with the “Custom prefix” option (e.g., “PROD_0001”). The result is a single PDF with continuous Bates numbers across the production. If you need a “Bates log” (a table mapping each Bates number to the source document and page), the Extract Tables tool can pull a similar table from your existing case-management export and convert it to CSV. For high-volume productions, Pro tier's batch upload handles this in one pass.",
  },
  {
    q: "How is this different from Adobe Acrobat for redaction?",
    a: "Adobe Acrobat's Redact tool (the paid tier, not the free reader) is the gold standard for redaction — it does the same thing we do: remove text from the content stream and apply a visual rectangle. The two main differences: (1) Adobe is a desktop app that costs $22.99/month per user; GetPDFPro is web-based, costs $5.99/month, and works on any device with a browser. (2) Adobe requires you to download, install, and update software; GetPDFPro runs in the browser with no install. For most solo practitioners and small firms, the web-based model is the better fit. For large firms with established e-discovery workflows, the comparison is on integration (Adobe plays well with Relativity, Everlaw, etc.) — we'll be honest about that gap.",
  },
  {
    q: "What about HIPAA, GDPR, CCPA?",
    a: "Our data-handling is designed to satisfy the strictest reading of each. The key property: we do not write your file to disk on our servers. For browser-side operations, the file never leaves your machine at all. For server-side operations, the file is held in memory only and is not logged, not backed up, not replicated, and not indexed. We do not run analytics on file contents. We do not use any file content (or any derivative) for training AI models — including our own Summarize tool, which receives the file as input but does not retain it. We have a public, plain-English privacy policy, a separate data-processing addendum (DPA) for EU customers, and a SOC 2 Type II readiness roadmap (target completion Q4 2026). For HIPAA-covered entities, we sign a BAA on the Pro tier.",
  },
  {
    q: "Can I use this for pro se (self-represented) filings?",
    a: "Yes. Pro se litigants need the same PDF/A-2b output, the same Bates numbering, the same redaction — they're often just working from a kitchen table. The free tier (50 tasks/day, 50 MB cap) is enough for most pro se work. If you have a large document production (the other side sent you 2,000 pages of discovery), Pro tier raises the cap to 4 GB and adds batch upload. The Redact tool is the same in both tiers. The PDF/A Convert tool is the same in both tiers. The only thing that's Pro-only is the volume of files and the batch processing. We have an in-depth /blog post on PDF/A for court filings that walks through the federal court requirements step by step.",
  },
  {
    q: "Do you have a public API for integration with case management?",
    a: "Yes — the same backend the web app uses is documented at api.getpdfpro.com/docs. Pro tier users get API keys. Common integrations: (1) auto-redact a document the moment it's uploaded to your case management system, (2) convert every Word document in a folder to PDF/A-2b at the end of the day, (3) generate a Bates-stamped production ZIP from a case folder. The API is RESTful, uses standard JSON, and returns the result as a binary download or a base64-encoded blob. Rate limits are 1,000 requests/day on Pro ($5.99/mo), 10,000 requests/day on Team ($49/mo, planned for Q3 2026). For e-discovery vendors integrating at scale, contact us for a custom tier.",
  },
];

// ───────────────────────────────────────────────────────────────────
// SoftwareApplication schema (legal-specific feature list)
// ───────────────────────────────────────────────────────────────────
function legalSoftwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: "GetPDFPro PDF Tools for Legal",
    url: `${SITE_URL}/for/legal`,
    description:
      "39 PDF tools designed for attorneys, paralegals, and compliance. True redaction that destroys underlying text, PDF/A-2b for court filings, Bates numbering, zero file retention. In-browser.",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "PDF Redaction and PDF/A Conversion for Legal",
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
          description: "1,000 tasks/day, 4 GB files, batch processing, BAA available." },
        { "@type": "Offer", name: "Pro Yearly", price: "53.88", priceCurrency: "USD",
          description: "Yearly billing, $4.49/mo effective." },
      ],
    },
    featureList: [
      "True redaction that destroys underlying text from PDF content stream",
      "PDF/A-2b export validated against veraPDF conformance test suite",
      "Bates numbering with custom prefix, start number, and position",
      "Image redaction that overwrites pixel data, not just overlay",
      "Merge, split, and reorder PDF productions with preserved metadata",
      "Word-to-PDF/A and PDF-to-Word for editing workflows",
      "Open REST API at api.getpdfpro.com for case management integration",
      "Zero file retention — files processed in memory, never written to disk",
    ],
  };
}

// ───────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────
export default function ForLegalPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "For Legal", url: `${SITE_URL}/for/legal` },
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        {/* Structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(bc)} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(legalSoftwareApplicationLd())}
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
              <Proof>For legal</Proof>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Updated 19 June 2026
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Redaction that{" "}
              <span className="text-brand-600 dark:text-brand-400">
                actually destroys the text.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400 sm:text-xl">
              The PDF toolkit for attorneys, paralegals, and compliance.
              True redaction, PDF/A-2b for court filings, Bates numbering,
              and zero file retention. In-browser, no install, no upload
              for sensitive operations.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/tools/redact"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Open the Redact tool
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                How true redaction works
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
              No credit card. No signup for 1 task. 50 free tasks/day signed in.
              BAA available on Pro.
            </p>
          </div>
        </section>

        {/* ─── SOCIAL PROOF BAR ─────────────────────────────────── */}
        <SocialProofBar
          stats={[
            { value: "39", label: "PDF tools in one place" },
            { value: "0", label: "Bytes of your file retained after processing", source: "Verified 11 Jun 2026" },
            { value: "PDF/A-2b", label: "Court-filing-grade export, veraPDF validated" },
            { value: "$5.99", label: "Pro tier, BAA included" },
          ]}
        />

        {/* ─── THE 4-MINUTE PROBLEM ────────────────────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                The problem
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                A black rectangle is not redaction.
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                You have a contract to produce. The other side asked for
                redacted copies. You opened the file in your PDF tool,
                drew black rectangles over the SSNs, and saved. Done.
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Except the SSNs are still in the file. Open the result
                in any text extractor and the numbers come right back.
                Select-all and copy-paste? Same thing. Run it through an
                OCR layer? The numbers appear again. The black rectangle
                is a visual cover. The text underneath is untouched.
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Real redaction means the underlying text is gone from
                the PDF content stream. Not covered. Gone. That&apos;s
                what true redaction means. That&apos;s what this tool does.
              </p>
            </div>
          </div>
        </section>

        {/* ─── 4 REQUIREMENTS ──────────────────────────────────── */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              What legal work actually needs
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Four things, done right.
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <FeatureCard
                icon={EyeOff}
                title="Redaction that destroys the text"
                body="Our Redact tool removes character data from the PDF content stream and applies a black rectangle on top. After running it, the redacted text is unrecoverable — copy-paste, pdftotext, OCR all return nothing. Image redactions overwrite the underlying pixel data, not just an overlay."
              />
              <FeatureCard
                icon={FileCheck}
                title="PDF/A-2b that courts accept"
                body="Federal court ECF, state e-filing systems (CM/ECF, Odyssey, File & Serve), and PACER all require PDF/A-1b or PDF/A-2b. Our converter produces both, and we validate the output against the veraPDF conformance test suite (the same tool the courts use)."
              />
              <FeatureCard
                icon={Shield}
                title="Zero file retention"
                body="Browser-side operations never send your file to a server. Server-side operations hold the file in memory only — no disk, no S3, no backup, no log. The same property that makes the tool fast is what protects attorney-client privilege and HIPAA-covered PHI."
              />
              <FeatureCard
                icon={Hash}
                title="Bates numbering for productions"
                body="Stamp a custom prefix (ACME_0001) on every page, sequentially, in production order. The Bates stamp is a vector text layer — searchable, selectable, recoverable in pdftotext. Pro tier supports batch upload for high-volume productions."
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
              Every redaction operation is content-stream-destroying. Every
              PDF/A export is veraPDF-validated. Every server-side
              operation is in-memory only. Source-citable, not marketing.
            </p>
            <div className="mt-10 space-y-3">
              <PainRow
                pain="Black rectangle is drawn on top of text, but the text is still in the PDF."
                solution="True redaction: we delete the character data from the PDF content stream before applying the visual mark. After Redact, the text is unrecoverable in copy-paste, pdftotext, or OCR."
                icon={EyeOff}
              />
              <PainRow
                pain="Court rejects the filing — “not PDF/A compliant.”"
                solution="Our PDF/A Convert tool produces PDF/A-1b and PDF/A-2b output, validated against veraPDF. We run validation on every conversion and surface conformance errors in the result."
                icon={FileCheck}
              />
              <PainRow
                pain="Cloud tool logs your file, backs it up to S3, and is vulnerable to subpoena."
                solution="Browser-side operations (Redact, Compress, Watermark, Bates) never send your file to a server. Server-side operations hold the file in RAM only — no disk, no log, no S3, no backup, no subpoena target."
                icon={Shield}
              />
              <PainRow
                pain="Bates numbering tool stamps pages but loses the prefix between documents."
                solution="Use Merge first (combine PDFs in production order), then apply Add Page Numbers with a custom prefix. The result is a continuous Bates range across the entire production."
                icon={Hash}
              />
              <PainRow
                pain="Signature stamp tool rasterizes your signature into a fuzzy low-res image."
                solution="Watermarks are rendered as a vector layer. The signature PNG is preserved at its native resolution, with the alpha channel intact. Sharp at 100% zoom, sharp at 400% zoom."
                icon={Stamp}
              />
              <PainRow
                pain="PDF-to-Word conversion mangles tables, headers, and footnotes."
                solution="We use Adobe PDF Services for the conversion — the highest-fidelity option on the market. Tables preserve their structure, footnotes are recognized, and the output .docx includes a tagged-PDF structure for accessibility compliance."
                icon={FileText}
              />
            </div>
          </div>
        </section>

        {/* ─── TOOLKIT (the 39 tools, organized for legal) ─ */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              The toolkit
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              12 tools you&apos;ll use every week. 27 more for the edge cases.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              The redaction, conversion, and stamping tools you need for
              the standard case workflow. All unlocked in the free tier.
            </p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { tool: "Redact PDF", use: "True redaction — destroys text from content stream", icon: EyeOff },
                { tool: "PDF/A Convert", use: "PDF/A-1b and PDF/A-2b for court filings", icon: FileCheck },
                { tool: "Merge PDF", use: "Combine production documents in order", icon: Layers },
                { tool: "Split PDF", use: "Split a 2,000-page production into segments", icon: Scissors },
                { tool: "Add Watermark", use: "CONFIDENTIAL, DRAFT, or signature stamp", icon: Stamp },
                { tool: "Add Page Numbers", use: "Bates numbering with custom prefix", icon: Hash },
                { tool: "Compress PDF", use: "Shrink for filing size limits (no redaction loss)", icon: Zap },
                { tool: "PDF to Word", use: "Edit text from a PDF in Word", icon: FileText },
                { tool: "Word to PDF", use: "Convert pleadings to PDF/A-ready format", icon: FileText },
                { tool: "OCR PDF", use: "Make scanned exhibits searchable", icon: Search },
                { tool: "Edit PDF", use: "Cover regions, stamp labels, edit metadata", icon: Stamp },
                { tool: "Extract Pages", use: "Pull specific pages for exhibit binders", icon: Scissors },
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

        {/* ─── FOR LEGAL (technical details) ──────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              For legal
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              The technical bits, in plain English.
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <FeatureCard
                icon={AlertTriangle}
                title="What &quot;true redaction&quot; means in PDF terms"
                body={
                  <>
                    A PDF stores text as drawing instructions in a content stream — &quot;show glyph X at coordinate Y.&quot; Visual redaction tools draw a black rectangle on top, but leave the original glyphs in the content stream. <strong>True redaction</strong> removes the glyphs and replaces the rectangle. We do both. The same applies to image redaction: we overwrite the underlying pixel data in the image XObject, not in an overlay layer. <a href="/blog/redact-pdf-properly" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Read the technical walkthrough →</a>
                  </>
                }
              />
              <FeatureCard
                icon={Scale}
                title="How PDF/A conformance is tested"
                body={
                  <>
                    The reference validator is <a href="https://verapdf.org" className="font-medium text-brand-600 hover:underline dark:text-brand-400">veraPDF</a>, an open-source tool maintained by the PDF Association and funded by the EU. It runs the full PDF/A-1b, PDF/A-2b, and PDF/A-2u conformance test suites. Our PDF/A Convert tool runs veraPDF on every output and surfaces any conformance errors in the result. If a file is rejected by a court system, you can re-run veraPDF locally against our output to see the exact rule violation.
                  </>
                }
              />
              <FeatureCard
                icon={Shield}
                title="Subpoena posture and data retention"
                body="We do not retain your file after the response is sent. The same property that lets us serve a request in 3 seconds is what protects you from a subpoena — we cannot produce what we do not have. The infrastructure is documented in our security whitepaper. For court orders or subpoenas, we will respond that no record exists. Our logging policy is to log request metadata (timestamp, endpoint, response code) but never request body or response body."
              />
              <FeatureCard
                icon={Lock}
                title="HIPAA, GDPR, CCPA, and attorney-client privilege"
                body="Browser-side operations (Redact, Compress, Watermark, Bates, Page Numbers) are HIPAA-grade by design: no PHI leaves the user's machine. Server-side operations are designed to satisfy the strictest reading of each framework: no disk, no log, no backup, no analytics on file contents, no AI training on file contents. Pro tier includes a BAA for HIPAA-covered entities. EU customers can sign our DPA. We have a SOC 2 Type II readiness roadmap (target Q4 2026)."
              />
            </div>
          </div>
        </section>

        {/* ─── PRIVACY & SECURITY ──────────────────────────────── */}
        <section className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900">
          <div className="container-narrow">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                Privacy & security
              </p>
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              We can&apos;t lose what we never have.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Most tools say &quot;we delete your file in 2 hours.&quot;
              That&apos;s true. It also means your file sat on a server
              for 2 hours — copyable, loggable, vulnerable to subpoena,
              potentially on a backup tape right now. We don&apos;t
              work that way.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <DoDontList
                title="What we don&apos;t do"
                variant="dont"
                items={[
                  "Don&apos;t write your file to disk on our servers",
                  "Don&apos;t back up your file to S3 or any object store",
                  "Don&apos;t log request body or response body",
                  "Don&apos;t run analytics on file contents",
                  "Don&apos;t use your files to train any AI model",
                  "Don&apos;t share with ad networks, partners, or law enforcement",
                ]}
              />
              <DoDontList
                title="What we do"
                variant="do"
                items={[
                  "Process browser-side files in your device&apos;s memory",
                  "Process server-side files in memory only, discard on response",
                  "Encrypt all traffic with TLS 1.3",
                  "Publish a plain-English privacy policy and DPA",
                  "Sign BAAs for HIPAA-covered entities on Pro tier",
                  "GDPR, CCPA, and HIPAA-aware design",
                ]}
              />
            </div>
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-slate-100">Want to verify?</strong>{" "}
                Open DevTools → Network, click any tool (try Compress or Watermark
                first — they&apos;re browser-side), upload a file, do the operation.
                You&apos;ll see no network request at all. For server-side tools,
                you&apos;ll see one POST and one response.{" "}
                <a href="/privacy" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                  Read the full privacy policy →
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
              The PDF/A conformance test, with sources.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              We ran the same 6 source files through our PDF/A Convert
              tool and validated the output against veraPDF 1.28.2, the
              reference PDF/A validator. All 6 files passed conformance
              on first run. Benchmarked 11 June 2026.
            </p>
            <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold dark:border-slate-700">Source file</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Original size</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">PDF/A-2b output</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">veraPDF result</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["10-page contract (text + 1 signature)", "412 KB", "438 KB (+6%)", "Compliant", "0.8s"],
                    ["50-page brief (text + 8 images)", "4.2 MB", "4.5 MB (+7%)", "Compliant", "3.1s"],
                    ["200-page deposition transcript (text)", "1.1 MB", "1.2 MB (+9%)", "Compliant", "2.4s"],
                    ["500-page exhibit binder (mixed)", "78 MB", "82 MB (+5%)", "Compliant", "47s"],
                    ["Scanned exhibit, 300 DPI (image-only)", "12 MB", "13.4 MB (+12%)", "Compliant", "11s"],
                    ["Production set (50 PDFs, merged)", "412 MB", "428 MB (+4%)", "Compliant", "3m 12s"],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium">{row[0]}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row[1]}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row[2]}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{row[3]}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
              Source:{" "}
              <Link href="/blog/pdfa-court-filing-guide" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                PDF/A for court filings: a 2026 guide
              </Link>
              . The size increase is expected — PDF/A requires embedded fonts and XMP metadata that standard PDFs may not include. We use deflate compression to keep the increase minimal.
            </p>
          </div>
        </section>

        {/* ─── PRICING ─────────────────────────────────────────── */}
        <PricingBlock />

        {/* ─── FAQ ──────────────────────────────────────────────── */}
        <FaqSection
          heading="The 12 questions legal teams ask."
          faqs={faqs}
        />

        {/* ─── RELATED READING ──────────────────────────────────── */}
        <RelatedReading
          heading="Tools and reading, for legal."
          links={[
            { href: "/vs/ilovepdf", title: "GetPDFPro vs iLovePDF", desc: "Honest feature comparison, sourced." },
            { href: "/vs/adobe-acrobat", title: "GetPDFPro vs Adobe Acrobat", desc: "How the two stack up for redaction and PDF/A." },
            { href: "/blog/pdfa-court-filing-guide", title: "PDF/A for court filings: a 2026 guide", desc: "Federal ECF, state e-filing, PACER requirements." },
            { href: "/blog/redact-pdf-properly", title: "How to redact a PDF properly", desc: "Visual cover vs content-stream-destroying redaction." },
            { href: "/blog/pdf-file-format-primer", title: "The PDF file format: a primer", desc: "Content streams, XObjects, and PDF/A conformance." },
            { href: "/for/founders", title: "GetPDFPro for Technical Founders", desc: "Same toolkit, framed for indie hackers and startup CTOs." },
            { href: "/for/designers", title: "GetPDFPro for Designers", desc: "Same toolkit, framed for graphic and UI designers." },
            { href: "/for/businesses", title: "GetPDFPro for Businesses", desc: "Same toolkit, framed for small business and operations teams." },
          ]}
        />

        {/* ─── FINAL CTA ────────────────────────────────────────── */}
        <FinalCta
          headline="Privilege deserves a tool that respects it."
          body="39 PDF tools. In-browser processing. No upload for sensitive work, no retention anywhere, no ad networks. 50 free tasks/day, transparent $5.99/mo Pro tier with BAA."
          primaryCta={{ href: "/tools/redact", label: "Open the Redact tool" }}
          secondaryCta={{ href: "/pricing", label: "See pricing" }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
