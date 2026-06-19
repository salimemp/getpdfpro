import type { Metadata } from "next";
import Link from "next/link";
import {
  Briefcase,
  Lock,
  FileText,
  Stamp,
  Zap,
  ArrowRight,
  Layers,
  Users,
  Globe,
  Code2,
  Receipt,
  Building,
  TrendingUp,
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
  title: `${SITE_NAME} for Businesses — All 39 Tools, One Subscription`,
  description:
    "PDF toolkit for small business teams. Merge contracts, convert invoices, compress for email. Batch processing, team pricing, no upload for sensitive files.",
  keywords: [
    "pdf for business",
    "merge pdf free for business",
    "convert word to pdf",
    "sign contract online",
    "batch pdf processing",
    "small business pdf tool",
  ],
  alternates: { canonical: "/for/businesses" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/for/businesses`,
    title: `${SITE_NAME} for Businesses — All 39 Tools, One Subscription`,
    description:
      "Merge contracts, convert invoices, compress for email, sign with e-sign stamps. Batch processing, team-friendly, no upload for sensitive files.",
    images: [
      {
        url: "/og-for-businesses.png",
        width: 1200,
        height: 630,
        alt: "GetPDFPro for businesses — all 39 PDF tools in one place",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} for Businesses`,
    description:
      "All 39 PDF tools. Batch processing. Team-friendly pricing. No upload for sensitive files.",
  },
};

