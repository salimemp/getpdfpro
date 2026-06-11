import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { BetaClaimForm } from "@/components/BetaClaimForm";

export const metadata: Metadata = {
  title: "Beta launch — first 100 users",
  description:
    "Get 6 months of Pro for free during the GetPDFPro beta. First 100 users only.",
  alternates: { canonical: "/beta" },
};

export default function BetaPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="container-narrow py-16">
          <div className="mx-auto max-w-xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              Beta launch
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              6 months of Pro, on us.
            </h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
              We&apos;re giving the first <strong>100 users</strong> free
              Pro access for 6 months. No card. No catch. Just honest
              feedback in return.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-md">
            <Suspense fallback={null}>
              <BetaClaimForm />
            </Suspense>
          </div>

          <div className="mx-auto mt-12 max-w-2xl">
            <h2 className="text-center text-2xl font-bold tracking-tight">
              What you get as a beta tester
            </h2>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "1,000 tasks per day (vs 50 for free)",
                "Up to 4 GB per file (vs 100 MB for free)",
                "Every Pro feature unlocked — AI tools, batch processing, priority support",
                "Direct line to the founder (me) for feature requests, bugs, or just to say hi",
                "Locked-in pricing: if we ever raise prices, your rate stays the same",
                "6 months free. After that, downgrade to free or stay on Pro at $2.99/mo — your call",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-center text-xs text-slate-500">
              No card. Cancel anytime. Beta access automatically converts
              to free at the end of 6 months.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
