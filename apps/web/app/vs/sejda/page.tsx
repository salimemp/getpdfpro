import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import {
  SITE_NAME,
  SITE_URL,
  ldJson,
  breadcrumbLd,
  faqLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: `${SITE_NAME} vs Sejda — feature & pricing comparison (2026)`,
  description:
    "An honest comparison of GetPDFPro and Sejda — pricing, free tier limits, privacy, AI features, and what you actually need for everyday PDF tasks.",
  alternates: { canonical: "/vs/sejda" },
};

const faqs = [
  {
    q: "Is GetPDFPro a replacement for Sejda?",
    a: "For most everyday tasks, yes. Both products cover merge, split, compress, convert PDF ↔ Word/Excel/PPT/JPG, edit, sign, OCR, protect, watermark, page-numbers, rotate, crop, redact, compare, repair. GetPDFPro has a much more generous free tier (50 tasks/day vs Sejda's 3 tasks/hour and 200-page cap), and a Pro tier that costs less than Sejda's Web Monthly ($5.99/month vs $7.50/month). Sejda has a desktop app and slightly more advanced editing features (JavaScript-free fillable forms, Bates numbering, N-up, deskew).",
  },
  {
    q: "How much does Sejda cost in 2026?",
    a: "Per Sejda's pricing page on 12 June 2026: a Web Week Pass is $5 for 7 days. Web Monthly is $7.50/user/month. Desktop+Web Annual is $63/user/year (saves 30% over Web Monthly). All paid plans include unlimited documents, no page or hourly limits, OCR up to 100 pages, multi-file processing, 21-minute time per task, 500MB per file. Volume discounts: 10% for 2-4 users, 20% for 5-24, 40% for 25-49, 60% for 50+.",
  },
  {
    q: "How much does GetPDFPro cost?",
    a: "The free tier gives signed-in users 50 PDF tasks per day, anonymous users 1 task/day, 50 MB per file — no time limit. Pro is $5.99/month or $53.88/year and unlocks 1,000 tasks/day, 4 GB files, batch processing, and AI features. There's a 30-day money-back guarantee on Pro, no questions asked.",
  },
  {
    q: "How generous is Sejda's free tier?",
    a: "Per their pricing page (12 June 2026), the Desktop+Web Free tier is forever free with no signup, but it has page and hourly limits, limited file uploads, and tool-specific limits. Concretely: max 200 pages per document, 50 MB file size, 3 tasks per hour (per the HonestPDF Sejda review, June 2026). OCR is limited to small files. For occasional use, that's fine. For any serious daily workflow, you'll need a paid plan quickly.",
  },
  {
    q: "Do you store my files?",
    a: "No. GetPDFPro processes files in memory and discards them after the response. Sejda is a server-based service (Sejda Web uploads to Sejda's servers for processing) and a downloadable desktop app (Sejda Desktop processes locally, no upload). Per Sejda's terms, files are automatically deleted from their servers after a short retention period; their Privacy Policy has the specifics.",
  },
  {
    q: "Does Sejda have AI features?",
    a: "No. Sejda's product is conversion + manipulation, not AI. GetPDFPro's Pro tier includes Summarize and Translate (in beta, Gemini-powered) for AI features. If you need AI on PDFs, GetPDFPro is the better fit today.",
  },
  {
    q: "Does Sejda have a desktop app?",
    a: "Yes — Sejda Desktop is a separate product. The Desktop+Web Annual plan ($63/year) includes both. The desktop app processes files locally (no upload), which is great for sensitive work. GetPDFPro is web-only; offline operation is on the roadmap.",
  },
  {
    q: "Can I cancel Sejda?",
    a: "Per Sejda's pricing FAQ (12 June 2026): 'To cancel a recurring subscription just click Stop auto-renewal from your account page.' You can also email hi@sejda.com. The Week Pass is a one-time charge, not a subscription. GetPDFPro Pro has a 30-day money-back guarantee (no questions asked) on top of the standard cancel-anytime model.",
  },
];

