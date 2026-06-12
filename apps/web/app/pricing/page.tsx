import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PricingTiers } from "@/components/PricingTiers";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "The most generous free tier of any PDF tool. Pro starts at $5.99/month, or $4.49/month on the annual plan (save 25%) — lower than iLovePDF, Smallpdf, Adobe, anyone.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="container-narrow py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Pricing that doesn&apos;t try to trap you.
            </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            50 free tasks a day for signed-in users. Pro is
            $5.99/month — or $4.49/month on the annual plan (save 25%) —
            if you need more. Cancel anytime, 30-day refund.
          </p>
          </div>

          <PricingTiers />

          {/* Beta banner */}
          <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950/40">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Beta launch — first 100 users
            </p>
            <p className="mt-2 text-amber-900 dark:text-amber-100">
              We&apos;re giving the first 100 sign-ups <strong>6 months of Pro for free</strong>.
              No card required. Just claim your spot.
            </p>
            <Link
              href="/beta"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
            >
              Claim your beta spot →
            </Link>
          </div>

          {/* FAQ */}
          <div className="mt-16">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Frequently asked
            </h2>
            <div className="mt-8 space-y-4">
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
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

const faqs = [
  {
    q: "Why is the free tier so generous?",
    a: "Because we actually want you to use the product. Most PDF tools gate you after 1-2 tasks to force a sign-up or payment. We'd rather you tell your friends and come back when you need more.",
  },
  {
    q: "What counts as a 'task'?",
    a: "Each tool use is one task. Merging 3 PDFs = 1 task. Compressing 1 PDF = 1 task. Splitting a 10-page PDF = 1 task (output ZIP, still one operation).",
  },
  {
    q: "Can I switch between plans?",
    a: "Yes. Upgrade, downgrade, or cancel any time from your account page. Pro-rated to the day.",
  },
  {
    q: "Do you store my files?",
    a: "No. Files are processed in memory and discarded immediately after the response is sent. We don't keep a copy, we don't train on them, we don't have a folder of your PDFs sitting on a server somewhere.",
  },
  {
    q: "What about bigger files?",
    a: "Pro supports up to 4 GB per file. The fast track (no account) is capped at 100 MB to keep things fast for everyone.",
  },
  {
    q: "What's the catch?",
    a: "No catch. We make money from the 1% of users who need more than the free tier provides. That's enough to keep the lights on.",
  },
  {
    q: "Will the price go up?",
    a: "We won't raise prices for existing users. If we change pricing for new users, your locked-in rate stays.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes — 30-day money-back, no questions asked. Just email support@getpdfpro.com.",
  },
];
