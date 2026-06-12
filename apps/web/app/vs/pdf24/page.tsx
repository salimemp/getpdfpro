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
  title: `${SITE_NAME} vs PDF24 — free PDF tools comparison (2026)`,
  description:
    "An honest comparison of GetPDFPro and PDF24 — both promise free PDF tools, but they take very different approaches. Pricing, privacy, platform, features.",
  alternates: { canonical: "/vs/pdf24" },
};

const faqs = [
  {
    q: "Is GetPDFPro or PDF24 more private?",
    a: "Both are strong. GetPDFPro: in-memory processing, no file storage, no analytics on conversion endpoints, no ad networks, no third-party cookies. PDF24: a German product (Geek Software GmbH), GDPR-compliant by default, can run entirely offline (the PDF24 Creator desktop app), no telemetry, no ads. PDF24 wins on local-only operation (you can disconnect from the internet and the desktop app keeps working). GetPDFPro wins on no file retention at all — we don't even have a database of your files to delete.",
  },
  {
    q: "Does PDF24 cost anything?",
    a: "No. Per their homepage (12 June 2026): 'PDF24 has solutions for all PDF problems' and '100% Free | 100% Free of spyware'. There's no paid tier. The PDF24 Creator desktop app is a free download; the online tools at pdf24.org are free; the PDF24 Fax service has paid options but PDF24 Creator and PDF24 Tools are entirely free.",
  },
  {
    q: "Why would I pay for GetPDFPro if PDF24 is free?",
    a: "Three reasons: (1) PDF24 is great if you have a Windows PC (the desktop app is Windows-only). On macOS, Linux, ChromeOS, or mobile, you're stuck with the online tools, which are more limited. GetPDFPro works in any modern browser on any device. (2) PDF24's online tools are server-side and require uploading files. If your work is sensitive and you want zero file retention, GetPDFPro's in-memory processing is the better fit. (3) GetPDFPro's AI features (Summarize, Translate) are Pro-only and complement the conversion tools. PDF24 doesn't have AI features.",
  },
  {
    q: "Do both products support the same features?",
    a: "Mostly yes, with overlap on merge, split, compress, convert, edit, sign, OCR, protect, unlock, rotate, page-numbers, watermark, redact, compare. PDF24 has a few extras: PDF faxing, PDF overlay, webpage-to-PDF, and a more comprehensive set of OCR languages. GetPDFPro has AI features (Summarize, Translate) and an Office conversion suite (Word/PPT/Excel ↔ PDF via Adobe's API) that PDF24 doesn't offer.",
  },
  {
    q: "Can I run PDF24 offline?",
    a: "Yes — the PDF24 Creator desktop app is a downloadable Windows installer (~350 MB per Windows Forum reviews) that runs entirely locally. The Mac/Linux story is weaker: PDF24 Online is the only option for non-Windows. GetPDFPro is web-only, so you need an internet connection to use it. If offline-first is critical, PDF24 is the right call.",
  },
  {
    q: "Which is better for one-off tasks?",
    a: "For one-off tasks on a Mac or any browser, GetPDFPro is faster to start (no download, no install, just open the URL). For one-off tasks on Windows where you might be offline, PDF24 Creator is already on the machine. Both are quick for the 80% case.",
  },
  {
    q: "Is PDF24 truly spyware-free?",
    a: "Their homepage claims '100% Free of spyware' (12 June 2026). Independent reviews on Windows Forum and Reddit confirm no telemetry, no ads, no bundled software. The product is from Geek Software GmbH, a German company that's been in business since 2009. Trust signals are good.",
  },
  {
    q: "Can I switch between them?",
    a: "Yes. PDF is an open ISO standard (ISO 32000). Any file you create in PDF24 opens in GetPDFPro, and vice versa. There's no lock-in. Try both, keep whichever you prefer.",
  },
];

