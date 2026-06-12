import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SITE_NAME, SITE_URL, ldJson, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing your use of ${SITE_NAME}.`,
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const ld = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "Terms of Service", url: `${SITE_URL}/terms` },
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(ld)}
        />
        <article className="container-narrow py-16 prose prose-slate dark:prose-invert max-w-none">
          <h1>Terms of Service</h1>
          <p className="text-sm text-slate-500">Last updated: 11 June 2026</p>

          <h2>1. Acceptance</h2>
          <p>
            By accessing or using {SITE_NAME} (the &quot;Service&quot;),
            you agree to these Terms. If you don&apos;t agree, please
            don&apos;t use the Service.
          </p>

          <h2>2. The Service</h2>
          <p>
            {SITE_NAME} provides browser-based PDF processing tools
            (merge, split, compress, convert, and related
            operations). The Service processes files in memory and
            does not store your files. See our{" "}
            <a href="/privacy">Privacy Policy</a> for details.
          </p>

          <h2>3. Eligibility</h2>
          <p>
            You must be at least 13 years old to use the Service. If
            you&apos;re under 18, you confirm that a parent or legal
            guardian has reviewed and agreed to these Terms on your
            behalf.
          </p>

          <h2>4. Acceptable use</h2>
          <p>You agree <strong>not</strong> to use the Service to:</p>
          <ul>
            <li>
              Process files that contain malware, illegal content, or
              content that infringes intellectual property rights
            </li>
            <li>
              Attempt to disrupt the Service (DDoS, brute-force
              sign-ins, scraping, etc.)
            </li>
            <li>
              Reverse-engineer, decompile, or otherwise extract
              proprietary code
            </li>
            <li>
              Use the Service in any way that violates applicable law
            </li>
            <li>
              Resell or sublicense access to the Service without our
              written permission
            </li>
          </ul>

          <h2>5. Your content</h2>
          <p>
            <strong>You own your files.</strong> We claim no rights
            over the content you upload. We don&apos;t use it for
            training, marketing, or anything else. We process it
            in-memory and discard it.
          </p>
          <p>
            You&apos;re responsible for the legality of the files you
            process. If you upload copyrighted material without
            permission, that&apos;s between you and the rights holder —
            we&apos;re not involved.
          </p>

          <h2>6. Plans and payment</h2>
          <h3>Free</h3>
          <p>
            50 PDF tasks per day for signed-in users, 1 task per day
            for anonymous users, capped at 50 MB per file. No payment
            required.
          </p>

          <h3>Pro</h3>
          <p>
            $5.99/month, or $4.49/month on the annual plan
            ($53.88/year — save 25%). 1,000 tasks per day, up to 4 GB
            per file, AI features, batch processing, priority
            support. Billed via Stripe. Cancel anytime, 30-day money-back.
          </p>

          <h3>Beta</h3>
          <p>
            Free for 6 months for the first 100 users who claim a
            spot. No card required. After 6 months, the account
            automatically reverts to Free unless you upgrade.
          </p>

          <h2>7. Refunds</h2>
          <p>
            Pro plans are refundable for 30 days from purchase, no
            questions asked. Email{" "}
            <a href="mailto:support@getpdfpro.com">support@getpdfpro.com</a>{" "}
            with your account email and we&apos;ll process the
            refund.
          </p>

          <h2>8. Service availability</h2>
          <p>
            We aim for 99.9% uptime but don&apos;t guarantee it. The
            Service is provided &quot;as is&quot;. We&apos;ll do our best to
            keep it running and to notify you of planned downtime.
          </p>
          <p>
            If the Service is down, you&apos;re entitled to a
            pro-rated credit on your Pro subscription. Free and Beta
            users aren&apos;t entitled to compensation.
          </p>

          <h2>9. Changes to the Service</h2>
          <p>
            We may add, modify, or remove features at any time. If we
            remove a feature you&apos;re paying for, we&apos;ll offer a
            pro-rated refund. We&apos;ll give at least 30 days&apos; notice
            for breaking changes to Pro features.
          </p>

          <h2>10. Account suspension</h2>
          <p>
            We may suspend or terminate accounts that violate these
            Terms. We&apos;ll always contact you first and give you a
            chance to fix the issue, except in cases of clear abuse
            (e.g. processing malware).
          </p>

          <h2>11. Disclaimers and limitation of liability</h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, express or
            implied, including but not limited to warranties of
            merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted,
            error-free, or that defects will be corrected. We do not
            warrant the results obtained from using the Service.
          </p>
          <p>
            <strong>To the maximum extent permitted by law</strong>,
            our total liability for any claim arising from or
            related to the Service shall not exceed the greater of (a)
            the amount you paid us in the 12 months preceding the
            claim, or (b) USD $100.
          </p>

          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify and hold us harmless from any claim
            or demand arising from your use of the Service in
            violation of these Terms or applicable law.
          </p>

          <h2>13. Governing law and disputes</h2>
          <p>
            These Terms are governed by the laws of India. Any
            disputes shall be resolved in the courts of Bengaluru,
            India, except where consumer protection laws of your
            jurisdiction provide otherwise.
          </p>
          <p>
            If you&apos;re a consumer in the EEA, you may also bring
            disputes to the European Commission&apos;s Online Dispute
            Resolution platform.
          </p>

          <h2>14. Changes to these Terms</h2>
          <p>
            We may update these Terms. The &quot;Last updated&quot; date
            at the top reflects the most recent change. Material
            changes will be communicated via email (for signed-in
            users) and a banner on the home page. Continued use after
            a change means you accept the new Terms.
          </p>

          <h2>15. Contact</h2>
          <p>
            Email <a href="mailto:legal@getpdfpro.com">legal@getpdfpro.com</a>{" "}
            for any questions about these Terms.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
