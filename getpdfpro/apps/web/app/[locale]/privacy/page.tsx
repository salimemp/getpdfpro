import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

import { CookieSettingsButton } from '@/components/CookieSettingsButton';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How GetPDFPro collects, uses, and protects your personal data. GDPR, CCPA, and HIPAA-grade safeguards explained.',
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Last updated: 13 June 2026
      </p>

      <Section title="1. Who we are">
        <p>
          GetPDFPro ("we", "us", "our") is operated by GetPDFPro Inc., a
          Delaware-incorporated company with its principal place of business at
          the registered address listed in our Terms of Use. We are the data
          controller for personal data processed through getpdfpro.com and our
          mobile and desktop applications (the "Service").
        </p>
      </Section>

      <Section title="2. What data we collect">
        <p>We collect the minimum data needed to run the Service:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Files you upload</strong> — for the sole purpose of running
            the tool you selected. Files are processed in-memory or in
            short-lived encrypted storage and deleted within a defined retention
            window (see §5).
          </li>
          <li>
            <strong>Account data</strong> — if you sign up: email address, name
            (optional), and authentication provider identifiers. We never see
            your password.
          </li>
          <li>
            <strong>Usage data</strong> — anonymized analytics about which tools
            are used and how often, so we can improve them.
          </li>
          <li>
            <strong>Device & log data</strong> — IP address, user agent, and
            error logs, used for security and abuse prevention.
          </li>
        </ul>
      </Section>

      <Section title="3. Why we process your data (legal basis under GDPR)">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Contract (Art. 6(1)(b))</strong> — to provide the tool you
            requested.
          </li>
          <li>
            <strong>Legitimate interests (Art. 6(1)(f))</strong> — to keep the
            Service secure, prevent abuse, and improve features.
          </li>
          <li>
            <strong>Consent (Art. 6(1)(a))</strong> — for non-essential cookies
            (analytics, marketing). You can withdraw consent at any time via
            cookie settings.
          </li>
          <li>
            <strong>Legal obligation (Art. 6(1)(c))</strong> — to comply with
            applicable law.
          </li>
        </ul>
      </Section>

      <Section title="4. Cookies and similar technologies">
        <p>
          We use a small number of cookies and local-storage entries. They are
          grouped into three categories, all controllable from the cookie
          banner:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Essential</strong> — session, security, and your consent
            choice itself. These cannot be disabled.
          </li>
          <li>
            <strong>Analytics</strong> — aggregated, IP-anonymized usage stats.
            We use privacy-respecting analytics that do not set advertising
            cookies.
          </li>
          <li>
            <strong>Marketing</strong> — only set if you opt in. We use them to
            measure campaign effectiveness; we do not sell data to ad networks.
          </li>
        </ul>
      </Section>

      <Section title="5. File retention and deletion">
        <p>
          Files you upload are processed in isolated, encrypted-at-rest storage
          and automatically deleted within <strong>2 hours</strong> of upload.
          You may also delete them manually from your dashboard at any time. We
          do not train AI models on your files.
        </p>
      </Section>

      <Section title="6. How we share data">
        <p>
          We do not sell personal data. We share it only with vetted subprocessors
          that help us run the Service (hosting, error tracking, email delivery,
          payment). A current list is available on request. Each subprocessor is
          bound by a data-processing agreement.
        </p>
      </Section>

      <Section title="7. International transfers">
        <p>
          Data may be processed in the United States, European Economic Area, or
          India. Where required, we rely on Standard Contractual Clauses and
          equivalent safeguards.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          We apply end-to-end encryption for file transport, encryption at rest
          for stored files, least-privilege access controls, audited access
          logs, and a vulnerability-disclosure program. Our security posture is
          designed to meet GDPR, CCPA, and HIPAA-grade requirements.
        </p>
      </Section>

      <Section title="9. Your rights">
        <p>Under GDPR, CCPA, and similar laws, you have the right to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate data.</li>
          <li>Request deletion ("right to be forgotten").</li>
          <li>Object to or restrict processing.</li>
          <li>Data portability in a machine-readable format.</li>
          <li>Withdraw consent at any time, without affecting prior processing.</li>
          <li>Lodge a complaint with your supervisory authority.</li>
        </ul>
        <p>
          To exercise any of these rights, email{' '}
          <a
            href="mailto:privacy@getpdfpro.com"
            className="text-brand-600 underline-offset-2 hover:underline"
          >
            privacy@getpdfpro.com
          </a>
          . We respond within 30 days.
        </p>
      </Section>

      <Section title="10. Children">
        <p>
          The Service is not directed to children under 16 (or the relevant
          minimum age in your jurisdiction). We do not knowingly collect data
          from children.
        </p>
      </Section>

      <Section title="11. Changes to this policy">
        <p>
          We will post material changes here at least 14 days before they take
          effect, and — where required by law — request renewed consent.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions? Email{' '}
          <a
            href="mailto:privacy@getpdfpro.com"
            className="text-brand-600 underline-offset-2 hover:underline"
          >
            privacy@getpdfpro.com
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
