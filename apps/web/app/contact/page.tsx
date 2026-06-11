import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SITE_NAME, SITE_URL, ldJson, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the ${SITE_NAME} team.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const ld = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "Contact", url: `${SITE_URL}/contact` },
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
            Contact
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            We read every message. Pick whichever channel works for you.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold">General &amp; support</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Questions about the product, account help, feature
                requests.
              </p>
              <a
                href="mailto:support@getpdfpro.com"
                className="mt-4 inline-block font-medium text-brand-600 hover:text-brand-700"
              >
                support@getpdfpro.com
              </a>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold">Founder</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                For partnerships, press, or to send a beta invite to a
                friend.
              </p>
              <a
                href="mailto:salim@getpdfpro.com"
                className="mt-4 inline-block font-medium text-brand-600 hover:text-brand-700"
              >
                salim@getpdfpro.com
              </a>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold">Privacy &amp; data</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Data access, deletion requests, GDPR/CCPA inquiries.
              </p>
              <a
                href="mailto:privacy@getpdfpro.com"
                className="mt-4 inline-block font-medium text-brand-600 hover:text-brand-700"
              >
                privacy@getpdfpro.com
              </a>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold">Security disclosures</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Responsible disclosure of vulnerabilities. We respond
                within 48 hours.
              </p>
              <a
                href="mailto:security@getpdfpro.com"
                className="mt-4 inline-block font-medium text-brand-600 hover:text-brand-700"
              >
                security@getpdfpro.com
              </a>
            </div>
          </div>

          <p className="mt-12 text-sm text-slate-500">
            Response time: typically within 1 business day. For
            Pro/beta users, same-day responses during business hours.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