// ───────────────────────────────────────────────────────────────────
// FAQ — 12 business-specific questions
// ───────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: "What does the typical small business workflow look like?",
    a: "Most small business PDF work falls into 6 patterns: (1) convert a Word contract to PDF for signing, (2) merge a contract + exhibits into a single PDF for email, (3) compress the merged PDF to fit under Gmail's 25 MB attachment limit, (4) add a signature stamp or e-sign mark after counter-signature, (5) redact bank account numbers or SSNs before sending to a third party, (6) extract table data from a PDF invoice into Excel for accounting. GetPDFPro covers all 6 with a single subscription. The 39 tools are organized so the workflow is: Word to PDF → Merge → Compress → Watermark (signature) → Redact → Done. Total time: under 2 minutes for a typical contract package.",
  },
  {
    q: "How does batch processing work?",
    a: "Pro tier ($5.99/mo) supports batch upload. Drop a folder of PDFs into the tool, the operation runs on each, the results come back as a ZIP. Common batch workflows: (1) 50 invoices → convert all to PDF/A → ZIP. (2) 20 contracts → add page numbers and a footer with the company name → ZIP. (3) 200 supplier PDFs → compress all to under 2 MB each for email → ZIP. The browser-side limit is what your machine can handle (typically 50-200 files at once depending on size); the server-side limit is 1,000 files per batch. The result is a single download with a manifest CSV of what was processed.",
  },
  {
    q: "Can I add my company's signature stamp to a PDF?",
    a: "Yes. Two approaches: (1) the Add Watermark tool with an image of your signature PNG (transparent background) — the signature appears on every page as a vector layer, sharp at any zoom. (2) the Edit PDF tool — cover a region (signature line, date, “/s/ Jane Doe”) and stamp a text label. For high-volume signing, the API at api.getpdfpro.com/docs lets you script the workflow: take a docx template, fill in the per-customer values, convert to PDF, stamp a signature image, deliver by email. For legally-binding e-signatures with audit trails, we recommend a dedicated e-signature product (DocuSign, HelloSign) and use GetPDFPro for everything else.",
  },
  {
    q: "What about converting Word, Excel, and PowerPoint to PDF?",
    a: "Word to PDF: we use Microsoft Word's engine via Adobe PDF Services for the highest fidelity. The output preserves your styles, embedded fonts, headers/footers, and table structure. Excel to PDF: same engine, output is a single PDF with the active sheet (use the Excel print area if you want only specific cells). PowerPoint to PDF: each slide becomes a page, with all animations flattened to their final state. Conversion is fast (typically 2-5 seconds for a 10-page Word document). For very large PowerPoint decks (50+ slides), Pro tier's 4 GB cap handles it. The output is a standard PDF — open it in any reader, anywhere.",
  },
  {
    q: "How does this fit with our accounting software?",
    a: "GetPDFPro complements your accounting software — it doesn't replace it. Common use: (1) suppliers send invoices as PDFs by email, (2) you use Extract Tables to pull line items into CSV, (3) you import the CSV into QuickBooks / Xero / Zoho Books as a bill. The Extract Tables tool uses Adobe PDF Services for high-fidelity table recognition — the same engine Intuit and Xero use for their own PDF import features. The result is line items as separate rows, with column headers preserved, ready for import. For high-volume invoice processing, the API at api.getpdfpro.com/docs is the same backend scripted.",
  },
  {
    q: "Can my whole team share one subscription?",
    a: "Single-user Pro is $5.99/mo — one person, one login, all the tools. We don't have a multi-seat plan yet. For small teams (2-10 people), the most common setup is: one person on Pro for the heavy lifting (batch processing, large files, API access), the rest of the team on the free tier (50 tasks/day each is enough for the typical ad-hoc work). Pro tier can be upgraded to multi-seat on a per-quote basis — email us. We're building a Team tier ($49/mo, 10 seats, central billing) for Q3 2026.",
  },
  {
    q: "What about handling customer data? Are we GDPR compliant?",
    a: "GetPDFPro's data handling satisfies the strictest reading of GDPR. The key property: we do not write your file to disk on our servers. For browser-side operations (Compress, Merge, Watermark, Page Numbers, Redact, etc.), the file never leaves your machine. For server-side operations (PDF/A Convert, OCR, AI Summarize), the file is held in memory only and is not logged, not backed up, not replicated. We do not run analytics on file contents. We do not use any file content for training AI models. We have a public privacy policy and a Data Processing Addendum (DPA) for EU customers, available on request. We're not the data controller for your customer data — you are. We provide a tool that processes data at your direction and does not retain it.",
  },
  {
    q: "Can I use this for invoices, receipts, and expense reports?",
    a: "Yes — that's one of the most common use cases. Common workflow: (1) supplier sends a PDF invoice by email, (2) you use Extract Tables to pull line items into CSV, (3) you import the CSV into your accounting software as a bill, (4) you save the original PDF in your document store. For receipts: the OCR tool makes scanned receipts searchable (so you can find them by vendor name or amount later). For expense reports: merge multiple receipts into a single PDF for submission. Pro tier's 4 GB cap handles large expense reports with dozens of attachments.",
  },
  {
    q: "How do I handle confidential financial documents?",
    a: "For sensitive files (board minutes, financials, customer data exports), use the browser-side tools: Compress, Merge, Redact, Watermark. The file never leaves your machine. For files that need server-side processing (PDF/A conversion, OCR for a scanned board pack), the file is held in memory only — no disk, no S3, no backup. We have a SOC 2 Type II readiness roadmap (target Q4 2026). For HIPAA-covered entities, we sign a BAA on the Pro tier. For general financial data, the relevant frameworks (SOX for public companies, GDPR for EU, CCPA for California) are all satisfied by the in-memory processing model. If you have a specific compliance question, email us — we answer within 24 hours on Pro.",
  },
  {
    q: "What about combining multiple PDFs into a board pack?",
    a: "Use the Merge tool — drop in 10, 20, 50 PDFs in the order you want them combined, click merge, download. For a typical board pack (agenda, financials, minutes, supporting docs, 30-60 files), the result is a single PDF with bookmark navigation, in under 30 seconds. The bookmark is generated automatically (one bookmark per source PDF, named after the source filename). For a cleaner look, use the Edit PDF tool to add a cover page (with a title, date, and confidentiality stamp) and the Add Page Numbers tool to stamp 'Page N of M' in the footer. The result is a polished, navigable board pack that opens in any PDF reader.",
  },
  {
    q: "Is there a public API for workflow integration?",
    a: "Yes — the same backend the web app uses is documented at api.getpdfpro.com/docs. Pro tier users get API keys. Common business integrations: (1) auto-merge any new contract uploaded to your CRM into a single PDF, (2) auto-compress and watermark every PDF uploaded to a Slack channel, (3) auto-convert every Word document in a SharePoint folder to PDF/A for archival, (4) auto-redact PII from customer data exports. The API is RESTful, uses standard JSON, and returns the result as a binary download or a base64-encoded blob. Rate limits are 1,000 requests/day on Pro, 10,000 on the planned Team tier. For higher volumes, contact us for a custom tier.",
  },
  {
    q: "What's the ROI of Pro tier for a small business?",
    a: "Pro tier is $5.99/month or $53.88/year. The time savings: a typical 5-minute PDF task (merge, compress, watermark, convert) takes 30 seconds on GetPDFPro. If a team member does 10 such tasks per week, that's 50 minutes saved per week — 40+ hours per year. At even a conservative $30/hour loaded cost, that's $1,200/year saved per team member. For a 5-person team, Pro tier pays for itself in the first month. The honest alternative is doing the work in Acrobat ($22.99/month per seat × 5 = $1,379/year) or hiring an admin assistant to handle the PDF work. Both are more expensive. The free tier is fine for occasional use; Pro pays for itself the moment a team member hits the 50-task daily cap.",
  },
];

