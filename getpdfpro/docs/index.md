# Welcome to GetPDFPro Docs

> Cross-platform PDF converter + editor. Better than iLovePDF: voice
> commands, read-aloud, AI assistant, accessibility, and a generous
> free tier.

This is the technical and product documentation for the GetPDFPro
platform. For end-user help, visit **[getpdfpro.com](https://getpdfpro.com)**.

---

## What's in here

### For engineers

- **[Architecture](ARCHITECTURE.md)** — system diagram, data flow, tech decisions
- **[Cost Model](COST-MODEL.md)** — per-service cost playbook (target: $30–60/mo at MVP)
- **[Security](SECURITY.md)** — auth, encryption, breach checks, incident response
- **[i18n](I18N.md)** — 25 languages, RTL support, AI prompt translation

### For ops / DevOps

- **[WordPress Setup](WORDPRESS-SETUP.md)** — headless CMS deployment guide
- **[SEO Strategy](SEO-STRATEGY.md)** — keyword universe, content plan
- **[AdSense Compliance](ADSENSE-COMPLIANCE.md)** — approval checklist

### For product

- **[E2E Encryption](E2E-ENCRYPTION.md)** — zero-knowledge mode design

---

## The vision

Make working with PDFs as natural as talking to a colleague. You say
"merge these three files and email them to my accountant" — and it
happens. The app reads documents aloud when you're driving. It
summarizes a 100-page contract in three bullets. It works for blind
users, for lawyers, for high schoolers, for your mom.

All without ever storing more than we need, charging more than is fair,
or pretending the user is something other than who they are.

---

## Tech stack at a glance

| Layer | Choice |
|---|---|
| Apps | Flutter (iOS, Android, Web, macOS, Windows, Linux) |
| Web | Next.js 15 on Vercel |
| API | Python 3.12 + FastAPI on Railway |
| PDF engine | MuPDF (open source) |
| Queue | Celery + Redis (Upstash) |
| Auth | Supabase (email, Google, GitHub, magic link, passkey, biometrics) |
| Storage | Cloudflare R2 (zero egress) |
| AI | Google Gemini Flash 8B (10× cheaper than GPT-4o) |
| Billing | Stripe (global) + Razorpay (India) |
| Email | Resend |
| Marketing CMS | WordPress (headless) |

**Operating cost target: $30–60/month at MVP scale.**

---

## Repos & links

- [GitHub repo](https://github.com/salimemp/getpdfpro)
- [Public site](https://getpdfpro.com)
- [Status page](https://status.getpdfpro.com)
- [Contact](mailto:hello@getpdfpro.com)
- [Security disclosure](https://github.com/salimemp/getpdfpro/security/advisories/new)

---

*Last updated: 2026-06-06*
