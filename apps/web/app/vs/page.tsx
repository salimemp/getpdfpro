import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SITE_NAME, SITE_URL, breadcrumbLd, ldJson } from "@/lib/seo";

export const metadata: Metadata = {
  title: `${SITE_NAME} vs the alternatives — honest PDF tool comparisons (2026)`,
  description:
    "Honest, sourced side-by-side comparisons of GetPDFPro with the most popular PDF tools: Adobe Acrobat, Smallpdf, PDF24, Sejda, Soda PDF, and iLovePDF.",
  alternates: { canonical: "/vs" },
};

const comparisons = [
  {
    slug: "adobe-acrobat",
    name: "Adobe Acrobat",
    tagline:
      "Adobe Acrobat Pro is the most complete PDF tool on the market, but it costs $19.99/month. GetPDFPro covers the 90% case for ~$5.99/month.",
  },
  {
    slug: "smallpdf",
    name: "Smallpdf",
    tagline:
      "Smallpdf is the most popular browser-based PDF tool with a mature desktop and mobile app. GetPDFPro covers the same 90% of everyday tasks for ~$53.88/year vs $108/year.",
  },
  {
    slug: "ilovepdf",
    name: "iLovePDF",
    tagline:
      "iLovePDF is the brand-name leader in browser-based PDF tools. GetPDFPro offers a more generous free tier (50 vs limited-use) and stricter privacy (no ads, no tracking).",
  },
  {
    slug: "pdf24",
    name: "PDF24",
    tagline:
      "PDF24 is genuinely free with no paid tier, made in Germany, and works offline on Windows. GetPDFPro is the better fit for macOS/Linux/mobile and offers a Pro tier with AI features.",
  },
  {
    slug: "sejda",
    name: "Sejda",
    tagline:
      "Sejda is a developer-friendly PDF toolset with a desktop app and per-task pricing. GetPDFPro has a more generous free tier and a cheaper Pro tier ($5.99 vs $7.50/month).",
  },
  {
    slug: "soda-pdf",
    name: "Soda PDF",
    tagline:
      "Soda PDF is a Windows desktop app with built-in e-signature and cloud storage. GetPDFPro is web-only, has a better free tier, and is cheaper Pro.",
  },
];

export default function VsIndexPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "vs alternatives", url: `${SITE_URL}/vs` },
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(bc)}
        />

        <section className="container-narrow py-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {SITE_NAME} vs the alternatives
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Honest, sourced side-by-side comparisons with the most popular
            PDF tools. Every fact in every page is cited. We re-verify
            pricing and features quarterly.
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <strong>How we source these pages.</strong> Every
            competitor claim is pulled from their public pages on the
            date listed at the top of each comparison. Every GetPDFPro
            claim is from our deployed code at the time of writing.
            Where we&apos;re uncertain, we say so.
          </div>

          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            Comparisons
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {comparisons.map((c) => (
              <Link
                key={c.slug}
                href={`/vs/${c.slug}`}
                className="group rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <h3 className="text-xl font-semibold tracking-tight group-hover:text-brand-600 dark:group-hover:text-brand-400">
                  {SITE_NAME} vs {c.name}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {c.tagline}
                </p>
                <p className="mt-4 text-sm font-medium text-brand-600 group-hover:underline dark:text-brand-400">
                  Read the comparison →
                </p>
              </Link>
            ))}
          </div>

          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            What you get with {SITE_NAME}
          </h2>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            39 free PDF tools, in-memory processing, no analytics, no ad
            networks, no third-party tracking pixels. The free tier gives
            signed-in users 50 PDF tasks per day; the Pro tier is
            $5.99/month and unlocks 1,000 tasks/day, 4 GB files, batch
            processing, and AI features. There&apos;s a 30-day money-back
            guarantee on Pro, no questions asked.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-start gap-3">
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              See all 39 tools
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Pricing
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
