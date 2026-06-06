# GetPDFPro

> Cross-platform PDF converter + editor. Better than iLovePDF: voice commands, read-aloud, AI assistant, accessibility, multi-language, and a generous free tier.

**Status:** Pre-build · All technical decisions locked · See `getpdfpro-feasibility-report.md` for the full plan.

---

## What This Repo Is

A monorepo containing all GetPDFPro code, infrastructure, and documentation.

```
getpdfpro/
├── apps/
│   ├── web/         # Next.js 15 — getpdfpro.com marketing + app.getpdfpro.com SPA
│   ├── api/         # FastAPI — api.getpdfpro.com (REST + WebSocket)
│   ├── mobile/      # Flutter — iOS, Android, macOS, Windows, Linux
│   └── workers/     # Celery — async PDF processing + AI jobs
├── packages/
│   ├── shared-types/# TypeScript types + Pydantic schemas (mirror)
│   ├── pdf-engine/  # PyMuPDF wrappers, OCR helpers, AI prompts
│   └── ui-tokens/   # Design tokens (colors, spacing, fonts)
├── infra/
│   ├── cloudflare/  # R2 bucket config, DNS, Workers
│   ├── railway/     # API + worker deploy configs
│   ├── vercel/      # Web deploy configs
│   └── github/      # GitHub Actions workflows
└── docs/            # Architecture, runbooks, ADRs
```

---

## Tech Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Apps | **Flutter** | Single codebase, 6 platforms |
| Web | **Next.js 15** on Vercel | Fast SSR, free tier, great DX |
| API | **Python 3.12 + FastAPI** on Railway | Async, fast, great PDF ecosystem |
| PDF engine | **MuPDF (PyMuPDF)** | Best open-source quality |
| Queue | **Celery + Redis** (Upstash free) | Python-native, no Node runtime |
| DB + Auth | **Supabase** (Postgres + Auth, 50K MAU free) | Email, social, passkey, magic link, biometrics all included |
| Storage | **Cloudflare R2** | $0 egress fees — the biggest cost win |
| AI | **Gemini 1.5 Flash 8B** (Pro fallback) + WebSocket | 10× cheaper than GPT-4o |
| Billing | **Stripe** + **Razorpay** | Global + India |
| Email | **Resend** (3K free/mo) | Magic links, receipts |
| Marketing CMS | **WordPress** (headless) on Hostinger | Already have hosting |

**Target operating cost: $30–60/month at MVP scale.** See `docs/COST-MODEL.md`.

---

## Day 1 Actions

If you're starting today, here's the order of operations:

### 1. Create accounts (15 min total)
- [ ] GitHub org `getpdfpro` (or your handle)
- [ ] Cloudflare account → add `getpdfpro.com` → enable free plan
- [ ] Supabase project (free tier) — `getpdfpro-prod`
- [ ] Railway account → link to GitHub
- [ ] Vercel account → link to GitHub
- [ ] Stripe account (test mode) → get API keys
- [ ] Razorpay account (test mode) → get API keys
- [ ] Resend account → verify `noreply@getpdfpro.com`
- [ ] Google AI Studio → get Gemini API key
- [ ] Upstash Redis (free) → create instance

### 2. Provision infrastructure (30 min)
- [ ] Cloudflare R2: create bucket `getpdfpro-prod`
- [ ] Cloudflare DNS: point `getpdfpro.com` and `*.getpdfpro.com` to placeholder
- [ ] Supabase: enable Google + GitHub OAuth providers
- [ ] GitHub: create monorepo, push this scaffold

### 3. First deploy (1 hour)
- [ ] Deploy `apps/web` to Vercel (auto from GitHub)
- [ ] Deploy `apps/api` to Railway (auto from GitHub)
- [ ] Deploy `apps/workers` to Railway
- [ ] Verify health endpoints respond

### 4. First user story (Week 1-2)
- [ ] User signs up with email
- [ ] Email verification sent via Resend
- [ ] User lands in dashboard
- [ ] User uploads a PDF
- [ ] User clicks "Merge"
- [ ] Merged file appears in dashboard
- [ ] User downloads

### 5. First paid user (Week 12+)
- [ ] Add Stripe + Razorpay checkout
- [ ] Subscription upgrades work
- [ ] Free tier limits enforced

---

## Local Development

```bash
# Prerequisites: Python 3.12, Node 20+, Flutter 3.24+, Docker

# Clone and bootstrap
git clone <this-repo>
cd getpdfpro

# Start infrastructure (Redis, Postgres, Mailhog)
make dev-up

# Run the API
make dev-api

# Run the web app
make dev-web

# Run the mobile app
make dev-mobile

# Run Celery worker
make dev-worker
```

See `Makefile` for the full command list.

---

## Cost Snapshot

| Service | MVP | Year 1 (10K users) |
|---|---|---|
| Vercel | $0 | $0–20 |
| Railway | $5–20 | $50–150 |
| Supabase | $0 | $0–25 |
| Cloudflare R2 | $2–5 | $10–30 |
| Upstash Redis | $0 | $0–10 |
| Gemini | $5–20 | $50–200 |
| Resend | $0 | $0–20 |
| Sentry | $0 | $0–26 |
| Stripe fees | 2.9% + 30¢ | same |
| Razorpay fees | 2% | same |
| Apple/Google/MS | $143/yr | $143/yr |
| **Total** | **$30–60/mo** | **$250–500/mo** |

vs. typical AWS S3 + Lambda + OpenAI PDF app at similar scale: **$1,000–3,000/mo**.

---

## Documentation

- `getpdfpro-feasibility-report.md` — full feasibility study, decisions, roadmap
- `docs/ARCHITECTURE.md` — system architecture, data flow, decisions
- `docs/COST-MODEL.md` — cost optimization playbook
- `docs/SECURITY.md` — auth, encryption, breach checks
- `docs/I18N.md` — multi-language strategy
- `docs/ACCESSIBILITY.md` — WCAG 2.1 AA + PDF/UA plan
- `docs/RUNBOOK.md` — operational procedures

---

## License

Proprietary. © 2026 GetPDFPro. All rights reserved.
