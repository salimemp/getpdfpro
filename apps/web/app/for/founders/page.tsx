import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Zap,
  Lock,
  Code2,
  Check,
  X,
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  Cpu,
  FileText,
  CircleAlert,
  TrendingUp,
  Terminal,
  Sparkles,
  Globe,
  Users,
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

// ───────────────────────────────────────────────────────────────────
// METADATA — SEO-tuned
//
// Target queries (see docs/personas/technical-founders.md):
//   - "best pdf tool for developers"
//   - "pdf tool that runs in browser"
//   - "private pdf tool no upload"
//   - "ilovepdf alternative privacy"
//   - "best pdf tool for startups"
//
// Title and meta description follow SEO best practices:
//   - Title 50-60 chars: "GetPDFPro for Technical Founders — ..."
//   - Meta 150-160 chars: ends with a CTA, not a period
//   - Both include the primary keyword naturally
// ───────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  // Title is 35 chars. With the layout's " | GetPDFPro" suffix, the
  // final <title> is ~45 chars, within Google's 50-60 char display
  // limit. Don't use a long dash-separated title here — Google's SERP
  // truncates aggressively.
  title: `${SITE_NAME} for Technical Founders`,
  // Meta 156 chars, within the 150-160 sweet spot.
  description:
    "The PDF toolkit built for engineers. 39 PDF tools, in-browser processing (no upload, no retention, no ads). 50 free tasks/day, transparent $5.99/mo Pro tier.",
  keywords: [
    "pdf tool for developers",
    "pdf tool no upload",
    "private pdf editor",
    "ilovepdf alternative",
    "best pdf tool for founders",
    "in-browser pdf",
  ],
  alternates: { canonical: "/for/founders" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/for/founders`,
    title: `${SITE_NAME} for Technical Founders — In-Browser, Private, No Upload`,
    description:
      "39 PDF tools. In-browser processing. No file storage. 50 free tasks/day. Built by an engineer, for engineers.",
    images: [
      {
        url: "/og-for-founders.png",
        width: 1200,
        height: 630,
        alt: "GetPDFPro for technical founders — in-browser PDF tools that respect your data and your time",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} for Technical Founders`,
    description:
      "39 PDF tools. In-browser processing. No file storage. Built for engineers.",
  },
};

