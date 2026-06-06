# GetPDFPro — Monorepo

> Cross-platform PDF converter + editor. Better than iLovePDF: voice
> commands, read-aloud, AI assistant, accessibility, multi-language, and
> a generous free tier.

**Status:** Pre-build · Tech stack locked · See [feasibility report](getpdfpro-feasibility-report.md) for the full plan.

---

## Quick start

```bash
# Local dev
make dev-up          # start Postgres + Redis + Mailhog
make dev-api         # FastAPI on :8000
make dev-web         # Next.js on :3000
make dev-worker      # Celery worker
```

## Repository structure

```
.
├── getpdfpro/                        # Main monorepo
│   ├── apps/
│   │   ├── api/                      # FastAPI + Pydantic v2
│   │   ├── web/                      # Next.js 15 + i18n (25 languages)
│   │   ├── mobile/                   # Flutter (6 platforms)
│   │   └── workers/                  # Celery + Redis
│   ├── infra/
│   │   ├── railway/                  # Railway deploy config
│   │   └── wordpress/                # WordPress headless setup
│   └── docs/                         # Architecture, runbooks, ADRs
├── getpdfpro-feasibility-report.md    # Original feasibility study
├── docker-compose.yml                # Local infra (in getpdfpro/)
├── Makefile                          # Common commands (in getpdfpro/)
└── .github/workflows/ci.yml          # CI (in getpdfpro/.github/)
```

## Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Apps | Flutter | Single codebase → 6 platforms |
| Web | Next.js 15 on Vercel | Fast SSR, free tier, great DX |
| API | Python 3.12 + FastAPI on Railway | Async, fast, great PDF ecosystem |
| PDF engine | MuPDF (PyMuPDF) | Best open-source quality |
| Queue | Celery + Redis (Upstash free) | Python-native, no Node runtime |
| Auth | Supabase (50K MAU free) | All 6 methods in one |
| Storage | Cloudflare R2 | $0 egress — biggest cost win |
| AI | Gemini Flash 8B + WebSocket | 10× cheaper than GPT-4o |
| Billing | Stripe + Razorpay | Global + India |
| Email | Resend (3K free/mo) | Magic links, receipts |
| Marketing CMS | WordPress (headless) | SEO, easy content |
| Operating cost target | **$30–60/mo at MVP** | vs $1K+ on typical stack |

## Documentation

- [Feasibility report](getpdfpro-feasibility-report.md) — full plan
- [Architecture](getpdfpro/docs/ARCHITECTURE.md) — system diagram
- [Cost model](getpdfpro/docs/COST-MODEL.md) — per-service cost playbook
- [Security](getpdfpro/docs/SECURITY.md) — auth, headers, IR
- [i18n](getpdfpro/docs/I18N.md) — 25 languages
- [WordPress setup](getpdfpro/docs/WORDPRESS-SETUP.md) — headless CMS guide
- [SEO strategy](getpdfpro/docs/SEO-STRATEGY.md) — keyword + content plan
- [AdSense compliance](getpdfpro/docs/ADSENSE-COMPLIANCE.md) — approval checklist
- [E2E encryption](getpdfpro/docs/E2E-ENCRYPTION.md) — zero-knowledge mode design
- [Legal doc spec](getpdfpro/docs/LEGAL/SPEC.md) — handoff to lawyer/service
- [Comparison templates](getpdfpro/docs/COMPARISON-TEMPLATES/) — vs iLovePDF, Smallpdf, Adobe
- [Blog posts](getpdfpro/docs/BLOG-POSTS/) — published-ready content

## License

Proprietary. © 2026 GetPDFPro. All rights reserved.
