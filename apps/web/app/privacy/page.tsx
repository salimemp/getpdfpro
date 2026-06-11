import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SITE_NAME, SITE_URL, ldJson, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} handles your data.`,
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const ld = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "Privacy Policy", url: `${SITE_URL}/privacy` },
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
          <h1>Privacy Policy</h1>
          <p className="text-sm text-slate-500">
            Last updated: 11 June 2026
          </p>

          <h2>1. The short version</h2>
          <p>
            We built {SITE_NAME} to be the PDF tool we wished existed:
            fast, free, and respectful of your files. The TL;DR:
          </p>
          <ul>
            <li>
              <strong>We don&apos;t store your files.</strong> Files
              you upload are processed in memory and discarded
              immediately. We don&apos;t keep a copy, we don&apos;t
              back them up, we don&apos;t train on them.
            </li>
            <li>
              <strong>We don&apos;t sell your data.</strong> No data
              brokers, no ad networks selling your info, no &quot;partners&quot;
              we hand it to.
            </li>
            <li>
              <strong>You don&apos;t need an account to use the tools.</strong>{" "}
              Anonymous users can do 1 task per day, no signup, no
              email, no tracking beyond a privacy-respecting browser
              cookie.
            </li>
            <li>
              <strong>If you create an account, we keep what we need to keep it
              working.</strong> Email, hashed password, usage counters.
              That&apos;s it.
            </li>
            <li>
              <strong>You can delete your account and all its data at any
              time.</strong> One button in the account page, or email
              privacy@getpdfpro.com.
            </li>
          </ul>

          <h2>2. What we collect</h2>

          <h3>2.1 Files you upload</h3>
          <p>
            Files are streamed to our API server, processed in memory
            using PyMuPDF, and the response is sent back to your
            browser. We do not write uploaded files to disk. The
            processing server retains the file in RAM only for the
            duration of the request (typically &lt; 5 seconds). Once
            the response is sent, the file is garbage-collected by the
            Python runtime.
          </p>
          <p>
            <strong>Exception:</strong> If you explicitly opt into a
            feature that requires storage (for example, saving
            processing history to your account), that data is stored
            until you delete it. Such features will be clearly labeled
            and opt-in.
          </p>

          <h3>2.2 Account information</h3>
          <p>
            If you create an account, we collect:
          </p>
          <ul>
            <li>Email address (used for sign-in and important service notices)</li>
            <li>
              Password (stored as a bcrypt hash — we cannot read it)
            </li>
            <li>
              OAuth profile (name, avatar URL) if you sign in with
              Google or GitHub
            </li>
            <li>
              Subscription status (Free / Pro / Beta) if you upgrade
            </li>
            <li>
              Daily usage counter (how many tasks you&apos;ve run today)
            </li>
          </ul>
          <p>
            We do not collect your real name, phone number, address,
            or any government identifier.
          </p>

          <h3>2.3 Automatically collected data</h3>
          <p>
            When you visit our site, our hosting providers (Vercel for
            the web app, Railway for the API) log standard request
            metadata: IP address, user agent, request URL, response
            status, bytes served. These logs are retained for 30 days
            for abuse detection and capacity planning, then deleted.
          </p>
          <p>
            We use Cloudflare in front of the API for DDoS protection
            and rate limiting. Cloudflare may set cookies or process
            requests for bot detection.
          </p>

          <h3>2.4 Cookies</h3>
          <p>We set the following cookies:</p>
          <ul>
            <li>
              <code>getpdfpro:anon_id</code> — a random UUID stored in
              your browser so we can track your anonymous daily quota.
              Expires after 30 days of inactivity.
            </li>
            <li>
              <code>getpdfpro:quota:*</code> — your daily usage counter
              (localStorage, not actually a cookie, but same idea).
            </li>
            <li>
              <code>sb-*-auth-token</code> — Supabase authentication
              session cookie. Set only after you sign in.
            </li>
          </ul>
          <p>
            We do not use advertising cookies, third-party tracking
            cookies, or cross-site tracking cookies.
          </p>

          <h2>3. How we use your data</h2>
          <ul>
            <li>To process your PDF tasks (the core product)</li>
            <li>To enforce daily usage limits for free/anonymous users</li>
            <li>
              To authenticate you and protect your account (Supabase)
            </li>
            <li>
              To send you essential service emails (password reset,
              quota warnings, security alerts) — never marketing
            </li>
            <li>
              To respond to legal requests (court orders, valid
              subpoenas — none received as of this writing)
            </li>
          </ul>
          <p>
            We do <strong>not</strong> use your data for: advertising,
            profiling, training AI models, or selling to third
            parties.
          </p>

          <h2>4. Who we share data with</h2>
          <p>
            We share data only with the following sub-processors, each
            contractually obligated to protect it:
          </p>
          <ul>
            <li>
              <strong>Vercel</strong> — web hosting (privacy policy:{" "}
              <a href="https://vercel.com/legal/privacy-policy" rel="noopener noreferrer" target="_blank">
                vercel.com/legal/privacy-policy
              </a>
              )
            </li>
            <li>
              <strong>Railway</strong> — API hosting (privacy policy:{" "}
              <a href="https://railway.com/legal/privacy" rel="noopener noreferrer" target="_blank">
                railway.com/legal/privacy
              </a>
              )
            </li>
            <li>
              <strong>Supabase</strong> — auth and database (privacy
              policy:{" "}
              <a href="https://supabase.com/privacy" rel="noopener noreferrer" target="_blank">
                supabase.com/privacy
              </a>
              )
            </li>
            <li>
              <strong>Cloudflare</strong> — CDN and DDoS protection
              (privacy policy:{" "}
              <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener noreferrer" target="_blank">
                cloudflare.com/privacypolicy
              </a>
              )
            </li>
            <li>
              <strong>Stripe</strong> — payment processing (privacy
              policy:{" "}
              <a href="https://stripe.com/privacy" rel="noopener noreferrer" target="_blank">
                stripe.com/privacy
              </a>
              ) — we share only your email and subscription status;
              never your card details
            </li>
          </ul>
          <p>
            We do not share data with advertising networks, data
            brokers, analytics providers (beyond what our hosting
            providers collect), social media platforms, or any other
            third party.
          </p>

          <h2>5. Your rights</h2>
          <p>You can at any time:</p>
          <ul>
            <li>
              <strong>Access</strong> your data — visit{" "}
              <a href="/account">/account</a> or email privacy@getpdfpro.com
            </li>
            <li>
              <strong>Download</strong> a copy of your account data
              (JSON export, coming soon)
            </li>
            <li>
              <strong>Correct</strong> inaccurate data — email
              privacy@getpdfpro.com
            </li>
            <li>
              <strong>Delete</strong> your account and all associated
              data — one click in the account page, or email
              privacy@getpdfpro.com
            </li>
            <li>
              <strong>Object</strong> to processing or request
              restriction — email privacy@getpdfpro.com
            </li>
            <li>
              <strong>Port</strong> your data to another service (data
              portability) — JSON export, coming soon
            </li>
          </ul>
          <p>
            We respond to all data-subject requests within 30 days, as
            required by GDPR Article 12(3).
          </p>

          <h2>6. International transfers</h2>
          <p>
            Our servers are hosted in the United States (Railway,
            Vercel edge network) and the European Union (Supabase
            primary region). When you use {SITE_NAME} from outside
            these regions, your data may be transferred across borders
            to provide the service.
          </p>
          <p>
            We rely on Standard Contractual Clauses (SCCs) for
            transfers from the EEA, UK, and Switzerland to the US, in
            compliance with GDPR Chapter V.
          </p>

          <h2>7. Children</h2>
          <p>
            {SITE_NAME} is not directed at children under 13 (or under
            16 in the EEA). We do not knowingly collect personal data
            from children. If you believe a child has provided us
            data, email privacy@getpdfpro.com and we will delete it.
          </p>

          <h2>8. Security</h2>
          <p>
            We use industry-standard security measures:
          </p>
          <ul>
            <li>TLS 1.2+ for all data in transit (HSTS enabled)</li>
            <li>
              Bcrypt-hashed passwords (we cannot read them, ever)
            </li>
            <li>
              Files processed in memory only, never written to disk on
              our servers
            </li>
            <li>Row-level security in our database</li>
            <li>
              Rate limiting and DDoS protection via Cloudflare
            </li>
            <li>Regular security reviews and dependency audits</li>
          </ul>
          <p>
            Report vulnerabilities to{" "}
            <a href="mailto:security@getpdfpro.com">
              security@getpdfpro.com
            </a>
            . We respond within 48 hours.
          </p>

          <h2>9. Cookies &amp; tracking</h2>
          <p>
            We use only the cookies listed in section 2.4. We do not
            use Google Analytics, Facebook Pixel, or any
            cross-site tracking technology.
          </p>
          <p>
            Google AdSense may set its own cookies when displaying
            ads. See{" "}
            <a
              href="https://policies.google.com/technologies/cookies"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google&apos;s cookie policy
            </a>{" "}
            for details on how those cookies work.
          </p>

          <h2>10. Changes to this policy</h2>
          <p>
            If we make material changes, we&apos;ll email signed-in
            users and post a notice on the home page at least 30 days
            before the changes take effect. The &quot;Last updated&quot; date at the
            top of this page reflects the most recent change.
          </p>

          <h2>11. Contact</h2>
          <p>
            Email <a href="mailto:privacy@getpdfpro.com">privacy@getpdfpro.com</a>{" "}
            for any privacy-related question. We respond within 30 days.
          </p>
          <p>
            <strong>Data controller:</strong> Salim, operating as a
            sole proprietor. Based in India.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
