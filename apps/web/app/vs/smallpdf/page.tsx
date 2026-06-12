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
  title: `${SITE_NAME} vs Smallpdf — feature & pricing comparison (2026)`,
  description:
    "An honest, sourced comparison of GetPDFPro and Smallpdf Pro — pricing, free tier, AI features, privacy, batch processing, and what you actually need.",
  alternates: { canonical: "/vs/smallpdf" },
};

const faqs = [
  {
    q: "Is GetPDFPro a replacement for Smallpdf Pro?",
    a: "For most everyday tasks, yes. Both products cover merge, split, compress, convert PDF ↔ Word/Excel/PPT/JPG, edit, e-sign, redact, OCR, and protect. Smallpdf Pro adds batch processing, unlimited document downloads, OCR, edit-text, and AI features (chat-with-PDF, summarize, translate, question-generator). GetPDFPro Pro adds batch processing, larger files (4 GB vs Smallpdf Pro's unlimited), AI features (Summarize, Translate in beta), and a 30-day money-back guarantee. Where Smallpdf edges us out: a desktop app, mobile app, and a more mature AI product. Where we edge them out: no daily task limits on most free-tier tools, no ads anywhere, and a much cheaper Pro tier.",
  },
  {
    q: "How much does Smallpdf Pro cost in 2026?",
    a: "Per Smallpdf's official pricing page on 12 June 2026: Smallpdf Pro is $9/month when billed annually ($108/year) or $12/month when billed monthly. Smallpdf Team is $12/seat/month (annual) for 2-19 seats. Business is custom-priced for 20+ seats. There's a 7-day free trial. All paid plans include Sign.com (their e-signature product).",
  },
  {
    q: "How much does GetPDFPro cost?",
    a: "The free tier gives signed-in users 50 PDF tasks per day, anonymous users 1 task/day, and 50 MB per file — no time limit. Pro is $3.99/month or $24/year and unlocks 1,000 tasks/day, 4 GB files, batch processing, and AI features. There's a 30-day money-back guarantee on Pro, no questions asked.",
  },
  {
    q: "Do you store my files?",
    a: "No. GetPDFPro processes files in memory and discards them after the response. Smallpdf states on their pricing page (12 June 2026) that 'thanks to our TLS encryption technology, your documents are always processed with an added layer of security' and that 'Free' tier has a 14-day retention for recovery (per their Privacy Policy); paid Pro and Team tiers retain files in cloud storage for account-managed periods. Both vendors are GDPR/CCPA-aware. We do not run advertising on the conversion endpoints; Smallpdf's free tier shows no ads but uses standard product analytics.",
  },
  {
    q: "How do AI features compare?",
    a: "Smallpdf Pro ships AI tools: Chat with PDF, AI PDF Summarizer, Translate PDF, and AI Question Generator. AI tools have a 50 MB file size limit and a 25-35k word document limit (free tier) or 100k (paid). GetPDFPro Pro includes Summarize and Translate (in beta, Gemini-powered) with similar input limits. Smallpdf's AI is more mature; ours is cheaper and part of a smaller, more focused Pro tier ($3.99/month vs $9/month).",
  },
  {
    q: "Do you have a desktop or mobile app?",
    a: "GetPDFPro is web-only for now (responsive on phones, but not a native app). Smallpdf has Windows, macOS, iOS, and Android apps. Their desktop app lets you work offline on PDF files. If you need a true desktop app today, Smallpdf wins. Mobile apps are on our roadmap.",
  },
  {
    q: "What about e-signatures?",
    a: "Both products support visual e-signatures (drag an image of your signature). Smallpdf includes Sign.com (their e-signature product) in all paid plans. For legally-binding digital signatures with audit trails, both products point you to dedicated e-signature platforms (DocuSign, Adobe Sign). GetPDFPro's `/tools/sign` page handles the everyday case.",
  },
  {
    q: "Is Smallpdf or GetPDFPro better for privacy?",
    a: "GetPDFPro: in-memory processing, no file storage, no analytics on conversion endpoints, no ad networks, no third-party tracking pixels. Smallpdf: TLS-encrypted, ISO/IEC 27001 certified, GDPR + CCPA + nFADP compliant, with paid plans offering zero-ads and reduced analytics. Both are privacy-respecting. We win on data minimisation; they win on third-party compliance certifications.",
  },
  {
    q: "Should I switch from Smallpdf Pro to GetPDFPro Pro?",
    a: "Only if you don't depend on the desktop app, mobile app, or batch upload to cloud storage. If you only need browser-based PDF tools, the savings are real: $24/year vs $108/year ($84/year saved). The 30-day money-back lets you try risk-free. If Smallpdf Pro is part of your team's workflow (Sign.com + shared Team folders), the migration cost is higher and you may want to stay.",
  },
];

