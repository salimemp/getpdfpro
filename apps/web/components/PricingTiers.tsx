"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuota } from "@/lib/quota";

type BillingInterval = "monthly" | "yearly";

const FEATURES_FREE = [
  "50 tasks per day",
  "Up to 100 MB per file",
  "Merge, split, compress, convert",
  "All 25+ languages",
  "Email support",
];

const FEATURES_PRO = [
  "1,000 tasks per day",
  "Up to 4 GB per file",
  "All current and future tools",
  "AI features (summarize, translate, chat)",
  "Batch processing (multiple at once)",
  "Priority email + chat support",
  "Cancel anytime, 30-day refund",
];

export function PricingTiers() {
  const auth = useAuth();
  const quota = useQuota();
  const [interval, setInterval] = useState<BillingInterval>("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthlyPrice = 3.99;
  const yearlyPrice = 24;
  const yearlyPerMonth = (yearlyPrice / 12).toFixed(2); // $2.00/mo equivalent
  const yearlySavingsPct = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);

  const onUpgrade = async () => {
    if (!auth.user) {
      // Not signed in — send to signup first
      window.location.href = "/signup?next=/pricing";
      return;
    }
    if (!isStripeConfigured()) {
      setError(
        "Stripe checkout is being wired up. Use the 'Claim your beta spot' option below to get Pro for free during the beta."
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { createCheckoutSession } = await import("@/lib/api");
      const { url } = await createCheckoutSession(interval, {
        id: auth.user.id,
        email: auth.user.email || "",
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="mt-12">
      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-sm dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-4 py-1.5 transition ${
              interval === "monthly"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition ${
              interval === "yearly"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Yearly
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-800 dark:bg-green-900 dark:text-green-200">
              Save {yearlySavingsPct}%
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {/* Free */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-semibold">Free</h3>
          <p className="mt-1 text-sm text-slate-500">
            For everyday PDF work
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">$0</span>
            <span className="text-sm text-slate-500">/forever</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {quota.used > 0 && auth.user
              ? `${quota.remaining} of ${quota.limit} tasks left today`
              : "50 tasks / day · 100 MB max file size"}
          </p>
          <Link
            href={auth.user ? "/tools" : "/signup"}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {auth.user ? "Use the tools" : "Sign up free"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <ul className="mt-6 space-y-3 text-sm">
            {FEATURES_FREE.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro (highlighted) */}
        <div className="relative rounded-2xl border-2 border-brand-600 bg-white p-6 shadow-lg dark:bg-slate-900">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Most popular
          </span>
          <h3 className="text-lg font-semibold">Pro</h3>
          <p className="mt-1 text-sm text-slate-500">
            For power users and teams
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">
              ${interval === "monthly" ? monthlyPrice : yearlyPerMonth}
            </span>
            <span className="text-sm text-slate-500">/month</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {interval === "monthly" ? (
              <>Billed monthly · ${monthlyPrice}/mo</>
            ) : (
              <>
                ${yearlyPrice}/year · <span className="text-green-600 font-medium">save {yearlySavingsPct}%</span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {auth.user ? "Upgrade to Pro" : "Get Pro"}
              </>
            )}
          </button>
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <ul className="mt-6 space-y-3 text-sm">
            {FEATURES_PRO.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Beta (limited) */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
          <h3 className="text-lg font-semibold">Beta</h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Free for the first 100
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">$0</span>
            <span className="text-sm text-amber-700 dark:text-amber-300">/6 months</span>
          </div>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            All Pro features · No card required
          </p>
          <Link
            href="/beta"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
          >
            Claim your spot
            <ArrowRight className="h-4 w-4" />
          </Link>
          <ul className="mt-6 space-y-3 text-sm text-amber-900 dark:text-amber-100">
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>Everything in Pro</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>6 months free (then you decide)</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>Direct line to the founder for feedback</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Honest positioning — we only compare on what we can source.
          We don't put competitor prices on this page because we don't
          want to be wrong about them. The /vs/ilovepdf page has a
          sourced comparison for users who want to dig deeper. */}
      <p className="mt-8 text-center text-sm text-slate-500">
        Pro at <strong>$3.99/mo</strong> is built on the same pay-what-you-need
        principle as the rest of GetPDFPro: enough margin to keep the
        service running, not enough to gate everyday work behind a
        paywall. For a sourced feature comparison, see{" "}
        <a
          href="/vs/ilovepdf"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          GetPDFPro vs iLovePDF
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Returns true if Stripe is configured in the environment. The
 * build-time flag STRIPE_ENABLED is set on the web deploy (or
 * omitted if Stripe isn't ready yet).
 */
function isStripeConfigured(): boolean {
  // Process env is replaced at build time. We bake in a flag rather
  // than reading the secret directly here, so we never accidentally
  // ship the publishable key check to the client.
  return (
    typeof process !== "undefined" &&
    Boolean(process.env.NEXT_PUBLIC_STRIPE_ENABLED)
  );
}