export default function VsSejdaPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "vs Sejda", url: `${SITE_URL}/vs/sejda` },
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(bc)}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(faqLd(faqs))}
        />

        <section className="container-narrow py-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {SITE_NAME} vs Sejda
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            An honest, sourced feature and pricing comparison. Last verified
            12 June 2026.
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <strong>How we sourced this page.</strong> Every Sejda claim
            is from sejda.com/upgrade and sejda.com features pages on 12
            June 2026. Every GetPDFPro claim is from our deployed code at
            the time of writing.
          </div>

          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            The 60-second version
          </h2>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Sejda is a developer-friendly PDF toolset with a generous
            feature set and a per-task pricing model. Free is
            restricted (3 tasks/hour, 200-page cap); paid starts at{" "}
            <strong>$7.50/month</strong> (Web) or $63/year (Desktop+Web
            bundle). GetPDFPro has a more generous free tier (50
            tasks/day, no page cap), a cheaper Pro tier ($5.99/month
            vs $7.50/month), and AI features Sejda doesn&apos;t
            offer. Choose Sejda if you need a desktop app or use
            Sejda&apos;s Bates numbering / N-up / deskew features.
            Choose GetPDFPro if you need a better free tier, lower
            Pro price, or AI features.
          </p>

          {/* Comparison table */}
          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            Side-by-side
          </h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3">{SITE_NAME}</th>
                  <th className="px-4 py-3">Sejda</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                <Row
                  label="Free tier"
                  us="50 tasks/day (signed-in), 1 task/day (anonymous), 50 MB/file"
                  them="Free, no signup: 3 tasks/hour, max 200 pages/file, 50 MB/file, tool-specific limits"
                />
                <Row
                  label="Paid tier (annual)"
                  us="$53.88/year ($4.49/mo equivalent)"
                  them="$63/year (Desktop+Web bundle) or $90/year equivalent for Web Monthly at $7.50/mo"
                />
                <Row
                  label="Paid tier (monthly)"
                  us="$5.99/month"
                  them="$7.50/month (Web Monthly) or $5 for 7 days (Week Pass)"
                />
                <Row
                  label="File size cap (Free)"
                  us="50 MB per file"
                  them="50 MB per file"
                />
                <Row
                  label="File size cap (Pro/paid)"
                  us="4 GB per file"
                  them="500 MB per file"
                />
                <Row
                  label="Page limit (Free)"
                  us="No published page cap"
                  them="Max 200 pages per document"
                />
                <Row
                  label="Tasks per hour (Free)"
                  us="Unlimited (rate-limited to 50/day signed-in)"
                  them="3 tasks/hour across all tools"
                />
                <Row
                  label="File retention"
                  us="In-memory processing, discarded after response"
                  them="Sejda Web uploads to Sejda servers; short retention per Sejda Privacy Policy; Sejda Desktop processes locally (no upload)"
                />
                <Row
                  label="AI features"
                  us="Summarize + Translate (Pro, in beta, Gemini)"
                  them="None"
                />
                <Row
                  label="OCR"
                  us="100+ languages, server-side (Adobe + Tesseract fallback)"
                  them="OCR supported, up to 100 pages on paid plans"
                />
                <Row
                  label="PDF/A export"
                  us="PDF/A-2b (Adobe API on server)"
                  them="Not in their core tool set"
                />
                <Row
                  label="Bates numbering"
                  us="Not supported"
                  them="Supported (Sejda Web)"
                />
                <Row
                  label="N-up (multiple pages per sheet)"
                  us="Not supported"
                  them="Supported (Sejda Web)"
                />
                <Row
                  label="Deskew (auto-straighten scans)"
                  us="Not supported"
                  them="Supported (Sejda Web)"
                />
                <Row
                  label="Batch processing"
                  us="Available in Pro"
                  them="Available in paid plans"
                />
                <Row
                  label="Platform"
                  us="Web (responsive), no install"
                  them="Web + desktop (macOS, Windows, Linux)"
                />
                <Row
                  label="30-day money-back"
                  us="Yes, no questions asked"
                  them="No (cancel anytime, no refund stated)"
                />
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            All Sejda claims sourced from{" "}
            <a
              href="https://www.sejda.com/upgrade"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              sejda.com/upgrade
            </a>{" "}
            on 12 June 2026.
          </p>

          {/* When to use which */}
          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            When to use which
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose {SITE_NAME} if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Use the free tier often (50 tasks/day vs Sejda&apos;s 3/hour)</li>
                <li>• Want a cheaper Pro tier ($5.99 vs $7.50)</li>
                <li>• Process large files (4 GB vs Sejda&apos;s 500 MB)</li>
                <li>• Need AI features (Summarize, Translate)</li>
                <li>• Want a 30-day money-back guarantee</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose Sejda if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Need a desktop app (macOS / Windows / Linux)</li>
                <li>• Use Bates numbering, N-up, or deskew features</li>
                <li>• Are a developer who automates via Sejda&apos;s API</li>
                <li>• Only need to run a task or two per day and prefer per-task pricing</li>
                <li>• Want 7-day Week Passes for short projects</li>
              </ul>
            </div>
          </div>

          {/* FAQ */}
          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            Frequently asked
          </h2>
          <div className="mt-6 space-y-4">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-slate-200 bg-white p-5 open:shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <span className="ml-4 text-slate-400 transition-transform group-open:rotate-180">
                    ⌄
                  </span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {f.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center dark:border-brand-900 dark:bg-brand-950/40">
            <h2 className="text-2xl font-bold tracking-tight">
              Ready to try {SITE_NAME}?
            </h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              No signup needed. Drop a PDF, get it back in seconds.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/tools/merge"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
              >
                Merge PDFs
              </Link>
              <Link
                href="/tools/split"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Split PDF
              </Link>
              <Link
                href="/tools/compress"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Compress PDF
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Row({
  label,
  us,
  them,
}: {
  label: string;
  us: string;
  them: string;
}) {
  return (
    <tr>
      <td className="border-b border-slate-200 px-4 py-3 font-medium dark:border-slate-700">
        {label}
      </td>
      <td className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />{" "}
        {us}
      </td>
      <td className="border-b border-slate-200 px-4 py-3 text-slate-500 dark:border-slate-700">
        <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />{" "}
        {them}
      </td>
    </tr>
  );
}