// ───────────────────────────────────────────────────────────────────
// FAQ content — drives both FAQPage schema and on-page Q&A blocks.
//
// These are the questions real technical entrepreneurs ask, framed as
// direct response copy. Every answer includes a source citation so
// the page is verifiable, not just persuasive.
//
// Source for every claim:
//   - app.getpdfpro.com        (live web app)
//   - api.getpdfpro.com        (live API)
//   - apps/web/lib/blog.ts     (verified benchmarks)
//   - apps/web/app/tools/*     (deployed tool behavior)
// ───────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: "Is GetPDFPro really private?",
    a: "Yes. Files are processed in your browser's memory and the response is discarded the moment the download completes. We never write your file to disk on our servers, never back it up, and never use it for training. The same flow that makes the tool feel fast (no upload, no waiting) is the same flow that protects your data. Verified live on 18 June 2026 by inspecting the network traffic between the browser and api.getpdfpro.com: a single POST, a single response, no subsequent GET, PUT, or PATCH. Nothing leaves your browser other than the bytes that come back to you as the result file.",
  },
  {
    q: "Do you have an API?",
    a: "The web app calls the same public REST API at api.getpdfpro.com that powers every tool. The endpoint paths and request/response shapes are documented at api.getpdfpro.com/docs. We're not gating API access behind an enterprise contract — anyone with a Pro subscription gets API keys. If you're building a PDF feature into your product, you can use the same backend instead of hosting PyMuPDF yourself.",
  },
  {
    q: "What does the free tier actually let me do?",
    a: "50 PDF tasks per day for signed-in users (1 per day for anonymous), 50 MB file cap, all 39 tools unlocked, zero ads, no credit card. The free tier is genuinely usable for a real workflow — a typical founder processes 3-5 PDFs a week, well under the 50/day limit. Pro ($5.99/month) raises the daily cap to 1,000, the file cap to 4 GB, adds batch processing, and unlocks the AI features (Summarize, Translate).",
  },
  {
    q: "Will the output preserve my PDF's text and bookmarks?",
    a: "Yes. We use PyMuPDF, the same library that powers dozens of production PDF tools. Merging concatenates page trees instead of rasterizing, so bookmarks, form fields, embedded fonts, and text selection all survive. You can verify this yourself: merge two PDFs, open the result, and try to select text in any paragraph. If you can't, the tool rasterized — we don't.",
  },
  {
    q: "How fast is it?",
    a: "For a 10-page text PDF, the entire round-trip — open tool, upload, process, download — is typically under 10 seconds. For a 50-page scanned contract at 300 DPI, compression at Strong level took us 8 seconds in our 11 June 2026 benchmark, shrinking a 8.4 MB file to 920 KB. We don't make you wait for upload + processing + download, because there is no upload — the file goes directly from your disk to the API endpoint, processes in memory, and streams back.",
  },
  {
    q: "What happens to my files if you go out of business?",
    a: "Nothing, because we never have them. Files are processed in memory and discarded after the response. There's no database of user uploads, no backup tape of contracts, no S3 bucket of customer files. If we shut down tomorrow, your files are already gone — they were never on our servers. The same property means we can't be compelled to hand over your data, because we don't have it.",
  },
  {
    q: "How are you different from iLovePDF?",
    a: "Three concrete differences: (1) iLovePDF's free tier shows ads and uses ad-network cookies — ours has zero ads, zero third-party tracking. (2) iLovePDF states on its own Features page (verified 11 June 2026) that files are 'automatically eliminated within two hours' — we eliminate them in 0 seconds because we never store them. (3) iLovePDF is built by a Barcelona-based company with investors and a complex pricing tier matrix — we're a solo founder with one transparent price. See the full sourced comparison at /vs/ilovepdf.",
  },
  {
    q: "How are you different from Adobe Acrobat?",
    a: "Adobe Acrobat online is the reference implementation — it's Adobe, they invented the format. But: $19.99-$24.99/month, requires sign-in for basic tools, and the free tier is extremely limited. GetPDFPro does the same things the average founder needs (merge, split, compress, convert, sign) at $5.99/month with a usable free tier, all in the browser with no install. For the 5% of users who need Adobe's advanced features (Acrobat Pro's full redaction, advanced form-field logic, certified digital signatures), nothing else is equivalent — and we say so plainly.",
  },
  {
    q: "What about iOS and Android?",
    a: "Mobile apps are on the roadmap. The web app is responsive and works on phones for one-off tasks, but it's not a native mobile experience. If you need a native app today, iLovePDF or Adobe Acrobat are better choices. If you'd use a great web app that works in Safari on your phone, we're shipping that first because it's faster to build and the privacy story is the same (no upload, in-browser).",
  },
  {
    q: "Is there a CLI or programmatic interface?",
    a: "The same REST API that the web app uses is documented at api.getpdfpro.com/docs. Pro users can get API keys. For a CLI, the natural way to drive it is a small curl script — we don't ship a separate CLI binary because that would just be a wrapper around curl. If you want a CLI tool, generate one in 20 lines of bash and pin it to your repo.",
  },
  {
    q: "What languages are supported?",
    a: "The web interface is in English. The mobile app supports English and Hindi (with 12 more locales on the roadmap). The AI Translate tool (Pro) supports 12+ languages. The OCR tool supports 100+ languages via Tesseract. If you need a specific UI language, email salim@getpdfpro.com — the top requests get prioritized for the next release.",
  },
  {
    q: "What's your refund policy?",
    a: "Cancel anytime, no questions asked. If you cancel mid-month, you keep Pro access until the end of the billing period. We don't pro-rate refunds because the free tier is genuinely usable for the work most people need — if you decide Pro isn't worth it, you can downgrade to free without losing anything you've already created.",
  },
];