// ───────────────────────────────────────────────────────────────────
// SoftwareApplication schema (business-specific feature list)
// ───────────────────────────────────────────────────────────────────
function businessSoftwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: "GetPDFPro PDF Tools for Business",
    url: `${SITE_URL}/for/businesses`,
    description:
      "39 PDF tools designed for small business and operations teams. Merge contracts, convert invoices, compress for email, sign with e-sign stamps. Batch processing, team-friendly, no upload for sensitive files.",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "PDF Tools for Small Business",
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
          description: "1,000 tasks/day, 4 GB files, batch processing, API access." },
        { "@type": "Offer", name: "Pro Yearly", price: "53.88", priceCurrency: "USD",
          description: "Yearly billing, $4.49/mo effective." },
      ],
    },
    featureList: [
      "Batch processing for invoices, contracts, and expense reports",
      "Word/Excel/PowerPoint to PDF conversion via Adobe PDF Services",
      "Extract Tables for invoice line items into CSV / Excel-ready format",
      "Compress PDFs to fit Gmail 25 MB and Outlook 20 MB attachment limits",
      "Merge board packs, contract packages, and exhibit binders in 30 seconds",
      "Add signature stamps and watermarks as vector layers",
      "Open REST API at api.getpdfpro.com for workflow integration",
      "Zero file retention — files processed in memory, never written to disk",
    ],
  };
}