export default function VsSmallpdfPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "vs Smallpdf", url: `${SITE_URL}/vs/smallpdf` },
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
            {SITE_NAME} vs Smallpdf
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            An honest, sourced feature and pricing comparison. Last verified
            12 June 2026.
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <strong>How we sourced this page.</strong> Every Smallpdf claim
            is pulled from smallpdf.com/pricing and smallpdf.com features
            pages on 12 June 2026. Every GetPDFPro claim is from our
            deployed code at the time of writing.
          </div>

          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            The 60-second version
          </h2>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Smallpdf is the most popular browser-based PDF tool, with a
            mature desktop + mobile app and a healthy AI feature set. Pro
            starts at <strong>$9/month</strong> (annual). GetPDFPro is
            a free + Pro ($3.99/month) alternative that covers the same
            90% of everyday tasks for ~80% less money. Choose Smallpdf if
            you need a desktop app, mobile app, or Sign.com bundled in.
            Choose GetPDFPro if you mostly work in the browser and value
            privacy + lower price.
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
                  <th className="px-4 py-3">Smallpdf</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                <Row
                  label="Free tier (signed-in)"
                  us="50 tasks/day, 50 MB/file"
                  them="Limited daily downloads per tool, with daily task limits"
                />
                <Row
                  label="Free tier (anonymous, no signup)"
                  us="1 task/day, 50 MB/file"
                  them="No anonymous use — sign-up required for full features"
                />
                <Row
                  label="Paid tier (annual)"
                  us="$24/year ($2/mo equivalent)"
                  them="$108/year ($9/month, annual billing)"
                />
                <Row
                  label="Paid tier (monthly)"
                  us="$3.99/month"
                  them="$12/month (no annual discount)"
                />
                <Row
                  label="File size cap (Pro)"
                  us="4 GB per file"
                  them="Unlimited file size (Pro and above)"
                />
                <Row
                  label="File retention"
                  us="Processed in memory; discarded after response"
                  them="14-day retention on free tier (per Privacy Policy); paid plans with longer retention and account-controlled deletion"
                />
                <Row
                  label="Ads on free tier"
                  us="No ads"
                  them="No ads (free tier is also ad-free per their pricing page)"
                />
                <Row
                  label="Certifications"
                  us="GDPR, CCPA, HIPAA-grade security, SOC 2-ready"
                  them="ISO/IEC 27001 certified, GDPR, CCPA, nFADP compliant"
                />
                <Row
                  label="Third-party tracking on conversion endpoints"
                  us="No analytics, no ad networks"
                  them="Standard product analytics (per Smallpdf Privacy Policy)"
                />
                <Row
                  label="AI features"
                  us="Summarize + Translate (Pro, in beta, Gemini)"
                  them="Chat with PDF, Summarize, Translate, Question Generator (Pro, since 2024)"
                />
                <Row
                  label="AI features — pricing"
                  us="Included in Pro ($3.99/month)"
                  them="Included in Pro ($9/month)"
                />
                <Row
                  label="Batch processing"
                  us="Available in Pro"
                  them="Available in Pro (Batch Convert, Batch Compress)"
                />
                <Row
                  label="Sign (e-signatures)"
                  us="Visual signature image overlay"
                  them="Sign.com bundled in all paid plans (visual + audit trail)"
                />
                <Row
                  label="OCR"
                  us="100+ languages, server-side (Adobe API + Tesseract fallback)"
                  them="Built-in OCR (English + 8 languages per their docs)"
                />
                <Row
                  label="PDF/A export"
                  us="PDF/A-2b (Adobe API on server)"
                  them="Not directly listed on their feature set"
                />
                <Row
                  label="Platform"
                  us="Web (responsive), no install"
                  them="Web + macOS + Windows + iOS + Android"
                />
                <Row
                  label="Headquarters"
                  us="India (single founder)"
                  them="Switzerland (Smallpdf AG)"
                />
                <Row
                  label="30-day money-back"
                  us="Yes, no questions asked"
                  them="7-day free trial; refund not publicly stated"
                />
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            All Smallpdf claims sourced from{" "}
            <a
              href="https://smallpdf.com/pricing"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              smallpdf.com/pricing
            </a>{" "}
            on 12 June 2026. We&apos;ll re-verify quarterly.
          </p>

          {/* When to use which */}
          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            When to use which
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose {SITE_NAME} if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Work in the browser and don&apos;t need a native app</li>
                <li>• Want a strictly private option (no file storage, no analytics)</li>
                <li>• Process a moderate volume and want a generous free tier</li>
                <li>• Care about price — $24/yr vs $108/yr</li>
                <li>• Want a 30-day money-back guarantee on paid</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose Smallpdf if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Need a desktop app (macOS / Windows) for offline work</li>
                <li>• Need a native mobile app (iOS / Android)</li>
                <li>• Want Sign.com bundled in (their e-signature product)</li>
                <li>• Need ISO/IEC 27001 certification for enterprise procurement</li>
                <li>• Already use Smallpdf for Team / shared cloud storage</li>
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
                href="/tools/pdf-to-word"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                PDF to Word
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