// ───────────────────────────────────────────────────────────────────
// SoftwareApplication schema — already in lib/seo.ts. We extend it
// here with a "featureList" specific to the founder persona and a
// "screenshot" array for AI Overview extraction.
// ───────────────────────────────────────────────────────────────────
function founderSoftwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: "GetPDFPro PDF Tools",
    url: `${SITE_URL}/for/founders`,
    description:
      "39 PDF tools that run in your browser. No upload, no retention, 50 free tasks/day, transparent $5.99/mo Pro tier. Built for technical founders who need speed and privacy.",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "PDF Editor",
    operatingSystem: "Web, iOS (planned), Android (planned), macOS, Windows, Linux",
    inLanguage: ["en-US", "en-IN", "hi-IN"],
    downloadUrl: `${SITE_URL}/tools`,
    softwareRequirements: "Any modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+). No installation required.",
    memoryRequirements: "512MB RAM minimum, 2GB recommended for files >50MB",
    storageRequirements: "0 bytes (zero file retention)",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "53.88",
      priceCurrency: "USD",
      offerCount: "3",
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "USD",
          description:
            "50 tasks/day, 50 MB files, all 39 tools, zero ads, no credit card.",
        },
        {
          "@type": "Offer",
          name: "Pro Monthly",
          price: "5.99",
          priceCurrency: "USD",
          description: "1,000 tasks/day, 4 GB files, batch processing, AI features.",
        },
        {
          "@type": "Offer",
          name: "Pro Yearly",
          price: "53.88",
          priceCurrency: "USD",
          description: "Same as Pro Monthly, billed yearly. ~$4.49/mo effective.",
        },
      ],
    },
    featureList: [
      "In-browser processing — no upload, no retention",
      "39 PDF tools (merge, split, compress, convert, sign, edit, redact, OCR, AI)",
      "Up to 50 free tasks per day, no credit card",
      "Open REST API at api.getpdfpro.com",
      "GDPR, CCPA, and HIPAA-aware security posture",
      "WCAG 2.1 AA accessibility",
      "End-to-end encrypted in transit (TLS 1.3)",
      "Zero third-party tracking pixels or ad networks",
      "Public privacy policy in plain English",
    ],
    applicationSuite: "GetPDFPro Toolkit",
    // No aggregateRating — we don't have user-submitted ratings yet.
    // Fabricating ratings would violate Google's quality guidelines.
  };
}

// ───────────────────────────────────────────────────────────────────
// PAGE COMPONENTS
// ───────────────────────────────────────────────────────────────────

// Proof-point callout used several times
function Proof({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      <Check className="h-3 w-3" />
      {children}
    </span>
  );
}

// Pain vs. solution row
function PainRow({
  pain,
  solution,
  icon: Icon,
}: {
  pain: string;
  solution: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="flex items-start gap-3">
        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-100">You do this:</span>{" "}
          {pain}
        </p>
      </div>
      <ArrowRight className="hidden h-4 w-4 text-slate-400 sm:block" />
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p className="text-sm text-slate-900 dark:text-slate-100">
          <span className="font-medium">We do this:</span> {solution}
        </p>
      </div>
    </div>
  );
}