export default function VsPdf24Page() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "vs PDF24", url: `${SITE_URL}/vs/pdf24` },
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
            {SITE_NAME} vs PDF24
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            An honest comparison of two genuinely free PDF tools. Last
            verified 12 June 2026.
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <strong>How we sourced this page.</strong> Every PDF24 claim
            is from pdf24.org on 12 June 2026. Every GetPDFPro claim is
            from our deployed code at the time of writing.
          </div>

          <h2 className="mt-16 text-2xl font-bold tracking-tight sm:text-3xl">
            The 60-second version
          </h2>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Both products are genuinely free. PDF24 is a German-built
            desktop app (Windows) plus a free online toolset, with zero
            ads and zero telemetry. GetPDFPro is a browser-only tool
            that&apos;s also free (with a generous 50-tasks/day free
            tier and a $3.99/month Pro upgrade) and works on any
            device. Choose PDF24 if you have Windows and want a
            desktop app that runs offline. Choose GetPDFPro if you
            want a no-install, browser-based tool with strong
            in-memory privacy and a Pro tier with AI features.
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
                  <th className="px-4 py-3">PDF24</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                <Row
                  label="Free tier"
                  us="50 tasks/day (signed-in), 1 task/day (anonymous), 50 MB/file"
                  them="Free forever, no daily limits, no signup required"
                />
                <Row
                  label="Paid tier"
                  us="$3.99/month or $24/year (Pro, optional)"
                  them="No paid tier. PDF24 Creator desktop app is free."
                />
                <Row
                  label="File size cap"
                  us="50 MB (free), 4 GB (Pro)"
                  them="Generous (no published per-file cap)"
                />
                <Row
                  label="File retention"
                  us="In-memory processing, discarded after response"
                  them="Online tools retain files server-side per their privacy policy. Desktop app processes locally, never uploads."
                />
                <Row
                  label="Offline operation"
                  us="No (browser-based, requires internet)"
                  them="Yes (PDF24 Creator desktop app, Windows only)"
                />
                <Row
                  label="Platforms"
                  us="Any modern browser (web-only)"
                  them="Windows (desktop), any browser (online)"
                />
                <Row
                  label="Mobile app"
                  us="Web responsive (no native app yet)"
                  them="No mobile app (online tools work in mobile browser)"
                />
                <Row
                  label="AI features"
                  us="Summarize + Translate (Pro, in beta)"
                  them="None"
                />
                <Row
                  label="Office ↔ PDF"
                  us="Word / PPT / Excel ↔ PDF (Adobe V2 API)"
                  them="Online tools: image-only conversion; desktop app: limited"
                />
                <Row
                  label="OCR"
                  us="100+ languages (server-side, Adobe + Tesseract fallback)"
                  them="OCR supported, language list on their docs"
                />
                <Row
                  label="PDF faxing"
                  us="Not supported"
                  them="PDF24 Fax is a separate (paid) service"
                />
                <Row
                  label="PDF Overlay"
                  us="Not supported"
                  them="Supported (PDF24 desktop)"
                />
                <Row
                  label="Watermark"
                  us="Text or image, 8 positions + tile, 4 colors, 7 rotations"
                  them="Text or image, position options"
                />
                <Row
                  label="PDF/A export"
                  us="PDF/A-2b (Adobe API on server)"
                  them="Not in their core tool set"
                />
                <Row
                  label="Headquarters"
                  us="India (single founder, bootstrapped)"
                  them="Germany (Geek Software GmbH, since 2009)"
                />
                <Row
                  label="Open source"
                  us="No (planned)"
                  them="No (closed source, but free)"
                />
                <Row
                  label="30-day money-back"
                  us="Yes (Pro only)"
                  them="N/A (free product)"
                />
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            All PDF24 claims sourced from{" "}
            <a
              href="https://www.pdf24.org/en/"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              pdf24.org
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
                <li>• Don&apos;t have Windows, or want a no-install web app</li>
                <li>• Want zero file retention (in-memory processing)</li>
                <li>• Need Office ↔ PDF conversion that PDF24 can&apos;t do</li>
                <li>• Want AI features (Summarize, Translate) in the Pro tier</li>
                <li>• Want a 30-day money-back guarantee on paid</li>
                <li>• Work on macOS, Linux, ChromeOS, or mobile</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Choose PDF24 if you:</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Have Windows and want a free desktop app</li>
                <li>• Need offline operation (PDF24 Creator works without internet)</li>
                <li>• Want absolutely zero ads, zero telemetry, forever</li>
                <li>• Need PDF faxing, PDF overlay, or other niche features</li>
                <li>• Prefer established, multi-language desktop software</li>
                <li>• Don&apos;t need Office ↔ PDF or AI features</li>
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
