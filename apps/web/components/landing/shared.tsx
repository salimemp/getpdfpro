/**
 * Shared components for the /for/* landing pages.
 *
 * Each landing page (founders, designers, legal, businesses) has the
 * same architecture — only the persona-specific copy differs. These
 * components are the building blocks reused across all four pages.
 */

import type React from "react";
import {
  Check,
  X,
  ArrowRight,
} from "lucide-react";

// ─── Small proof badge (inline, e.g. next to a heading) ──────
export function Proof({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      <Check className="h-3 w-3" />
      {children}
    </span>
  );
}

// ─── Stat card — big number + label + optional source line ────
export function Stat({
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

// ─── "You do this / We do this" comparison row ────────────────
export function PainRow({
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

// ─── "Don't do / Do" two-column privacy-style block ───────────
export function DoDontList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "do" | "dont";
}) {
  const Icon = variant === "do" ? Check : X;
  const colorClass =
    variant === "do"
      ? "text-emerald-500"
      : "text-red-500";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${colorClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Check-bullet list (used in pricing + privacy blocks) ─────
export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Feature card (icon + title + body) — used in "4 requirements"
///    and "for technical buyers" sections ─────────────────────
export function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
        {body}
      </p>
    </div>
  );
}

// ─── Related reading block (internal links to /vs/* and /blog/*) ─
export function RelatedReading({
  heading = "Dig deeper.",
  label = "Related reading",
  links,
}: {
  heading?: string;
  label?: string;
  links: { href: string; title: string; desc: string }[];
}) {
  return (
    <section className="border-t border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900">
      <div className="container-narrow">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          {label}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {heading}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <a
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
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing block (Free + Pro) ──────────────────────────────
export function PricingBlock() {
  return (
    <section className="py-20 sm:py-24">
      <div className="container-narrow">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Pricing
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Two tiers. No &quot;Contact us for enterprise.&quot;
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          The free tier is genuinely usable for the work most people
          need. Pro is for power users. There is no third tier, no
          upsell path, no sales call.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl font-bold">Free</h3>
              <span className="text-sm text-slate-500">No signup required</span>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight">$0</span>
              <span className="text-sm text-slate-500">/forever</span>
            </div>
            <CheckList
              items={[
                "50 PDF tasks per day (1/day anonymous)",
                "All 39 tools, all features",
                "50 MB file cap",
                "Zero ads, zero tracking, no credit card",
              ]}
            />
            <a
              href="/tools"
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open the toolkit
            </a>
          </div>

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
            <CheckList
              items={[
                "1,000 PDF tasks per day",
                "4 GB file cap (vs 50 MB on free)",
                "Batch processing (multi-file uploads)",
                "AI Summarize + AI Translate (Gemini)",
                "API access with keys",
                "Priority support (24-hour reply)",
                "Still no ads, still no tracking",
              ]}
            />
            <a
              href="/signup"
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700"
            >
              Start Pro
            </a>
          </div>
        </div>

        <p className="mt-8 text-sm text-slate-500 dark:text-slate-500">
          Want to compare? Honest, sourced comparisons at{" "}
          <a href="/vs/ilovepdf" className="font-medium text-brand-600 hover:underline dark:text-brand-400">/vs/ilovepdf</a>,{" "}
          <a href="/vs/adobe-acrobat" className="font-medium text-brand-600 hover:underline dark:text-brand-400">/vs/adobe-acrobat</a>,{" "}
          <a href="/vs/smallpdf" className="font-medium text-brand-600 hover:underline dark:text-brand-400">/vs/smallpdf</a>,{" "}
          <a href="/vs/pdf24" className="font-medium text-brand-600 hover:underline dark:text-brand-400">/vs/pdf24</a>,{" "}
          <a href="/vs/sejda" className="font-medium text-brand-600 hover:underline dark:text-brand-400">/vs/sejda</a>,{" "}
          <a href="/vs/soda-pdf" className="font-medium text-brand-600 hover:underline dark:text-brand-400">/vs/soda-pdf</a>.
        </p>
      </div>
    </section>
  );
}

// ─── Social proof bar (Stat row) ──────────────────────────────
export function SocialProofBar({ stats }: {
  stats: { value: string; label: string; source?: string }[];
}) {
  return (
    <section className="border-b border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="container-narrow">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA block ─────────────────────────────────────────
export function FinalCta({
  headline,
  body,
  primaryCta,
  secondaryCta,
}: {
  headline: string;
  body: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
}) {
  return (
    <section className="py-20">
      <div className="container-narrow text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {headline}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          {body}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={primaryCta.href}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {primaryCta.label}
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={secondaryCta.href}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-8 py-4 text-base font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {secondaryCta.label}
          </a>
        </div>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-500">
          No credit card. No signup for 1 task. Cancel anytime.
        </p>
      </div>
    </section>
  );
}

// ─── FAQ section (using <details> for native HTML, FAQPage schema
//      emitted separately by the page) ───────────────────────
export function FaqSection({
  label = "Questions we get",
  heading,
  faqs,
}: {
  label?: string;
  heading: string;
  faqs: { q: string; a: string }[];
}) {
  return (
    <section className="py-20 sm:py-24">
      <div className="container-narrow">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          {label}
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {heading}
        </h2>
        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-3 text-base font-medium text-slate-900 dark:text-slate-100">
                <span>{f.q}</span>
                <span className="text-slate-400 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