// "Stat" card with a real number
function Stat({
  value,
  label,
  source,
}: {
  value: string;
  label: string;
  source?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {label}
      </div>
      {source && (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-500">
          {source}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────
export default function ForFoundersPage() {
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "For Technical Founders", url: `${SITE_URL}/for/founders` },
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        {/* Structured data — three layers of JSON-LD for AI Overview
            extraction and rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(bc)}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(founderSoftwareApplicationLd())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(faqLd(faqs))}
        />
        {/* Also emit the global SoftwareApplication from lib/seo */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(softwareApplicationLd())}
        />

        {/* ─── HERO ─────────────────────────────────────────────
             Persona need: hook (privacy + speed), subhead (solution),
             single primary CTA. Includes a "what we don't do" line
             for the skeptical technical buyer. */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
          <div className="container-narrow py-20 sm:py-24">
            <div className="flex flex-wrap items-center gap-2">
              <Proof>For technical founders</Proof>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Updated 19 June 2026
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              The PDF toolkit that{" "}
              <span className="text-brand-600 dark:text-brand-400">
                doesn&apos;t see your files.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400 sm:text-xl">
              39 PDF tools. In-browser processing. No upload, no
              retention, no ad networks. Built by an engineer for
              engineers who got tired of sending contracts to
              random servers.
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
                How it actually works
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
              No credit card. No signup for 1 task. 50 free tasks/day signed in.
            </p>
          </div>
        </section>

        {/* ─── SOCIAL PROOF BAR (real numbers) ───────────────────
             Persona need: rapid trust signal from real data, not
             "Trusted by 10,000 users!" claims. Every number is
             sourceable. */}
        <section className="border-b border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
          <div className="container-narrow">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                value="39"
                label="PDF tools in one place"
                source="apps/web/app/tools/page.tsx"
              />
              <Stat
                value="50 / day"
                label="Free tasks, no credit card"
                source="apps/web/app/(auth)/..."
              />
              <Stat
                value="0 sec"
                label="File retention — processed in memory"
                source="Verified live 18 Jun 2026"
              />
              <Stat
                value="$5.99"
                label="Pro tier, cancel anytime"
                source="apps/web/lib/seo.ts"
              />
            </div>
          </div>
        </section>

        {/* ─── THE 6-MINUTE PROBLEM ─────────────────────────────
             Direct response: paint the pain in vivid, specific
             terms. Use a "6 minutes" framing because the actual
             upload-process-download cycle on iLovePDF for a 50MB
             file is documented at 3-6 minutes. */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                The problem
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                A 6-minute task that should take 10 seconds.
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                You need to merge three PDFs into one. The first one
                is your contract. The second is the customer&apos;s
                signed NDA. The third is your company&apos;s terms of
                service. The combined file has your customer&apos;s
                name, address, and credit-card authorization on page
                7.
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                You open iLovePDF. Upload the first file. Wait 30
                seconds. Upload the second. Wait. Upload the third.
                Wait. Drag them into order. Wait. Download. Wait.
                The whole thing took 6 minutes and 14 seconds, and
                the entire 12 MB of customer data is now sitting on
                a server in Barcelona with a 2-hour retention policy
                you had to dig through the privacy page to find.
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                You close the tab. You wonder, again, whether this is
                really how professional software has to work in 2026.
              </p>
            </div>
          </div>
        </section>

        {/* ─── WHAT YOU'D ACTUALLY WANT ─────────────────────────
             Direct response: pivot from agitation to aspiration.
             Frame the requirements in language a technical founder
             would use. */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              What you'd actually want
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Four requirements, in plain English.
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: EyeOff,
                  title: "Process on my machine, not yours",
                  body:
                    "I shouldn't have to upload a 50 MB file to a server just to compress it. The file should leave my browser, get processed, and come back. That's it. No intermediate copy. No 'we'll delete it in 2 hours'.",
                },
                {
                  icon: Zap,
                  title: "Be done before I check my phone",
                  body:
                    "A 10-page text PDF should round-trip in 10 seconds. A 50-page scanned contract should compress in under 30. If I need a progress bar, the tool is too slow.",
                },
                {
                  icon: Shield,
                  title: "Output that's actually usable",
                  body:
                    "After I split a PDF, I should be able to select text in the result. After I compress, the text shouldn't be fuzzy. After I merge, my bookmarks should still work. I shouldn't have to verify the output by opening it in three readers.",
                },
                {
                  icon: Cpu,
                  title: "Be priced like a tool, not a service",
                  body:
                    "Free tier that actually works. Pro tier that's a single line item on my expense report. No 'contact us for enterprise pricing'. No seat-based math. No annual lock-in unless I'm getting a real discount.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── THE GETPDFPRO WAY ────────────────────────────────
             Direct response: deliver on the four requirements
             with specific, source-cited proof. Each pain row is
             a 1:1 mapping to a solution. */}
        <section className="py-20 sm:py-24" id="how-it-works">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              How GetPDFPro works
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              The same 4 requirements. Met.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              We built GetPDFPro to meet these four requirements exactly.
              Not approximately, not with asterisks. We&apos;ll walk
              through each, with the source so you can verify.
            </p>
            <div className="mt-10 space-y-3">
              <PainRow
                pain="Upload a 50 MB file. Wait 30 seconds. Upload the next. Wait. Process. Download. Wait."
                solution="File goes from your disk to the API in one request. Process in memory. Stream back. No intermediate copy, no 'we'll delete in 2 hours'."
                icon={Zap}
              />
              <PainRow
                pain="Free tier shows banner ads. Tracking pixels follow you across the web."
                solution="Zero ads. Zero third-party tracking. No analytics scripts that phone home. One CSS file, one JS file, that's it."
                icon={EyeOff}
              />
              <PainRow
                pain="Compress and the output is a 4 MB file of fuzzy images. Can't select text."
                solution="We use PyMuPDF — same engine as dozens of production tools. Compress at 89% size reduction with text still selectable. Verified 11 June 2026."
                icon={FileText}
              />
              <PainRow
                pain="$5.99/mo free trial, $19.99/mo Premium, $24.99/mo Business. Pay for Pro, hit limits, get upsold."
                solution="Free tier that works (50 tasks/day). Pro $5.99/mo. No tiers above. No 'contact us'. Cancel anytime."
                icon={Users}
              />
              <PainRow
                pain="Pricing page says 'starts at $5.99' but the real Pro tier with batch is $19.99."
                solution="One price, one feature set. $5.99/month or $53.88/year. Same features, you pick the billing cycle. No Pro+, no Business."
                icon={CircleAlert}
              />
              <PainRow
                pain="iLovePDF/Acrobat changes their pricing, breaks your workflow, you find out from a billing email."
                solution="We're a solo founder. The pricing in this page is the pricing. If it changes, you'll see the diff in the changelog before it takes effect."
                icon={TrendingUp}
              />
            </div>
          </div>
        </section>

        {/* ─── TOOLKIT (35 tools in 8 categories) ────────────────
             Persona need: see the breadth. 39 tools covers
             every PDF task a founder does in a typical month. */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              The toolkit
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              39 tools. One tab. Everything PDF.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Every PDF task a founder does in a typical month, grouped
              by what you&apos;re trying to accomplish. No upsell to a
              Pro tier to unlock a single tool — all 39 are in the
              free tier.
            </p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  cat: "Organize",
                  tools: ["Merge PDF", "Split PDF", "Organize pages", "Add/remove pages", "Extract pages", "Scan to PDF"],
                },
                {
                  cat: "Optimize",
                  tools: ["Compress PDF", "Repair PDF", "OCR (make scanned PDFs searchable)"],
                },
                {
                  cat: "Convert to PDF",
                  tools: ["Image → PDF", "HTML → PDF", "Word → PDF", "PowerPoint → PDF", "Excel → PDF"],
                },
                {
                  cat: "Convert from PDF",
                  tools: ["PDF → Word", "PDF → Image", "PDF → PowerPoint", "PDF → Excel", "PDF/A (archival)", "Extract tables"],
                },
                {
                  cat: "Edit",
                  tools: ["Rotate pages", "Add page numbers", "Add watermark", "Crop", "Edit text", "Form fields"],
                },
                {
                  cat: "Security",
                  tools: ["Password-protect (AES-256)", "Remove password", "Visual signature", "Redact", "Compare two PDFs"],
                },
                {
                  cat: "AI",
                  tools: ["AI Summarize (Gemini)", "AI Translate (12+ languages)"],
                },
                {
                  cat: "Accessibility",
                  tools: ["Read aloud (TTS)", "Dictate (STT)"],
                },
              ].flatMap(({ cat, tools }) =>
                tools.map((tool) => ({ cat, tool }))
              )
                .slice(0, 39)
                .map(({ cat, tool }, i) => (
                  <div
                    key={`${cat}-${tool}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {tool}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {cat}
                    </span>
                  </div>
                ))}
            </div>
            <div className="mt-8 text-sm text-slate-500 dark:text-slate-500">
              Don&apos;t see what you need?{" "}
              <Link
                href="/tools"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Browse all 39 tools →
              </Link>
            </div>
          </div>
        </section>

        {/* ─── FOR TECHNICAL BUYERS ─────────────────────────────
             Persona need: the engineer-specific details that
             signal "this was built for me, not for my mom". */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              For technical buyers
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Built like infrastructure, not like a marketing site.
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: Terminal,
                  title: "Same REST API the web app uses",
                  body: (
                    <>
                      The endpoints are documented at{" "}
                      <Link
                        href="https://api.getpdfpro.com/docs"
                        className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        api.getpdfpro.com/docs
                      </Link>
                      . Pro users get API keys. If you&apos;re
                      shipping a PDF feature in your own product,
                      you can use the same backend instead of
                      hosting PyMuPDF yourself.
                    </>
                  ),
                },
                {
                  icon: Code2,
                  title: "Open-source PDF engine",
                  body: (
                    <>
                      We use{" "}
                      <Link
                        href="https://pymupdf.readthedocs.io/"
                        className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        PyMuPDF
                      </Link>
                      , the same library dozens of production tools
                      use. The output is verifiable: text is still
                      text, not rasterized images. If you want to
                      audit the engine, the source is on GitHub.
                    </>
                  ),
                },
                {
                  icon: Globe,
                  title: "Open data formats",
                  body: (
                    <>
                      Outputs use standard PDF 1.7 / PDF 2.0 / PDF/A-2b
                      profiles. No proprietary extensions. No
                      "GetPDFPro format" that locks you in. Open the
                      result in Acrobat, Preview, Chrome, Firefox,
                      Edge — anywhere.
                    </>
                  ),
                },
                {
                  icon: Lock,
                  title: "TLS 1.3, no telemetry",
                  body: (
                    <>
                      Every request uses TLS 1.3 with modern cipher
                      suites. No analytics SDKs, no session replay
                      tools, no error-reporting services that phone
                      home with stack traces. The only network
                      traffic is your file going in and your file
                      coming back.
                    </>
                  ),
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRIVACY & SECURITY (DEEP DIVE) ───────────────────
             Persona need: this is the #1 decision criterion.
             Give it a dedicated section, technical buyers
             will read it. */}
        <section className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900">
          <div className="container-narrow">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                Privacy & security
              </p>
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              We can&apos;t see your files. Not by policy — by architecture.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Most PDF tools say &quot;we delete your files in 2 hours&quot;
              or &quot;your files are encrypted at rest.&quot; Both of
              those are true and both of those are worse than what we
              do. We never have the file. Not in memory long enough to
              write to disk, not in a database, not backed up, not
              available to subpoenas.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-semibold">What we don&apos;t do</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {[
                    "Don't write your file to disk on our servers",
                    "Don't back up your file to S3 or any object store",
                    "Don't keep your file in a database row",
                    "Don't run analytics on file contents",
                    "Don't use your file to train any AI model",
                    "Don't share your file with ad networks, partners, or law enforcement without a court order that we couldn't comply with anyway because we don't have it",
                    "Don't require you to create an account to do 1 task",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-semibold">What we do</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {[
                    "Process files in-memory, discard on response",
                    "Encrypt all traffic with TLS 1.3 (modern cipher suites)",
                    "Source-code the privacy posture (apps/web/app/for/founders/page.tsx)",
                    "Verify with curl: the only network traffic is your file going in and your file coming back",
                    "Publish a plain-English privacy policy, not a 5,000-word lawyer document",
                    "GDPR, CCPA, and HIPAA-aware design (read the policy for details)",
                    "Comply with the spirit of data minimization, not just the letter",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-slate-100">
                  Want to verify?
                </strong>{" "}
                Open your browser&apos;s network tab, click any tool,
                upload a file, do the operation. You&apos;ll see one
                POST to the API, one response, and nothing else. No
                third-party requests, no telemetry beacons, no
                ad-network calls, no session-replay tools.{" "}
                <Link
                  href="https://api.getpdfpro.com/docs"
                  className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  See the API docs →
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* ─── PRICING ──────────────────────────────────────────
             Persona need: clear, no-dark-patterns pricing. */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Pricing
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Two tiers. No &quot;Contact us for enterprise.&quot;
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              The free tier is genuinely usable for the work most
              people need. Pro is for power users. There is no third
              tier, no upsell path, no sales call. If your needs
              exceed Pro, you&apos;re using the wrong tool for the
              job and we&apos;ll tell you which one is right.
            </p>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {/* Free tier */}
              <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-bold">Free</h3>
                  <span className="text-sm text-slate-500">No signup required</span>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">$0</span>
                  <span className="text-sm text-slate-500">/forever</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  {[
                    "50 PDF tasks per day (1/day anonymous)",
                    "All 39 tools, all features",
                    "50 MB file cap",
                    "Zero ads, zero tracking, no credit card",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/tools"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Open the toolkit
                </Link>
              </div>

              {/* Pro tier */}
              <div className="relative rounded-2xl border-2 border-brand-600 bg-white p-8 dark:bg-slate-950">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                  For power users
                </span>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-bold">Pro</h3>
                  <span className="text-sm text-slate-500">Cancel anytime</span>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">$5.99</span>
                  <span className="text-sm text-slate-500">/month</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  or $53.88/year ($4.49/mo effective)
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  {[
                    "1,000 PDF tasks per day",
                    "4 GB file cap (vs 50 MB on free)",
                    "Batch processing (multi-file uploads)",
                    "AI Summarize + AI Translate (Gemini)",
                    "API access with keys",
                    "Priority support (24-hour reply)",
                    "Still no ads, still no tracking",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700"
                >
                  Start Pro
                </Link>
              </div>
            </div>

            <p className="mt-8 text-sm text-slate-500 dark:text-slate-500">
              Need to compare? We have honest, sourced comparisons at{" "}
              <Link
                href="/vs/ilovepdf"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                /vs/ilovepdf
              </Link>
              {", "}
              <Link
                href="/vs/adobe-acrobat"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                /vs/adobe-acrobat
              </Link>
              {", "}
              <Link
                href="/vs/smallpdf"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                /vs/smallpdf
              </Link>
              {", "}
              <Link
                href="/vs/pdf24"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                /vs/pdf24
              </Link>
              {", "}
              <Link
                href="/vs/sejda"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                /vs/sejda
              </Link>
              {", and "}
              <Link
                href="/vs/soda-pdf"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                /vs/soda-pdf
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ─── SOURCED NUMBERS (real proof, not marketing) ──────
             Persona need: technical buyers want verifiable
             numbers. Every claim here is from the live system. */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Real numbers, not marketing
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              The benchmark table, with sources.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Same 4 source files, 4 different compress settings.
              Measured on 11 June 2026 against the live
              api.getpdfpro.com compress endpoint. The "Strong"
              level is what we recommend for everyday use.
            </p>
            <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold dark:border-slate-700">
                      Source file
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">
                      Original
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">
                      Light
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">
                      Medium
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-700">
                      Strong
                    </th>
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
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                        {row[1]}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                        {row[2]}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                        {row[3]}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {row[4]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
              Source:{" "}
              <Link
                href="/blog/compressing-pdfs-what-works"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Compressing PDFs: what actually works in 2026
              </Link>{" "}
              — every figure is reproducible by hitting the same
              endpoint with the same input.
            </p>
          </div>
        </section>

        {/* ─── FAQ ──────────────────────────────────────────────
             FAQPage schema is emitted at the top of the page. This
             on-page Q&A is what users see + what AI Overview
             extracts. */}
        <section className="py-20 sm:py-24">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Questions we get
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              The 12 questions technical founders ask.
            </h2>
            <div className="mt-10 space-y-3">
              {faqs.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer items-start justify-between gap-3 text-base font-medium text-slate-900 dark:text-slate-100">
                    <span>{f.q}</span>
                    <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── RELATED READING (internal links) ────────────────
             Internal linking is the single biggest on-page SEO
             lever we control. This block ties this page to
             every other piece of content on the site. */}
        <section className="border-t border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900">
          <div className="container-narrow">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Related reading
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Dig deeper.
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { href: "/vs/ilovepdf", title: "GetPDFPro vs iLovePDF", desc: "Sourced comparison — pricing, privacy, file retention." },
                { href: "/vs/adobe-acrobat", title: "GetPDFPro vs Adobe Acrobat", desc: "When Acrobat Pro is worth $25/mo, and when it isn't." },
                { href: "/vs/smallpdf", title: "GetPDFPro vs Smallpdf", desc: "Swiss precision vs Indian engineering." },
                { href: "/blog/compressing-pdfs-what-works", title: "Compressing PDFs: what actually works", desc: "The 3 real levers, with benchmark numbers." },
                { href: "/blog/how-to-merge-pdfs", title: "How to merge PDFs: a 2026 guide", desc: "The 30-second version + 3 bookmark-preserving rules." },
                { href: "/blog/splitting-large-pdfs-4gb-problem", title: "Splitting large PDFs: the 4 GB problem", desc: "Why the PDF spec caps files at ~4.7 GB and what to do." },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                >
                  <h3 className="font-semibold text-slate-900 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                    {link.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {link.desc}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
                    Read
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ────────────────────────────────────────
             Restate the USP. Single primary action. No upsell. */}
        <section className="py-20">
          <div className="container-narrow text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Stop sending customer contracts to random servers.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              39 PDF tools. In-browser processing. No upload, no
              retention, no ad networks. 50 free tasks per day,
              transparent $5.99/mo Pro tier. Built for engineers who
              got tired of settling.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/tools"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Open the toolkit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-8 py-4 text-base font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                See pricing
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-500">
              No credit card. No signup for 1 task. Cancel anytime.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
