# Security Policy

## Our Commitment

GetPDFPro takes the security of our users and their data seriously. We
appreciate the work of security researchers and welcome responsible
disclosure of vulnerabilities.

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          | End of support |
|---------|--------------------|-----------------|
| Latest release (web, mobile, desktop) | ✅ Active | Rolling |
| Previous major release | ✅ Critical fixes only | 6 months after new major |
| Anything older | ❌ No longer supported | — |

For self-hosted or open-source components (when applicable), see the
respective subdirectory's README.

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### How to report

1. **Preferred:** Use [GitHub Security Advisories](https://github.com/salimemp/getpdfpro/security/advisories/new)
   — this creates a private channel between you and the maintainer
2. **Email:** security@getpdfpro.com (PGP key below)
3. **Encrypted chat:** Signal — request via email

### What to include

- Clear description of the vulnerability
- Steps to reproduce (proof-of-concept code or screenshots welcome)
- Affected components (URL, endpoint, file, version)
- Potential impact and severity estimate
- Your name/handle (for credit) — or stay anonymous

### What to expect

| Timeline | What happens |
|---|---|
| **24 hours** | We confirm receipt of your report |
| **3 business days** | We triage severity, send you our assessment |
| **7 days** | We share our planned fix timeline |
| **Ongoing** | We keep you updated as we work on the fix |
| **At fix release** | We credit you in release notes (unless anonymous) |
| **90 days max** | If no fix is released, you may disclose publicly |

## Scope

### In scope

- **getpdfpro.com** (marketing site, WordPress, headless CMS)
- **app.getpdfpro.com** (Next.js web app)
- **api.getpdfpro.com** (FastAPI backend)
- **iOS / Android / macOS / Windows / Linux apps** (Flutter)
- **Authentication** flows (Supabase, OAuth, magic link, passkey)
- **API endpoints** at `api.getpdfpro.com/api/v1/*`
- **WebSocket** at `api.getpdfpro.com/api/v1/ai/chat`
- **AI features** (Gemini integration, prompt handling, output sanitization)
- **File upload/download** flows (R2, pre-signed URLs)
- **Billing** (Stripe, Razorpay checkout, webhooks)
- **Third-party integrations** (Cloudflare, Resend, Sentry)

### Out of scope

- **Self-hosted installations** of any dependencies
- **Vulnerabilities in third-party services** we use (Cloudflare, Supabase,
  Railway, Vercel, Upstash, Stripe, Razorpay, Resend, Google Gemini, Sentry,
  Hostinger) — please report those to the respective vendor
- **Rate limiting / DoS** without demonstrated impact
- **Self-XSS** (you can only attack yourself)
- **Issues requiring physical access** to a user's device
- **Social engineering** of our support team
- **Spam / phishing** not related to GetPDFPro infrastructure
- **Missing security headers** on non-public pages

## Severity Classification

We use CVSS v3.1 to classify reported issues.

| Severity | CVSS | Examples |
|---|---|---|
| **Critical** | 9.0–10.0 | RCE, auth bypass, mass data exposure |
| **High** | 7.0–8.9 | Privilege escalation, XSS with impact, data exposure |
| **Medium** | 4.0–6.9 | CSRF, info disclosure, session fixation |
| **Low** | 0.1–3.9 | Missing headers, version disclosure |
| **Informational** | 0.0 | Best-practice deviations, no immediate impact |

## Our Security Practices

### What we do

- ✅ TLS 1.3 everywhere (Cloudflare)
- ✅ AES-256 encryption at rest (Cloudflare R2)
- ✅ Argon2id password hashing (Supabase)
- ✅ JWT-based auth with 15-min access tokens, 7-day refresh
- ✅ HTTPS-only cookies, httpOnly, SameSite=Lax
- ✅ CSRF protection on all state-changing requests
- ✅ Rate limiting on auth + upload endpoints
- ✅ HaveIBeenPwned password breach check on signup
- ✅ Security headers: HSTS, CSP, X-Frame-Options, etc.
- ✅ Auto-deletion of uploaded files after 24 hours
- ✅ No AI training on user data (opt-in only)
- ✅ Quarterly third-party security review (planned)
- ✅ SOC 2 readiness (certification in Phase 4)
- ✅ Continuous dependency scanning (Dependabot)
- ✅ Secret scanning on every commit
- ✅ CodeQL static analysis on every PR

### Subprocessors

We share user data with these subprocessors, all under DPAs:

- Cloudflare (CDN, R2 storage, DNS)
- Supabase (auth, database)
- Railway (API hosting)
- Vercel (web hosting)
- Upstash (Redis cache)
- Google Gemini (AI features, opt-in only)
- Resend (transactional email)
- Stripe (payments, global)
- Razorpay (payments, India)
- Sentry (error monitoring)
- Hostinger (WordPress hosting)

Full list with data flows: https://getpdfpro.com/legal/subprocessors

## Recognition

We thank the following researchers for responsibly disclosing issues:

*(Hall of fame coming soon — be the first!)*

## PGP Key

For encrypted reports, our PGP key fingerprint:

```
FINGERPRINT: XXXX XXXX XXXX XXXX XXXX  XXXX XXXX XXXX XXXX XXXX
```

*(Key will be added before public launch)*

## Changes to This Policy

We may update this policy. Material changes will be announced via:
- Email to registered users (if applicable)
- GitHub Security Advisory
- getpdfpro.com/security

Last updated: 2026-06-06
