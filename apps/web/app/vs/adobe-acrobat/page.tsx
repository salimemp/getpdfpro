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
  title: `${SITE_NAME} vs Adobe Acrobat — feature & pricing comparison (2026)`,
  description:
    "An honest, sourced comparison of GetPDFPro and Adobe Acrobat Pro — pricing, AI features, privacy, free tier, and what you actually need.",
  alternates: { canonical: "/vs/adobe-acrobat" },
};

const faqs = [
  {
    q: "Is GetPDFPro a replacement for Adobe Acrobat Pro?",
    a: "For everyday tasks (merge, split, compress, convert PDF ↔ Office, OCR, redact, sign, fill forms, edit text), yes — GetPDFPro covers the 90% case. For deep enterprise features (advanced PDF/A validation, custom JavaScript actions, advanced redaction certificates, certified e-signatures, XFA forms, PostScript/EPS support), Adobe Acrobat Pro is still the more complete tool. Most individual users and small teams don't need those features.",
  },
  {
    q: "How much does Adobe Acrobat Pro cost in 2026?",
    a: "Per Adobe's official pricing page on 12 June 2026: Acrobat Standard is US$14.99/month (annual, billed monthly). Acrobat Pro is US$19.99/month (annual, billed monthly) and includes the AI Assistant Plus. Both plans offer a 14-day free trial, after which a half-month cancellation fee applies if you cancel after 14 days.",
  },
  {
    q: "How much does GetPDFPro cost?",
    a: "The free tier gives signed-in users 50 PDF tasks per day, anonymous users 1 task per day, and 50 MB per file — no time limit. Pro is $5.99/month or $53.88/year and unlocks 1,000 tasks/day, 4 GB files, batch processing, and AI features (Summarize, Translate, in beta). There's a 30-day money-back guarantee on Pro, no questions asked.",
  },
  {
    q: "Do you store my files?",
    a: "No. GetPDFPro processes files in memory and discards them after the response. Adobe's online Acrobat services retain files in their cloud storage with an account-managed retention period. Both vendors are GDPR-aware; we do not run advertising or analytics on the conversion endpoints.",
  },
  {
    q: "How do AI features compare?",
    a: "Adobe Acrobat Pro (since the 2024 generative-AI rollout) ships AI Assistant Plus: summarize, ask-questions-about-the-PDF, generate outlines, draft content. It's included in the $19.99/month Pro tier. GetPDFPro's AI features (Summarize, Translate via Google Gemini) are in beta and Pro-only as of 12 June 2026, with a more conservative feature set. Adobe is the more mature AI product today; GetPDFPro's bet is that in-browser AI for occasional users is enough, and our privacy story (no file storage, no analytics) is better.",
  },
  {
    q: "Do I need Adobe Acrobat Pro to fill PDF forms?",
    a: "No. GetPDFPro's `/tools/forms-extract` endpoint reads form field data from any PDF (via Adobe's PDF Forms API on the server, or our self-hosted PyMuPDF fallback). For filling and saving forms, you can use the free Adobe Acrobat Reader, or our `/tools/forms-extract` to dump fields to CSV/JSON. Adobe Reader is free and works fine for read-only workflows.",
  },
  {
    q: "What about e-signatures?",
    a: "GetPDFPro has a basic visual signature tool at `/tools/sign` (drag an image of your signature onto a page). Adobe Acrobat Pro has full digital signatures (PKI-based, certificate-backed) and Adobe Acrobat Sign (their standalone e-signature product, separate pricing). For informal signatures, ours is enough. For legally-binding digital signatures with audit trails, use Adobe Sign or DocuSign.",
  },
  {
    q: "Can I open a PDF I created in Adobe Acrobat?",
    a: "Yes. PDF is an open ISO standard (ISO 32000). Any PDF you create in Adobe Acrobat opens in GetPDFPro, and vice versa. We don't lock you in.",
  },
  {
    q: "Should I cancel Adobe Acrobat Pro?",
    a: "Only if you've confirmed you don't need any Pro-only features (see the first FAQ above). Most people pay $19.99/month for capabilities they use 10% of. If you're paying for Pro and only using merge/split/compress/convert, switch — you'll save $192/year and get the same end result for those tasks.",
  },
];