// ───────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────
export default function ForBusinessesPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "For Businesses", url: `${SITE_URL}/for/businesses` },
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        {/* Structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(bc)} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(businessSoftwareApplicationLd())}
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
              <Proof>For businesses</Proof>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Updated 19 June 2026
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              All 39 PDF tools.{" "}
              <span className="text-brand-600 dark:text-brand-400">
                One subscription. Zero seat licenses.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400 sm:text-xl">
              The PDF toolkit for small business and operations teams.
              Merge contracts, convert invoices, compress for email,
              sign with e-sign stamps. Batch processing, team-friendly,
              no upload for sensitive files.
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
                See the typical workflow
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
            { value: "30 sec", label: "Avg time for a typical 5-min PDF task", source: "Internal benchmark 11 Jun 2026" },
            { value: "0 sec", label: "File retention — processed in memory" },
            { value: "$5.99", label: "Pro tier, 1,000 tasks/day, batch uploads" },
          ]}
        />

        {/* ─── THE 15-MINUTE PROBLEM ────────────────────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                The problem
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                A 15-minute task that should take 30 seconds.
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                The supplier sent a 28 MB PDF contract package. You need
                to: merge it with the cover letter, compress to under
                Gmail&apos;s 25 MB limit, add a footer with your company
                name, and email it to your lawyer. You open three
                different tools. One is a desktop app that needs an
                update. The second is a cloud tool that wants you to
                create an account. The third is a free website that
                watermarks the output with its own logo.
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                You do the work. 15 minutes. For a task that should
                take 30 seconds. And you just uploaded a confidential
                contract to three different servers.
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                GetPDFPro does the same work in 30 seconds, in your
                browser, with no upload for the merge / compress / stamp
                steps. And it costs $5.99 a month — not $22.99 per
                seat, not $0 with a watermark on every page.
              </p>
            </div>
          </div>
        </section>

        {/* ─── 4 REQUIREMENTS ──────────────────────────────────── */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              What small business actually needs
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Four things, every day.
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <FeatureCard
                icon={Zap}
                title="Speed — done in 30 seconds, not 15 minutes"
                body="The typical small business PDF workflow (merge + compress + stamp) takes 30 seconds on GetPDFPro. The same workflow across three different free tools takes 15 minutes — and uploads your file to each one. Time savings on Pro tier pay for the subscription in the first month."
              />
              <FeatureCard
                icon={Receipt}
                title="Batch — 50 invoices, one operation"
                body="Pro tier supports batch upload. Drop in 50 invoices, pick the operation (compress, convert, watermark), get a ZIP. The same workflow one-at-a-time would take 25 minutes; batch does it in under 2. Includes a manifest CSV of what was processed."
              />
              <FeatureCard
                icon={Lock}
                title="Confidentiality — file stays in your browser"
                body="For the typical business workflow (merge, compress, stamp, watermark, page numbers), the file is processed in your browser's memory and never sent to a server. The same property that makes the tool fast is what protects your contracts, financials, and customer data."
              />
              <FeatureCard
                icon={Briefcase}
                title="No seat licenses — one subscription, your whole team"
                body="Acrobat Pro is $22.99 per user per month. For a 5-person team, that's $1,379/year. GetPDFPro Pro is $5.99/month per power user. The rest of the team uses the free tier (50 tasks/day each is enough for the typical ad-hoc work). No seat-tracking, no per-user licenses, no IT overhead."
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
              Built for the actual workflow: merge a few PDFs, compress
              the result, stamp a signature, ship it. The tools run in
              the order you do, with no learning curve.
            </p>
            <div className="mt-10 space-y-3">
              <PainRow
                pain="Three different tools, three different accounts, three uploads of the same file."
                solution="All 39 PDF tools in one place. No account required for 1 task. Sign in for the free 50/day quota. The file is processed in your browser for sensitive operations — no upload at all."
                icon={Zap}
              />
              <PainRow
                pain="Acrobat Pro is $22.99/user/month. For a 5-person team, that's $1,379/year."
                solution="Pro tier is $5.99/month per power user. Free tier covers the rest. The total cost for a 5-person team is $71.88/year — 5% of the Acrobat cost. Same backend, same output."
                icon={Briefcase}
              />
              <PainRow
                pain="Free tool watermarks the output with its own logo. Every PDF you send to a client has 'Made with [tool]' on it."
                solution="GetPDFPro does not watermark the output. Ever. The free tier and the Pro tier produce the same clean output. No 'Made with' footer, no 'Sign up to remove' badge, no upsell."
                icon={Stamp}
              />
              <PainRow
                pain="50 invoices, one-at-a-time, 25 minutes of clicking."
                solution="Pro tier's batch upload. Drop in the folder, pick the operation, get a ZIP. The whole batch runs in under 2 minutes. Includes a manifest CSV with the original filename, operation, and result."
                icon={Layers}
              />
              <PainRow
                pain="Cloud tool logs the file, backs it up to S3, and is vulnerable to subpoena."
                solution="Browser-side operations (Merge, Compress, Watermark, Page Numbers) never send the file to a server. Server-side operations hold the file in RAM only — no disk, no log, no S3, no backup. We can't lose what we never have."
                icon={Lock}
              />
              <PainRow
                pain="Word-to-PDF conversion mangles tables and headers in free tools."
                solution="We use Adobe PDF Services for the conversion — the same engine Intuit and Xero use for their own PDF features. Tables preserve their structure, headers and footers are recognized, embedded fonts carry over. 2-5 seconds for a typical document."
                icon={FileText}
              />
            </div>
          </div>
        </section>

        {/* ─── TOOLKIT (the 39 tools, organized for businesses) ─ */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              The toolkit
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              12 tools you&apos;ll use every week. 27 more for the edge cases.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              The merge, convert, compress, and stamping tools for the
              typical small business workflow. All unlocked in the free tier.
            </p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { tool: "Merge PDF", use: "Combine contract packages, board packs, exhibit binders", icon: Layers },
                { tool: "Compress PDF", use: "Shrink for Gmail 25 MB / Outlook 20 MB attachment limits", icon: Zap },
                { tool: "Word to PDF", use: "Convert contracts and proposals for email", icon: FileText },
                { tool: "Excel to PDF", use: "Convert spreadsheets and reports", icon: FileText },
                { tool: "PowerPoint to PDF", use: "Convert slide decks for distribution", icon: FileText },
                { tool: "PDF to Word", use: "Edit text from a PDF in Word", icon: FileText },
                { tool: "Extract Tables", use: "Pull invoice line items into CSV for accounting", icon: Receipt },
                { tool: "Add Watermark", use: "DRAFT, CONFIDENTIAL, or company signature", icon: Stamp },
                { tool: "Add Page Numbers", use: "Stamp 'Page N of M' for board packs", icon: Stamp },
                { tool: "Redact PDF", use: "Redact bank accounts, SSNs, customer data", icon: Lock },
                { tool: "Edit PDF", use: "Cover regions, stamp labels, edit metadata", icon: Stamp },
                { tool: "OCR PDF", use: "Make scanned invoices searchable", icon: FileText },
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

        {/* ─── FOR BUSINESSES (technical details) ──────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              For businesses
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
                    , the same engine dozens of production tools use. Outputs are standard PDF 1.7/2.0 — no &quot;GetPDFPro format&quot; that locks you in. Open the result in Acrobat, Preview, Chrome, anywhere. If we shut down tomorrow, your files are still PDFs.
                  </>
                }
              />
              <FeatureCard
                icon={Globe}
                title="Public REST API for workflow automation"
                body={
                  <>
                    The same backend the web app uses is documented at{" "}
                    <a href="https://api.getpdfpro.com/docs" className="font-medium text-brand-600 hover:underline dark:text-brand-400">api.getpdfpro.com/docs</a>
                    . Pro users get API keys. Common business workflows: auto-compress every PDF uploaded to a Slack channel, auto-merge every contract uploaded to a CRM, auto-convert every Word doc in a SharePoint folder to PDF/A.
                  </>
                }
              />
              <FeatureCard
                icon={Users}
                title="Free tier covers most ad-hoc work"
                body="The free tier is 50 tasks/day per signed-in user — that's enough for the typical ad-hoc business work (a few merges and compresses per day, occasional format conversion). Pro tier ($5.99/mo) raises it to 1,000 tasks/day and adds batch upload, the 4 GB file cap, and API access. Most small businesses run on a hybrid: one Pro user for the heavy lifting, the rest on the free tier."
              />
              <FeatureCard
                icon={TrendingUp}
                title="Built-in cost savings vs Acrobat"
                body="Acrobat Pro is $22.99 per user per month. For a 5-person team, that's $1,379/year. GetPDFPro Pro is $5.99/month per power user — typically one or two seats — with the rest of the team on the free tier. Total annual cost: $71.88 to $143.76. That's 5-10% of the Acrobat cost, with the same backend and the same output. We benchmarked the conversion quality against Acrobat on 11 June 2026 — see the comparison table on the /vs/adobe-acrobat page."
              />
            </div>
          </div>
        </section>

        {/* ─── PRIVACY & SECURITY ──────────────────────────────── */}
        <section className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900">
          <div className="container-narrow">
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                Privacy & security
              </p>
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Your contracts don&apos;t need to touch a third server.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Most cloud PDF tools say &quot;we delete your file in 2
              hours.&quot; That&apos;s true. It also means your file sat
              on their server for 2 hours — copyable, loggable,
              vulnerable to subpoena, potentially on a backup tape right
              now. For most business work, that&apos;s overkill. For
              some — board minutes, customer data, M&amp;A documents — it&apos;s
              a non-starter.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <DoDontList
                title="What we don&apos;t do"
                variant="dont"
                items={[
                  "Don&apos;t write your file to disk on our servers",
                  "Don&apos;t back up your file to S3 or any object store",
                  "Don&apos;t run analytics on file contents",
                  "Don&apos;t use your files to train any AI model",
                  "Don&apos;t share with ad networks, partners, or law enforcement",
                  "Don&apos;t require signup for 1 task",
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
                  "GDPR, CCPA, and SOX-aware design",
                ]}
              />
            </div>
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-slate-100">Want to verify?</strong>{" "}
                Open DevTools → Network, click any of the browser-side tools
                (Merge, Compress, Watermark, Page Numbers), upload a file, do
                the operation. You&apos;ll see no network request at all. The
                file is processed in your browser&apos;s memory and discarded
                on the next page load.{" "}
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
              The cost benchmark, with sources.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              The typical small business PDF workflow: merge 3
              contracts, compress the result to under 25 MB, add a
              signature stamp, and email to a counterparty. We timed
              this on 5 popular PDF tools on 11 June 2026. Same laptop,
              same file, same operation.
            </p>
            <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold dark:border-slate-700">Tool</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Time</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Cost / month</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">Watermark on output?</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">File retention</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["GetPDFPro (Free)", "32 sec", "$0", "No", "0 sec — in-memory"],
                    ["GetPDFPro (Pro)", "28 sec", "$5.99", "No", "0 sec — in-memory"],
                    ["iLovePDF", "2m 14s", "$0 (or $4.83 Pro)", "No (free tier has popups)", "2 hours"],
                    ["Smallpdf", "2m 31s", "$9.00", "No", "1 hour"],
                    ["Adobe Acrobat Pro", "1m 48s", "$22.99 / user", "No", "Cloud sync (opt-in)"],
                    ["Soda PDF Online", "3m 12s", "$0 (or $10.50 Pro)", "Yes (free tier)", "24 hours"],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium">{row[0]}</td>
                      <td className={`px-4 py-3 text-right ${i < 2 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"}`}>{row[1]}</td>
                      <td className={`px-4 py-3 text-right ${i < 2 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"}`}>{row[2]}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row[3]}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
              Source:{" "}
              <Link href="/vs/ilovepdf" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                GetPDFPro vs iLovePDF
              </Link>
              {", "}
              <Link href="/vs/adobe-acrobat" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                GetPDFPro vs Adobe Acrobat
              </Link>
              {", "}
              <Link href="/vs/smallpdf" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                GetPDFPro vs Smallpdf
              </Link>
              {". Benchmarked on the same 12 MB contract package on 11 June 2026."}
            </p>
          </div>
        </section>

        {/* ─── PRICING ─────────────────────────────────────────── */}
        <PricingBlock />

        {/* ─── FAQ ──────────────────────────────────────────────── */}
        <FaqSection
          heading="The 12 questions business teams ask."
          faqs={faqs}
        />

        {/* ─── RELATED READING ──────────────────────────────────── */}
        <RelatedReading
          heading="Tools and reading, for business."
          links={[
            { href: "/vs/ilovepdf", title: "GetPDFPro vs iLovePDF", desc: "Honest feature comparison, sourced." },
            { href: "/vs/adobe-acrobat", title: "GetPDFPro vs Adobe Acrobat", desc: "How the two stack up for business workflows." },
            { href: "/vs/smallpdf", title: "GetPDFPro vs Smallpdf", desc: "Honest comparison for small business pricing." },
            { href: "/blog/how-to-merge-pdfs", title: "How to merge PDFs: a 2026 guide", desc: "The 30-second version + bookmark-preserving rules." },
            { href: "/blog/compressing-pdfs-what-works", title: "Compressing PDFs: what actually works", desc: "The 3 real compression levers, with benchmark numbers." },
            { href: "/for/founders", title: "GetPDFPro for Technical Founders", desc: "Same toolkit, framed for indie hackers and startup CTOs." },
            { href: "/for/designers", title: "GetPDFPro for Designers", desc: "Same toolkit, framed for graphic and UI designers." },
            { href: "/for/legal", title: "GetPDFPro for Legal", desc: "Same toolkit, framed for attorneys and compliance." },
          ]}
        />

        {/* ─── FINAL CTA ────────────────────────────────────────── */}
        <FinalCta
          headline="Your business deserves a tool that respects both time and confidentiality."
          body="39 PDF tools. In-browser processing. No upload for sensitive work, no retention anywhere, no ad networks, no watermarks on output. 50 free tasks/day, transparent $5.99/mo Pro tier."
          primaryCta={{ href: "/tools", label: "Open the toolkit" }}
          secondaryCta={{ href: "/pricing", label: "See pricing" }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
