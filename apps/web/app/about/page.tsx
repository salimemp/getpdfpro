import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SITE_NAME, SITE_URL, ldJson, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About",
  description: `About ${SITE_NAME} — privacy-first PDF tools built for the browser.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const ld = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "About", url: `${SITE_URL}/about` },
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(ld)}
        />
        <div className="container-narrow py-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            About {SITE_NAME}
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            {SITE_NAME} is a privacy-first PDF toolkit for the browser. Built
            in 2026 by a small team that wanted a better alternative to
            the existing PDF sites.
          </p>

          <div className="prose prose-slate dark:prose-invert mt-12 max-w-none">
            <h2>What we believe</h2>
            <ul>
              <li>
                <strong>Your files are yours.</strong> We process them in
                memory and discard them immediately after the response.
                We don&apos;t train on them, index them, or keep a copy
                on our servers.
              </li>
              <li>
                <strong>Generous free tier.</strong> Most PDF sites
                gate you after 1-2 tasks to force a sign-up or
                payment. We give signed-in users 50 tasks per day for
                free.
              </li>
              <li>
                <strong>Honest pricing.</strong> $3.99/mo or $24/year
                for Pro. No dark patterns, no annual-only traps, no
                surprise charges. 30-day money-back.
              </li>
              <li>
                <strong>Open about limits.</strong> The fast track caps
                at 50 MB per file. Pro lifts that to 4 GB. We tell you
                up front.
              </li>
            </ul>

            <h2>Who built it</h2>
            <p>
              {SITE_NAME} is built and operated by a solo founder
              (Salim) based in India. The product is built on open
              source: Next.js on the web, FastAPI + PyMuPDF on the
              backend, Supabase for auth, Cloudflare R2 for storage,
              Stripe for billing.
            </p>

            <h2>Contact</h2>
            <p>
              Questions, feature requests, or bug reports? Email{" "}
              <a href="mailto:salim@getpdfpro.com">
                salim@getpdfpro.com
              </a>
              . We read every message.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
