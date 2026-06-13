import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

import { CookieSettingsButton } from '@/components/CookieSettingsButton';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'Terms governing your use of GetPDFPro. Covers acceptable use, account rules, intellectual property, and disclaimers.',
};

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Terms of Use</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Last updated: 13 June 2026
      </p>

      <Section title="1. Acceptance of terms">
        <p>
          By accessing or using getpdfpro.com or any GetPDFPro application
          (the "Service"), you agree to be bound by these Terms of Use ("Terms").
          If you do not agree, do not use the Service.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <p>
          You must be at least 16 years old (or the age of digital consent in
          your jurisdiction) to use the Service. By using it, you represent
          that you meet this requirement.
        </p>
      </Section>

      <Section title="3. Account responsibilities">
        <p>
          If you create an account, you are responsible for keeping your
          credentials secure and for all activity that occurs under your
          account. Notify us immediately of any unauthorized use.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Upload files that you do not have the legal right to process.
          </li>
          <li>
            Use the Service to violate any law, including intellectual-property,
            privacy, or data-protection laws.
          </li>
          <li>
            Attempt to reverse-engineer, probe, or disrupt the Service, or to
            bypass rate limits or security controls.
          </li>
          <li>
            Use the Service to process special-category data (health,
            biometric, etc.) unless you have a lawful basis and a separate
            written agreement with us.
          </li>
        </ul>
      </Section>

      <Section title="5. Your content">
        <p>
          You retain all rights in the files you upload. You grant us a
          limited, non-exclusive license to process those files solely to
          provide the tool you selected. We do not claim ownership of your
          content and do not use it to train AI models.
        </p>
      </Section>

      <Section title="6. Plans, fees, and refunds">
        <p>
          Free-tier usage is provided as-is. Paid plans are billed in advance
          on a recurring basis. You may cancel at any time; we do not provide
          refunds for partial billing periods except where required by law.
        </p>
      </Section>

      <Section title="7. Intellectual property">
        <p>
          The Service, including its UI, code, and branding, is owned by
          GetPDFPro Inc. and protected by intellectual-property law. The
          name "GetPDFPro" and our logo are our trademarks. You may not use
          them without our written permission.
        </p>
      </Section>

      <Section title="8. Termination">
        <p>
          We may suspend or terminate access if you breach these Terms or if
          required by law. You may stop using the Service at any time.
        </p>
      </Section>

      <Section title="9. Disclaimers and limitation of liability">
        <p>
          The Service is provided "as is" and "as available" without
          warranties of any kind, except as required by law. To the maximum
          extent permitted by law, our aggregate liability is limited to the
          fees you paid us in the 12 months preceding the claim. Nothing in
          these Terms excludes liability that cannot be excluded by law.
        </p>
      </Section>

      <Section title="10. Governing law and disputes">
        <p>
          These Terms are governed by the laws of the State of Delaware, USA,
          without regard to conflict-of-laws rules. Disputes will be resolved
          in the state or federal courts located in Delaware, except where
          applicable consumer law provides a different forum.
        </p>
      </Section>

      <Section title="11. Changes to these terms">
        <p>
          We may update these Terms. Material changes will be posted at least
          14 days before they take effect. Continued use of the Service after
          the effective date constitutes acceptance.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions about these Terms? Email{' '}
          <a
            href="mailto:legal@getpdfpro.com"
            className="text-brand-600 underline-offset-2 hover:underline"
          >
            legal@getpdfpro.com
          </a>
          .
        </p>
      </Section>

      <div className="mt-12 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Want to change your cookie choices? Open the cookie banner and
          adjust your preferences.
        </p>
        <div className="mt-3">
          <CookieSettingsButton />
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  );
}
