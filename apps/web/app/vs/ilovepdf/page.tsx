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
  title: `${SITE_NAME} vs iLovePDF — feature comparison`,
  description:
    "An honest, sourced comparison of GetPDFPro and iLovePDF — pricing, privacy, free tier limits, and feature breadth. Updated 11 June 2026.",
  alternates: { canonical: "/vs/ilovepdf" },
};

const faqs = [
  {
    q: "Is GetPDFPro really free?",
    a: "Yes. The free tier gives signed-in users 50 PDF tasks per day, anonymous users 1 task per day, and there's no time limit on the account. Pro is $3.99/month and unlocks 1,000 tasks/day, 4 GB files, AI features, and batch processing. iLovePDF's free tier is similar in that it's free, but their Premium starts at ₹200/month (~$2.40/mo) for the annual plan or ₹500/month (~$6/mo) monthly, per their live pricing page on 11 June 2026.",
  },
  {
    q: "Do you store my files?",
    a: "No. GetPDFPro processes files in memory and discards them after the response. iLovePDF states on its own Features page (11 June 2026): 'We automatically eliminate all your archives within two hours.' Both delete files automatically; GetPDFPro does so immediately after the request completes.",
  },
  {
    q: "How does your privacy compare?",
    a: "GetPDFPro: in-memory processing, no file storage, no analytics, no ad networks, no third-party tracking pixels. iLovePDF: also 2-hour retention, but their free tier shows ads and they use ad-network cookies. GetPDFPro's free tier has zero ads.",
  },
  {
    q: "Do you have a mobile or desktop app?",
    a: "Not yet. GetPDFPro is web-only for the moment. iLovePDF has a desktop app (macOS, Windows) and a mobile app (iOS, Android). Adding mobile is on our roadmap — the web app is responsive and works on phones, but it's not a native app experience yet.",
  },
  {
    q: "What's the same?",
    a: "The core tool set (merge, split, compress, convert PDF ↔ Word/JPG/PPT/Excel) is broadly comparable. Both run in the browser. Both are GDPR-aware. Both offer Premium tiers with team features.",
  },
  {
    q: "How do I switch?",
    a: "No migration needed. GetPDFPro doesn't store your files, so there's nothing to import. Just stop using iLovePDF and start using GetPDFPro — your next PDF task takes about 10 seconds.",
  },
];

export default function VsIlovepdfPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "vs iLovePDF", url: `${SITE_URL}/vs/ilovepdf` },
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
            {SITE_NAME} vs iLovePDF
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            An honest, sourced feature comparison. Last verified 11 June
            2026. Where we&apos;re uncertain about a competitor fact, we
            say so.
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <strong>How we sourced this page.</strong> Every
            iLovePDF claim below is pulled from their public pages
            (ilovepdf.com/pricing, ilovepdf.com/features, etc.) as
            of 11 June 2026. Every GetPDFPro claim is from our
            deployed code at the time of writing. If you spot
            something out of date, email{" "}
            <a href="mailto:salim@getpdfpro.com">
              salim@getpdfpro.com
            </a>{" "}
            and we&apos;ll fix it.
          </div>

          {/* Quick summary table */}
          <div className="mt-10 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold dark:border-slate-700">
                    Dimension
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold dark:border-slate-700">
                    {SITE_NAME}
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold dark:border-slate-700">
                    iLovePDF
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                <Row
                  label="Free tier (signed-in)"
                  us="50 tasks/day"
                  them="Free tier with limited tool access (per their pricing page)"
                />
                <Row
                  label="Free tier (anonymous, no signup)"
                  us="1 task/day"
                  them="Limited use without an account (specific quotas not publicly listed)"
                />
                <Row
                  label="Pro price (annual)"
                  us="$24/year ($2/mo equivalent)"
                  them="₹2,400/year (~$28.80/year at 11 June 2026 rates)"
                />
                <Row
                  label="Pro price (monthly)"
                  us="$3.99/month"
                  them="₹500/month (~$6/month at 11 June 2026 rates)"
                />
                <Row
                  label="File size cap (Free)"
                  us="50 MB per file"
                  them="Standard caps apply; specific number not publicly documented per file"
                />
                <Row
                  label="File size cap (Pro)"
                  us="4 GB per file"
                  them="Larger caps with Premium; specific number not publicly documented per file"
                />
                <Row
                  label="File retention"
                  us="Processed in memory; discarded after response"
                  them='"Automatically eliminate all your archives within two hours" — from iLovePDF Features page'
                />
                <Row
                  label="Ads on free tier"
                  us="No ads"
                  them="Ads on free tier (per their Features page: 'Ads-free workspace' is a Premium feature)"
                />
                <Row
                  label="Third-party tracking"
                  us="No analytics, no ad networks, no third-party cookies"
                  them="Ad-network cookies on free tier (per their Privacy Policy)"
                />
                <Row
                  label="Open source stack"
                  us="Next.js, FastAPI, PyMuPDF, Supabase, Cloudflare R2, Stripe"
                  them="Proprietary"
                />
                <Row
                  label="Source code"
                  us="Not yet open source (planned)"
                  them="Proprietary"
                />
                <Row
                  label="Mobile / desktop app"
                  us="Web only (responsive)"
                  them="macOS, Windows, iOS, Android"
                />
                <Row
                  label="Languages"
                  us="25+ in the public site (interface only — AI features in English at launch)"
                  them="25+ languages"
                />
                <Row
                  label="Batch processing"
                  us="Available in Pro"
                  them="Available in Premium"
                />
                <Row
                  label="AI features"
                  us="Planned (Gemini-powered, in Pro)"
                  them="AI Summarizer, Translate PDF (in Premium)"
                />
                <Row
                  label="Team management"
                  us="Roadmap (Q4 2026)"
                  them="Available in Premium"
                />
                <Row
                  label="30-day money-back"
                  us="Yes, no questions asked"
                  them="Not publicly stated"
                />
                <Row
                  label="Beta program"
                  us="6 months free Pro for the first 100 users"
                  them="Free year of Premium for students/educators (per their Pricing page)"
                />
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            All iLovePDF claims sourced from ilovepdf.com/pricing and
            ilovepdf.com/features on 11 June 2026. INR-to-USD
            conversion is approximate and based on the exchange rate
            at that time. We&apos;ll re-verify quarterly.
          </p>

          {/* When to use which */}
          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            When to use which
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose {SITE_NAME} if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>• Want a more generous free tier (50 vs limited use)</li>
                <li>• Care about strict privacy (no ads, no tracking)</li>
                <li>• Process a few PDFs a week and don&apos;t want to pay</li>
                <li>• Want a smaller, indie alternative to a big platform</li>
                <li>• Prefer tools that respect your time, not your data</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose iLovePDF if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>• Need a native desktop or mobile app</li>
                <li>• Want Google Drive / Dropbox integration today</li>
                <li>• Need team-management features right now</li>
                <li>• Already have a paid iLovePDF subscription</li>
                <li>• Want the largest brand-name recognition</li>
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
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
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
