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
  title: `${SITE_NAME} vs Soda PDF — feature & pricing comparison (2026)`,
  description:
    "An honest comparison of GetPDFPro and Soda PDF — pricing, free tier, AI features, e-signatures, and what you actually need.",
  alternates: { canonical: "/vs/soda-pdf" },
};

const faqs = [
  {
    q: "Is GetPDFPro a replacement for Soda PDF?",
    a: "For everyday tasks, yes. Both products cover merge, split, compress, convert PDF ↔ Word/Excel/PPT/JPG, edit, sign, OCR, redact, protect. Soda PDF's main differentiator is its Windows desktop app (Soda PDF Desktop) and e-signature (built into the desktop app). GetPDFPro is web-only, has a much more generous free tier (50 tasks/day vs Soda PDF Online's 2 files/day or 3 MB max), and a cheaper Pro tier ($3.99/month vs $7.25-$16.50/month).",
  },
  {
    q: "How much does Soda PDF cost in 2026?",
    a: "Per Soda PDF's plans page on 12 June 2026: Standard is $7/month (annual), Pro is $7.25/month (annual), Business is $16.50/user/month (annual). Capterra lists Pro at $7.25/month. Team is 3-19 licenses with a 10% discount. Soda PDF Online (web) has a free tier limited to 2 files per day OR 3 MB document size, with editing/OCR/forms/AI in paid plans only. There's no perpetual license — all plans are subscription.",
  },
  {
    q: "How much does GetPDFPro cost?",
    a: "The free tier gives signed-in users 50 PDF tasks per day, anonymous users 1 task/day, 50 MB per file — no time limit. Pro is $3.99/month or $24/year and unlocks 1,000 tasks/day, 4 GB files, batch processing, and AI features. There's a 30-day money-back guarantee on Pro, no questions asked.",
  },
  {
    q: "What does Soda PDF's free tier actually include?",
    a: "Per Soda PDF's PDF editor page (12 June 2026): 'Most of our tools can be used at no cost within the limit of 2 files per day OR a document size of 3 Mb maximum, except for the editing, OCR, forms, reader, AI ...'. So the free tier is: 2 files/day, max 3 MB per file, no editing, no OCR, no forms, no AI. That's much more restrictive than GetPDFPro's 50 tasks/day, 50 MB/file, full feature access.",
  },
  {
    q: "Do you store my files?",
    a: "No. GetPDFPro processes files in memory and discards them after the response. Soda PDF stores files in their cloud with 5 GB-10 GB cloud storage included in paid plans (Pro: 5 GB, Team: 5 GB, Business: 10 GB). For users who want zero file retention, GetPDFPro is the right choice.",
  },
  {
    q: "How do AI features compare?",
    a: "Both ship AI tools. Soda PDF Pro includes 'Chat with PDF', 'AI PDF summarizer', and 'Translate PDF' (Pro: 1200 pages/year, Team: 1200 pages/year, Business: 1800 pages/year). GetPDFPro Pro includes Summarize and Translate (in beta, Gemini-powered). Soda PDF's AI is more mature and includes chat-with-PDF; GetPDFPro's is more conservative but cheaper.",
  },
  {
    q: "Does Soda PDF have a desktop app?",
    a: "Yes — Soda PDF Desktop is their main product, available for Windows. (macOS desktop is not their main story.) GetPDFPro is web-only. If you need a true desktop app for offline work and you're on Windows, Soda PDF is the right call. If you're on macOS or want zero-install, GetPDFPro is better.",
  },
  {
    q: "Is there a perpetual license for Soda PDF?",
    a: "Per Soda PDF's FAQ (12 June 2026): 'No, we do not offer a perpetual license for our Soda PDF software. Our solutions are available through subscription plans, ensuring you always have access to the latest features, updates, and security enhancements.' GetPDFPro Pro is also subscription-only but with a 30-day money-back guarantee.",
  },
];