export default function VsAdobeAcrobatPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "vs Adobe Acrobat", url: `${SITE_URL}/vs/adobe-acrobat` },
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
            {SITE_NAME} vs Adobe Acrobat
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            An honest, sourced feature and pricing comparison. Last verified
            12 June 2026. Where we&apos;re uncertain about an Adobe fact, we
            say so.
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <strong>How we sourced this page.</strong> Every Adobe claim
            is pulled from Adobe&apos;s public pages (adobe.com/acrobat/pricing,
            adobe.com/acrobat/acrobat-pro.html) on 12 June 2026. Every
            GetPDFPro claim is from our deployed code at the time of
            writing. If you spot anything out of date, please email
            support@getpdfpro.com.
          </div>

          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            The 60-second version
          </h2>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Adobe Acrobat Pro is the most complete PDF tool on the market,
            and it costs <strong>$19.99/month</strong> (annual). GetPDFPro
            is a free + Pro ($5.99/month) alternative that covers the 90%
            case (merge, split, compress, convert, OCR, redact, sign) for
            ~80% less money. Choose Adobe if you need enterprise features
            (XFA forms, certified e-signatures, advanced PDF/A
            validation, JavaScript actions). Choose GetPDFPro if you
            mostly need everyday tasks at a price that doesn&apos;t make
            you wince.
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
                  <th className="px-4 py-3">Adobe Acrobat</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                <Row
                  label="Free tier (signed-in)"
                  us="50 tasks/day, 50 MB/file"
                  them="7-day free trial, then paid"
                />
                <Row
                  label="Free tier (anonymous, no signup)"
                  us="1 task/day, 50 MB/file"
                  them="No anonymous use of Acrobat Pro"
                />
                <Row
                  label="Paid tier (annual)"
                  us="$53.88/year ($4.49/mo equivalent)"
                  them="$19.99/month × 12 = $239.88/year (Pro, annual paid monthly)"
                />
                <Row
                  label="Paid tier (monthly)"
                  us="$5.99/month"
                  them="$19.99/month (Pro) or $14.99/month (Standard)"
                />
                <Row
                  label="File size cap (Free)"
                  us="50 MB per file"
                  them="No free tier for Pro; trial limited to 14 days"
                />
                <Row
                  label="File size cap (Pro)"
                  us="4 GB per file"
                  them="No published file-size cap (effectively large)"
                />
                <Row
                  label="File retention"
                  us="Processed in memory; discarded after response"
                  them="Stored in Adobe cloud with account-managed retention; deletable from your Adobe account"
                />
                <Row
                  label="Ads on free tier"
                  us="No ads"
                  them="No ads (paid only)"
                />
                <Row
                  label="Third-party tracking on conversion endpoints"
                  us="No analytics, no ad networks"
                  them="Adobe product analytics (per Adobe Privacy Policy)"
                />
                <Row
                  label="AI features"
                  us="Summarize + Translate (Pro, in beta, Gemini-powered)"
                  them="AI Assistant Plus (Pro, shipped since 2024, includes summarize, chat-with-PDF, draft)"
                />
                <Row
                  label="AI features — pricing"
                  us="Included in Pro ($5.99/month)"
                  them="Included in Pro ($19.99/month)"
                />
                <Row
                  label="XFA / LiveCycle forms"
                  us="Not supported"
                  them="Supported (Pro)"
                />
                <Row
                  label="Certified digital signatures (PKI)"
                  us="Not supported (visual signatures only)"
                  them="Supported (Pro)"
                />
                <Row
                  label="JavaScript actions in PDF"
                  us="Not supported"
                  them="Supported (Pro)"
                />
                <Row
                  label="Batch processing"
                  us="Available in Pro"
                  them="Available in Pro (Action Wizard)"
                />
                <Row
                  label="Platform"
                  us="Web (responsive), no install"
                  them="macOS, Windows, iOS, Android, Web (Acrobat online)"
                />
                <Row
                  label="OCR"
                  us="100+ languages, server-side"
                  them="Built-in OCR (scans to editable PDFs)"
                />
                <Row
                  label="PDF/A export"
                  us="PDF/A-2b (Adobe API on server)"
                  them="PDF/A-1b, -2b, -3u (Pro)"
                />
                <Row
                  label="30-day money-back"
                  us="Yes, no questions asked"
                  them="14-day free trial (no money-back stated)"
                />
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            All Adobe claims sourced from{" "}
            <a
              href="https://www.adobe.com/acrobat/pricing.html"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              adobe.com/acrobat/pricing
            </a>{" "}
            and{" "}
            <a
              href="https://www.adobe.com/acrobat/acrobat-pro.html"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              adobe.com/acrobat/acrobat-pro
            </a>{" "}
            on 12 June 2026. Prices in USD, before any regional taxes.
            We&apos;ll re-verify quarterly.
          </p>

          {/* When to use which */}
          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            When to use which
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose {SITE_NAME} if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Use PDFs for everyday tasks (merge, split, compress, convert)</li>
                <li>• Don&apos;t want to pay $19.99/month for Pro</li>
                <li>• Care about strict privacy (no file storage, no analytics)</li>
                <li>• Want a quick, no-signup tool that works on any device with a browser</li>
                <li>• Process a few PDFs a week and value a generous free tier</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose Adobe Acrobat if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Need XFA / LiveCycle forms support</li>
                <li>• Need certified digital signatures with PKI certificates</li>
                <li>• Use JavaScript actions inside PDFs</li>
                <li>• Need advanced PDF/A validation or PDF/UA accessibility</li>
                <li>• Already have an enterprise Creative Cloud / Document Cloud contract</li>
                <li>• Want the most mature AI Assistant (summarize, chat, draft) on the market</li>
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
                href="/tools/pdf-to-word"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                PDF to Word
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