export default function VsSodaPdfPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "vs Soda PDF", url: `${SITE_URL}/vs/soda-pdf` },
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
            {SITE_NAME} vs Soda PDF
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            An honest, sourced feature and pricing comparison. Last verified
            12 June 2026.
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <strong>How we sourced this page.</strong> Every Soda PDF
            claim is from sodapdf.com/plans and sodapdf.com features
            pages on 12 June 2026. Capterra was used for cross-reference
            on annual pricing. Every GetPDFPro claim is from our deployed
            code at the time of writing.
          </div>

          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            The 60-second version
          </h2>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Soda PDF is a Windows desktop app (Soda PDF Desktop) plus a
            limited web app (Soda PDF Online). Pro starts at{" "}
            <strong>$7.25/month</strong> (annual) or $7/month (Standard,
            Capterra). GetPDFPro is a web-only alternative with a much
            more generous free tier (50 tasks/day vs 2 files/day at
            Soda PDF Online) and a cheaper Pro tier ($3.99/month vs
            $7.25). Choose Soda PDF if you need a Windows desktop app
            and use their e-signature / cloud storage. Choose
            GetPDFPro if you want a better free tier, a cheaper Pro
            tier, or you&apos;re on macOS / Linux / mobile.
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
                  <th className="px-4 py-3">Soda PDF</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                <Row
                  label="Free tier (Online)"
                  us="50 tasks/day (signed-in), 1 task/day (anonymous), 50 MB/file, all features"
                  them="2 files/day OR 3 MB/file max; no editing, OCR, forms, AI"
                />
                <Row
                  label="Paid tier (annual)"
                  us="$24/year ($2/mo equivalent)"
                  them="$87/year Standard, $87/year Pro, $198/year Business (all annual, per Capterra)"
                />
                <Row
                  label="Paid tier (monthly)"
                  us="$3.99/month"
                  them="$7/month (Standard), $7.25/month (Pro), $16.50/month (Business)"
                />
                <Row
                  label="File size cap (Free)"
                  us="50 MB per file"
                  them="3 MB per file (or 2 files/day, whichever hits first)"
                />
                <Row
                  label="File size cap (Pro/paid)"
                  us="4 GB per file"
                  them="No published cap"
                />
                <Row
                  label="File retention"
                  us="In-memory processing, discarded after response"
                  them="5-10 GB cloud storage included (Pro/Team: 5 GB, Business: 10 GB)"
                />
                <Row
                  label="Cloud storage"
                  us="Not applicable (no file storage)"
                  them="5 GB (Pro/Team) or 10 GB (Business) included"
                />
                <Row
                  label="AI features"
                  us="Summarize + Translate (Pro, in beta, Gemini)"
                  them="Chat with PDF, AI Summarizer, Translate (Pro+); quota: 1200 pages/year (Pro/Team), 1800 (Business)"
                />
                <Row
                  label="OCR"
                  us="100+ languages (Adobe + Tesseract)"
                  them="OCR (OCR Search in Pro, OCR Edit in Business)"
                />
                <Row
                  label="E-signature"
                  us="Visual signature overlay (image-based)"
                  them="E-Sign built into Soda PDF Desktop (Pro+) and Soda PDF Online"
                />
                <Row
                  label="Forms (PDF form fill)"
                  us="Forms-extract to JSON/CSV (read-only)"
                  them="Forms support in paid plans (Pro and above)"
                />
                <Row
                  label="PDF/A export"
                  us="PDF/A-2b (Adobe API on server)"
                  them="Supported (export to PDF/A in paid plans)"
                />
                <Row
                  label="Batch processing"
                  us="Available in Pro"
                  them="Available in Pro (Batch Convert, Batch Edit, etc.)"
                />
                <Row
                  label="Platform"
                  us="Web (responsive), no install"
                  them="Windows desktop (Soda PDF Desktop) + browser (Soda PDF Online); web app available on Mac/Linux"
                />
                <Row
                  label="Perpetual license"
                  us="No (subscription only)"
                  them="No (subscription only, per their FAQ)"
                />
                <Row
                  label="30-day money-back"
                  us="Yes, no questions asked"
                  them="Not publicly stated"
                />
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            All Soda PDF claims sourced from{" "}
            <a
              href="https://www.sodapdf.com/plans/"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              sodapdf.com/plans
            </a>{" "}
            and{" "}
            <a
              href="https://www.sodapdf.com/pdf-tools/pdf-editor/"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              sodapdf.com/pdf-tools/pdf-editor
            </a>{" "}
            on 12 June 2026. Annual pricing cross-referenced with{" "}
            <a
              href="https://www.capterra.com/p/226942/SODA-PDF/"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              Capterra
            </a>
            .
          </p>

          {/* When to use which */}
          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            When to use which
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose {SITE_NAME} if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Use the free tier often (50 tasks/day vs Soda PDF Online&apos;s 2/day)</li>
                <li>• Want a cheaper Pro tier ($3.99 vs $7.25)</li>
                <li>• Process large files (4 GB vs 3 MB on Soda PDF Online free)</li>
                <li>• Work on macOS, Linux, or mobile</li>
                <li>• Care about strict privacy (no file storage at all)</li>
                <li>• Want a 30-day money-back guarantee</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose Soda PDF if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Need a Windows desktop app for offline work</li>
                <li>• Use Soda PDF&apos;s built-in e-signature flow</li>
                <li>• Need cloud storage (5-10 GB included)</li>
                <li>• Want a more mature AI product (chat-with-PDF)</li>
                <li>• Are an enterprise with deployment via GPO / SCCM / Citrix</li>
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
                href="/tools/compress"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Compress PDF
              </Link>
              <Link
                href="/tools/summarize"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                AI Summarize
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
