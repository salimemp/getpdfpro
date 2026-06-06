# GetPDFPro — Feasibility & Build Plan

> **Status:** ✅ FINAL — Tech stack locked, project scaffold delivered
> **Date:** 2026-06-06
> **Owner:** Abdul Salim (owns `getpdfpro.com`)
> **Competitor baseline:** ilovepdf.com
> **Target platforms:** Web + iOS + Android + macOS + Windows + Linux
> **Cost mandate:** Minimize operating costs aggressively
> **Companion scaffold:** See `getpdfpro/` monorepo for working code

---

## 0. Locked Decisions (no re-debating these)

| Layer | Choice | Why |
|---|---|---|
| **Mobile + Desktop apps** | Flutter (single codebase) | True cross-platform parity, mature PDF plugins |
| **Web app** | Next.js 15 (TypeScript) on Vercel | Fast SSR, great DX, generous free tier |
| **Backend API** | Python 3.12 + FastAPI | Async, fast, Pydantic v2, great Python PDF ecosystem |
| **PDF engine** | MuPDF (via PyMuPDF / `pymupdf`) | Best open-source quality, fast, no per-doc fees |
| **Task queue / workers** | **Celery + Redis** (NOT BullMQ) | BullMQ is Node-only; Celery is Python-native, same Redis model, no extra runtime cost |
| **Database** | PostgreSQL 16 (via Supabase free tier or Railway) | Battle-tested, JSONB for flexibility |
| **Cache + queue broker** | Redis (Upstash free tier or Railway) | Free tier: 10K commands/day, 256MB |
| **Object storage** | **Cloudflare R2** (NOT S3, NOT Railway) | $0.015/GB/mo, **zero egress fees** — biggest cost win |
| **CDN** | Cloudflare (free tier) | Edge cache, DDoS protection, free SSL |
| **Compute hosting** | **Railway** ($5/mo Hobby plan) | Fast deploys, predictable pricing for FastAPI + Celery workers |
| **Auth** | **Supabase Auth** (free: 50K MAU) | Ships email+pw, Google, GitHub, magic link, passkey, biometrics via WebAuthn |
| **Password breach check** | HaveIBeenPwned `pwnedpasswords` API (k-anonymity, free) | Industry standard, no API key, privacy-safe |
| **Billing** | **Stripe** (international) + **Razorpay** (India) | Stripe for global cards; Razorpay for UPI/India pricing |
| **AI** | **Google Gemini** (gemini-1.5-flash default, gemini-1.5-pro for complex) | ~10× cheaper than GPT-4o, comparable quality |
| **AI chat transport** | **WebSocket** via FastAPI native WS + Redis pub/sub | No third-party WS service cost |
| **Email (transactional)** | **Resend** (free: 3K/mo) or Brevo (free: 300/day) | Magic links, verifications, receipts |
| **Monitoring** | Sentry (free: 5K events/mo) + Better Stack (free tier) | Errors + uptime |
| **Marketing site CMS** | WordPress (headless, on Railway or Hostinger) | Free, fast to launch, great SEO |
| **i18n** | WordPress: WPML or Polylang · App: `easy_localization` (Flutter) + `next-intl` (Next.js) | 25+ languages at launch |
| **Analytics** | Plausible (self-hosted or $9/mo cloud) | Privacy-friendly, no cookie banner needed |

---

## 1. Domain — RESOLVED

✅ **You own `getpdfpro.com`.** No acquisition needed.

### DNS plan (do this once)
1. **Move DNS to Cloudflare** (free) — they have registrar too if you want to transfer from Hostinger
2. **Point records:**
   - `@` → Railway app (or Vercel if web is the main entry) — A/CNAME
   - `app.getpdfpro.com` → Web app (Vercel/Next.js)
   - `api.getpdfpro.com` → FastAPI (Railway)
   - `cdn.getpdfpro.com` or `files.getpdfpro.com` → Cloudflare R2 public bucket (or signed URLs)
   - `blog.getpdfpro.com` → WordPress (headless or subfolder)
3. **SSL:** Cloudflare handles it (free, automatic)
4. **Email forwarding:** Cloudflare Email Routing (free) for `support@`, `hello@`, `noreply@`

### Estimated cost
- Domain renewal: ~$12/yr (depending on what Hostinger charges)
- Cloudflare: $0 (free plan covers everything we need at MVP)
- Total: ~$1/mo amortized

### WordPress site hosting
- **Option A:** Keep on Hostinger (you already have it) — $3–5/mo
- **Option B:** Move to Railway — $5/mo
- **My pick:** Keep on Hostinger for now. Don't move things that aren't broken.

---

## 2. iLovePDF Feature Audit (the bar to beat)

iLovePDF currently ships these tools across 6 categories. GetPDFPro must cover all of them at launch, then win on advanced features.

### Organize PDF
Merge · Split · Remove pages · Extract pages · Organize · Scan to PDF

### Optimize PDF
Compress · Repair · OCR

### Convert to PDF
JPG → PDF · Word → PDF · PowerPoint → PDF · Excel → PDF · HTML → PDF

### Convert from PDF
PDF → JPG · PDF → Word · PDF → PowerPoint · PDF → Excel · PDF → PDF/A

### Edit PDF
Rotate · Add page numbers · Add watermark · Crop · Edit · PDF Forms

### PDF Security
Unlock · Protect · Sign · Redact · Compare

### PDF Intelligence (new)
AI Summarizer · Translate PDF

### Platform coverage
Web · Desktop (Mac/Win) · Mobile (iOS/Android) · 25+ languages · API

### Pricing benchmark
- **Free** — limited tools, small files, daily task caps
- **Premium** — ₹200/month (yearly) or ₹500/month, 4GB files, 2000 AI credits, ad-free
- **Business** — Custom pricing, SSO, dedicated support

### iLovePDF's weak spots (our opportunities)
- Free tier is restrictive (15MB on Office conversions, 3 tasks/day)
- No real voice / accessibility story
- AI features are paywalled and credit-capped
- No real cross-platform "sync session" between web and mobile
- Privacy: file goes to their server (EU/US)

---

## 3. GetPDFPro Differentiators (the "better value" angle)

### A. Voice & Read-Aloud
- **Voice commands** — "Merge these three files", "Compress to under 1MB", "Translate page 2 to Arabic"
  - Web: Web Speech API (SpeechRecognition)
  - Mobile: native `Speech` API (iOS Speech Framework, Android SpeechRecognizer)
  - Desktop: Web Speech API or system-native (macOS Speech, Windows Speech Platform)
- **Read aloud (TTS)** — Reads PDFs aloud with synchronized highlight
  - Browser: Web Speech Synthesis API
  - Mobile: native TTS engines with on-device neural voices
  - Languages: 25+ matching the UI languages
- **Voice shortcuts** — "Read next page", "Pause", "Bookmark this", "Save to cloud"

### B. AI Assistant (built in, not bolted on)
- **Conversational PDF Q&A** — "Summarize section 3", "What's the deadline?", "Extract all dates"
- **Auto-summarization** on open (optional, opt-in)
- **Smart suggestions** — "This looks like an invoice, want me to extract line items?"
- **Multilingual translation** with layout preservation (better than iLovePDF's current impl)
- **Context-aware help** — hover a button, ask the assistant "what does this do?"

### C. Accessibility (WCAG 2.1 AA + PDF/UA)
- **Screen reader optimized** UI (ARIA live regions, semantic HTML)
- **High-contrast & dark modes** with system-sync
- **Keyboard-first navigation** (every action has a shortcut)
- **Adjustable UI**: text size, spacing, motion reduction, focus indicators
- **PDF/UA output** for accessible PDF generation (tagged structure, alt text, reading order)
- **Dyslexia-friendly font option** (OpenDyslexic)
- **Color-blind safe palette**
- **Captions/transcripts** for any audio feedback

### D. Multi-language (i18n / l10n)
- 25+ languages at launch (matching iLovePDF parity), expandable to 40+
- **Right-to-left** support (Arabic, Hebrew, Urdu, Persian)
- **Locale-aware**: number formats, dates, paper sizes (A4 vs Letter)
- **Community translation** portal (e.g., Crowdin/POEditor)
- **In-app language switcher** (no reload)
- **Translated help docs, video tutorials, error messages, AI prompts**

### E. Privacy & value
- **End-to-end encryption** option (zero-knowledge mode)
- **Generous free tier** (this is the killer move — beat iLovePDF's limits): 100MB files, 50 tasks/day, no AI paywall on basics
- **Transparent AI** — clear which data goes to LLM, opt-in only, "AI off" mode by default
- **On-device OCR/TTS option** for sensitive docs

### F. UX polish iLovePDF lacks
- **True cross-platform session sync** — start on phone, finish on desktop
- **Folder watching** — drop PDFs in a folder, auto-process
- **Workflows** (iLovePDF has this) but with **sharing** — publish a workflow, others can use it
- **Version history** for edited files (cloud)
- **Real-time collaboration** on annotations

---

## 4. Final Architecture (locked in)

```
                          ┌──────────────────────────┐
                          │  CLOUDFLARE              │
                          │  - DNS, SSL, CDN, WAF     │
                          │  - Email routing          │
                          │  - R2 (object storage)    │
                          │    ↓ zero egress fees     │
                          └────────────┬─────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
   ┌────────▼────────┐       ┌─────────▼──────────┐      ┌────────▼────────┐
   │  HOSTINGER      │       │  VERCEL (free)     │      │  RAILWAY ($5)   │
   │  WordPress      │       │  Next.js 15 app    │      │  FastAPI        │
   │  (headless CMS) │       │  app.getpdfpro.com │      │  api.getpdfpro  │
   │  blog.getpdfpro │       │  - Web SPA         │      │  .com           │
   │  .com           │       │  - Edge functions  │      │  - REST + WS    │
   └─────────────────┘       └─────────┬──────────┘      └────────┬────────┘
                                       │                          │
                                       │         ┌────────────────┤
                                       │         │                │
                              ┌────────▼─────────▼───┐   ┌─────────▼────────┐
                              │  SUPABASE            │   │  CELERY WORKERS  │
                              │  - Auth (free 50K    │   │  (Railway)       │
                              │    MAU)              │   │  - Merge/Split   │
                              │  - Postgres DB       │   │  - Compress/OCR  │
                              │  - Storage (alt)     │   │  - AI jobs       │
                              └──────────────────────┘   │  - Email send    │
                                                         └─────────┬────────┘
                                                                   │
                                                         ┌─────────▼────────┐
                                                         │  REDIS           │
                                                         │  (Upstash free)  │
                                                         │  - Celery broker │
                                                         │  - WS pub/sub    │
                                                         │  - Cache         │
                                                         └──────────────────┘

   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
   │  FLUTTER           │   │  STRIPE / RAZORPAY │   │  GEMINI API        │
   │  iOS / Android /   │   │  Billing           │   │  gemini-1.5-flash  │
   │  macOS / Win /     │   │  (global + India)  │   │  + flash-8b for    │
   │  Linux             │   │                    │   │  cheap summaries   │
   └────────────────────┘   └────────────────────┘   └────────────────────┘
```

### Repository structure (3 repos, monorepo-friendly)
```
getpdfpro/
├── apps/
│   ├── web/          # Next.js 15 (TypeScript, App Router)
│   ├── api/          # FastAPI (Python 3.12, Pydantic v2)
│   ├── mobile/       # Flutter (single codebase, 6 platforms)
│   └── workers/      # Celery workers (Python, shares code with api/)
├── packages/
│   ├── shared-types/ # TypeScript types + Pydantic schemas (mirror)
│   ├── pdf-engine/   # PyMuPDF wrappers, OCR, AI prompts
│   └── ui-tokens/    # Design tokens (colors, spacing, fonts)
├── infra/
│   ├── railway/      # railway.toml, Dockerfile, nixpacks
│   ├── cloudflare/   # R2 bucket config, DNS records, Workers
│   └── ci/           # GitHub Actions workflows
└── docs/             # Architecture, ADRs, runbooks
```

---

## 4.1. Auth Stack — Detailed

**Provider: Supabase Auth** (hosted, free up to 50K MAU)

| Method | Implementation |
|---|---|
| Email + password | Supabase default · Argon2id hashing · Min 12 chars, mixed case, digit, symbol |
| Email verification | Supabase built-in · Magic link sent via Resend template |
| Strong password policy | Enforced client-side (Flutter + Next.js) AND server-side (Supabase hook) |
| Password breach check | **HaveIBeenPwned Pwned Passwords API** (k-anonymity model) · 600M+ breached passwords · Free, no API key, SHA-1 hash sent (first 5 chars) |
| Social — Google | Supabase Google OAuth · Uses official Google "G" logo (brand guidelines compliant) |
| Social — GitHub | Supabase GitHub OAuth · Uses official Octocat / mark |
| Magic link | Supabase built-in · 15-min expiry · Single-use |
| Biometrics | WebAuthn via Supabase · TouchID / FaceID / Windows Hello · Device-bound passkeys |
| Passkey (cross-device) | WebAuthn passkey storage · Syncs via iCloud Keychain / Google Password Manager |
| 2FA (future) | TOTP via Supabase MFA (Pro tier, $25/mo) — defer to Phase 3 |

### Password flow
```
1. User enters password
2. Client: validate strength (zxcvbn score ≥ 3)
3. Client: SHA-1 hash, send first 5 chars to HIBP API
4. Receive list of suffixes matching that prefix
5. If full hash in list → reject (breached)
6. Otherwise send to Supabase → Argon2id → store
7. Send verification email via Resend
```

### Session strategy
- **Web:** Supabase JWT in httpOnly cookie, 7-day sliding expiry
- **Mobile:** Supabase JWT in secure storage (Keychain/Keystore), refresh token rotation
- **Cross-device:** Same Supabase user, multi-session allowed (e.g. phone + desktop logged in simultaneously)

---

## 4.2. Billing — Competitive Pricing

**Providers: Stripe (global) + Razorpay (India/UPI)**

### Pricing tiers (research-driven, beats iLovePDF on value)

| Tier | Price (USD) | Price (INR) | Limits |
|---|---|---|---|
| **Free** | $0 | ₹0 | 100MB files, 50 tasks/day, all 25 tools, basic AI (50 prompts/mo) |
| **Pro** | $4.99/mo | ₹399/mo | 4GB files, unlimited tasks, 1000 AI prompts, voice read-aloud, OCR |
| **Pro Annual** | $39.99/yr (save 33%) | ₹3,499/yr | Same as Pro |
| **Team** | $12/user/mo | ₹999/user/mo | Everything in Pro + shared workspace, admin, SSO-ready |
| **Business** | Custom | Custom | SLA, on-prem option, custom AI model, dedicated support |

> **iLovePDF comparison:** Their Premium is ₹200/mo (annual). Our Pro is ₹399/mo but includes **unlimited tasks, 4GB files, voice read-aloud, fair AI credits (1000 vs their 2000 with paywall on advanced AI), better privacy**. The differentiator isn't price — it's **fairness, accessibility, and integration**.

### Payment flow
- **Global cards / Apple Pay / Google Pay** → Stripe Checkout
- **India (UPI, Net Banking, Paytm)** → Razorpay Checkout
- **Subscription webhooks** → FastAPI `/webhooks/billing` → updates user quota in DB
- **Failed payment** → grace period 3 days → downgrade to free (no hard lockout for monthly users)

### Tax compliance
- **Stripe Tax** (auto): $0.50/transaction — handles VAT/GST for 50+ countries
- **Razorpay**: built-in GST handling for India
- For India: 18% GST on digital services, collected by us (Razorpay auto-remits)

---

## 4.3. Storage — Detailed (cost-optimized)

**Provider: Cloudflare R2** (S3-compatible, zero egress)

| Item | Cost |
|---|---|
| Storage | $0.015/GB/month |
| **Egress (downloads)** | **$0 — FREE** |
| Operations (Class A: PUT) | $4.50 / million |
| Operations (Class B: GET) | $0.36 / million |

### Bucket structure
```
getpdfpro-prod/
├── uploads/        # Raw user uploads, auto-deleted after 24h
├── processed/      # Output files, signed URLs, 7-day TTL
├── thumbnails/     # Page previews (long-term, public)
├── exports/        # User-initiated bulk exports
└── backups/        # Encrypted DB backups (daily, 30-day retention)
```

### Access pattern
- **Upload:** Direct browser → R2 via pre-signed PUT URL (no traffic through our server)
- **Download:** R2 signed GET URL, 15-min expiry, generated on demand
- **Privacy mode:** Server-side encrypt with customer-specific key before upload
- **Auto-cleanup:** Cloudflare Worker cron job deletes `uploads/*` older than 24h

### Why not Railway for storage?
Railway has "Volumes" (block storage, $0.25/GB/mo) — but:
- Not S3-compatible (can't serve files via signed URLs to clients)
- Single-region, no CDN
- Costs add up fast at scale

R2 + Cloudflare CDN = files served from edge, zero egress, ~$5/mo for first 100GB.

---

## 4.4. AI Orchestration — Gemini + WebSocket

**Provider: Google Gemini API**

| Model | Use case | Cost (per 1M tokens) |
|---|---|---|
| `gemini-1.5-flash-8b` | Default for all tasks, summaries, Q&A | $0.0375 input / $0.15 output |
| `gemini-1.5-flash` | Mid-tier, longer context (1M tokens) | $0.075 / $0.30 |
| `gemini-1.5-pro` | Complex reasoning, fallback for hard tasks | $1.25 / $5.00 |

**Default to flash-8b** — 10× cheaper than GPT-4o-mini, similar quality for PDF tasks. Only escalate to Pro when user explicitly asks for deeper analysis or our router detects a complex query.

### Free tier usage
- 50 AI prompts/month on Free plan
- Hard cap enforced in middleware
- Track usage in `user_ai_credits` table, decremented per call

### WebSocket chat architecture
```
┌──────────┐    WebSocket     ┌──────────────┐    Redis pub/sub    ┌──────────┐
│  Client  │ ◄──────────────► │  FastAPI WS  │ ◄────────────────── │  Celery  │
│  (Web/   │   wss://api...   │  endpoint    │                     │  worker  │
│   mobile)│                  │  /ai/chat    │                     │  (AI job)│
└──────────┘                  └──────────────┘                     └─────┬────┘
                                                                       │
                                                                       ▼
                                                                ┌──────────────┐
                                                                │  Gemini API  │
                                                                └──────────────┘
```

**Why this design:**
- WebSocket handled natively by FastAPI (`@app.websocket("/ai/chat")`)
- Heavy Gemini calls run in Celery worker (don't block the WS event loop)
- Worker streams tokens back via Redis pub/sub → WS pushes to client
- Client gets token-by-token streaming (feels like ChatGPT)

### Cost guardrails
- Max context: 500K tokens per request (well under Gemini's 1M limit)
- Max output: 8K tokens
- Rate limit: 10 concurrent WS connections per user, 30 messages/min
- Hard daily cap: enforced in middleware
- Caching: same PDF + same question within 24h → return cached answer (Redis)

---

## 4.5. WordPress — Confirmed Role

**Hosting:** Keep on Hostinger (you already have it). Don't move things that aren't broken.
**Role:** Headless CMS for marketing/content only.

### What lives in WordPress
- Homepage, pricing, features, about, contact
- Blog (`blog.getpdfpro.com` or `/blog`)
- Help center / knowledge base
- Legal pages (privacy, terms, GDPR)
- "vs iLovePDF", "vs Smallpdf" comparison pages (SEO gold)
- Multilingual content via WPML (one license, $79 — one-time)

### What does NOT live in WordPress
- The actual PDF tools (separate Next.js app at `app.getpdfpro.com`)
- User accounts (Supabase)
- File processing (FastAPI)
- Anything real-time (WebSocket, AI)

### WordPress as API
- Expose content via WPGraphQL or WP REST API
- Next.js fetches at build time (ISR) for static pages
- Fetch at request time for blog posts (with 60s cache)


---

## 5. Cross-Platform Tech Stack Recommendation

### Option A: Flutter (★ recommended)
- **One codebase** → iOS, Android, Web, macOS, Windows, Linux
- Best for true cross-platform parity
- Mature PDF plugins: `pdfx`, `syncfusion_flutter_pdf`, `printing`
- AI/voice support via plugins
- Larger app size (~20MB) but worth it

### Option B: React + Capacitor / Tauri
- Web-first (Next.js), wrap for mobile/desktop
- Smaller apps, faster web iteration
- Voice/TTS via standard Web APIs
- Less native feel on mobile

### Option C: Native per platform
- Best UX per platform
- 3–4x development cost
- Only worth it if you have a large team

**My pick:** Flutter for the apps, Next.js (TypeScript) for the web app, separate Python/Node workers for heavy backend processing. The web app and mobile app share API contracts and design tokens (Figma → both).

---

## 6. Phased Build Roadmap

### Phase 1 — MVP (months 1–3, ~$30K dev cost if outsourced)
- Web app with the 8 most-used tools: Merge, Split, Compress, PDF→Word, Word→PDF, PDF→JPG, JPG→PDF, Sign
- 3 languages (English, Spanish, Arabic)
- Free tier + Pro tier ($4.99/mo / ₹399/mo)
- WordPress marketing site live at getpdfpro.com
- Stripe + Razorpay billing
- Supabase auth (email + Google + GitHub)
- Cloudflare R2 for storage
- Basic voice commands (Web Speech API) for 5 core actions
- Deploy: Vercel (web) + Railway (API) + Cloudflare R2

### Phase 2 — Differentiation (months 4–6)
- Full 25-tool parity with iLovePDF
- AI assistant via Gemini Flash 8B (PDF Q&A, summarization, translation)
- WebSocket streaming for AI chat
- Mobile apps (iOS + Android) on Flutter
- Desktop apps (macOS + Windows) on Flutter
- Voice read-aloud with synchronized highlight
- 10+ languages
- Magic link + passkey auth added
- Accessibility audit → WCAG 2.1 AA

### Phase 3 — Scale (months 7–12)
- Workflows with sharing/marketplace
- Real-time collaboration
- On-device OCR/TTS
- E-signature compliance (eIDAS, ESIGN)
- API for developers (REST + WS)
- Team tier
- Linux desktop app
- 25+ languages

### Phase 4 — Moat (year 2)
- PDF/UA accessibility compliance
- Custom AI model fine-tuned on PDF tasks
- White-label for enterprise
- Zapier / Make / n8n integrations
- Plugin marketplace
- 40+ languages

---

## 7. Cost Estimates (revised, cost-optimized)

### MVP monthly operating cost (target: <$100/mo at launch)

| Item | Cost | Free tier limit | Notes |
|---|---|---|---|
| Domain (amortized) | $1/mo | — | getpdfpro.com via Cloudflare |
| Cloudflare (DNS, CDN, WAF) | $0 | Unlimited | Free plan is plenty |
| Cloudflare R2 storage | $2–5/mo | 10GB free, then $0.015/GB | Egress = $0 |
| Vercel (Next.js hosting) | $0 | 100GB bandwidth, unlimited sites | Hobby plan |
| Railway (FastAPI + Celery) | $10–20/mo | $5 trial credit | Hobby $5 + usage |
| Redis (Upstash) | $0 | 10K cmd/day, 256MB | Plenty for MVP |
| Supabase (auth + DB) | $0 | 50K MAU, 500MB DB | Generous free tier |
| Resend (email) | $0 | 3K emails/mo | Magic links, receipts |
| Sentry (errors) | $0 | 5K events/mo | Free tier |
| Stripe | 2.9% + 30¢ per txn | Pay-per-use | No monthly fee |
| Razorpay | 2% per txn | Pay-per-use | No monthly fee |
| Gemini API | $5–20/mo | 60 RPM free | Flash 8B is dirt cheap |
| Apple Developer | $7/mo ($99/yr) | — | iOS + macOS |
| Google Play | $2/mo ($25/yr one-time) | — | Android |
| Microsoft Store | $2/mo ($19/yr) | — | Windows |
| **Total fixed** | **~$30–60/mo** | | |
| **+ Variable (per user)** | **~$0.001/user/mo** | | Cloudflare R2, Gemini |

### Year 1 estimate (after scaling past free tiers)
| Item | Cost |
|---|---|
| Compute (Railway + Vercel Pro) | $50–150/mo |
| Storage (R2, ~500GB) | $8–15/mo |
| Database (Supabase Pro if needed) | $25/mo |
| AI (Gemini, ~10M tokens/mo) | $50–200/mo |
| Email (Resend Pro) | $20/mo |
| Monitoring | $30/mo |
| Dev tooling (Sentry Pro, etc.) | $30/mo |
| **Total Y1** | **$250–500/mo** |

**vs. original AWS S3 + Lambda + OpenAI estimate: $1,000–3,000/mo**

The cost discipline is the moat. Most PDF tool competitors burn cash on AWS egress and LLM API calls; we don't.

---

## 7.1. Cost Optimization Playbook (concrete tactics)

### Compute
- **Railway auto-sleep** on workers not actively processing (saves 60% on idle)
- **Celery concurrency tuning** — match worker count to actual queue depth, not max
- **Vercel ISR** for marketing pages — no SSR cost

### Storage
- **Auto-delete uploads** after 24h (Cloudflare Worker cron)
- **Compress PDFs on upload** (lossless) — typical 20-40% size reduction
- **Thumbnail-only retention** for old files in user history
- **Deduplicate** identical files (hash check) across users

### AI
- **Default to gemini-1.5-flash-8b** — 10× cheaper than Pro for 90% of tasks
- **Aggressive response caching** — same PDF + question within 24h = free
- **Context truncation** — strip irrelevant pages before sending to Gemini
- **Local fallback** for summaries (small Llama 3.1 8B) when possible
- **Hard daily cap per user** — prevents abuse

### Email
- **Resend** over SendGrid — 3K free vs SendGrid's 100/day
- **Template caching** — pre-build common emails
- **Batch sends** for non-urgent (digest emails)

### Bandwidth
- **Cloudflare R2 zero egress** is the single biggest cost win
- **Edge cache** static assets (logos, JS, CSS) via Cloudflare
- **No server-side image processing** — use Cloudflare Images ($5/mo for 100K images) instead of building our own

### Free tier ceilings (revisit when)
| Service | When to upgrade |
|---|---|
| Supabase | >50K MAU OR >500MB DB |
| Upstash Redis | >10K commands/day consistently |
| Vercel | >100GB bandwidth/mo |
| Resend | >3K emails/mo |
| Railway | >$20/mo usage |
| Cloudflare R2 | >10GB storage (still cheap) |



---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| iLovePDF copies our AI/voice features | Move fast, build the moat in accessibility + privacy |
| Domain is hard to buy | Pivot to `.app` or alternative name early |
| PDF processing quality is hard | Start with Adobe API, migrate to MuPDF for cost at scale |
| LLM costs explode | Cache aggressively, use local models (Llama 3.1) for non-critical paths |
| WCAG compliance audit failures | Hire accessibility consultant from day 1 |
| App store rejection (accessibility claim must be real) | Test with real screen reader users pre-launch |

---

## 9. Decision Time

### ✅ Locked by Abdul
- [x] Domain: `getpdfpro.com` (you own it)
- [x] Mobile/Desktop: Flutter
- [x] Backend: Python/FastAPI
- [x] PDF engine: MuPDF (PyMuPDF)
- [x] Queue: BullMQ → **Celery + Redis** (recommended substitution, see §4)
- [x] Auth: Supabase (email + Google + GitHub + magic link + passkey + biometrics + HIBP)
- [x] Billing: Stripe (global) + Razorpay (India)
- [x] Storage: Cloudflare R2 (Railway is for compute only)
- [x] AI: Gemini (Flash 8B default, Pro fallback) + WebSocket
- [x] Cost mandate: Minimize operating costs aggressively

### ⏳ Still open
- [ ] **Phase 1 scope** — 8-tool MVP in 3 months, or push for full 25-tool parity in 6 months?
- [ ] **Team** — Solo, or do you have a co-founder / devs lined up?
- [ ] **Funding** — Bootstrapped, angel-funded, or VC-backed? Affects runway and ambition.
- [ ] **Launch target** — 6 months, 12 months, or 18 months?
- [ ] **iLovePDF brand monitoring** — are you OK doing competitive "vs iLovePDF" pages, or want to stay neutral on the marketing site?

Once these are answered, I'll:
1. Create the GitHub org + monorepo (private)
2. Spin up the Railway + Vercel + Cloudflare projects
3. Set up Supabase project + Stripe + Razorpay accounts (test mode)
4. Stand up the WordPress headless instance on Hostinger
5. Generate the Figma design system (or pick a starter kit)
6. Build the first user story: email signup → email verify → upload PDF → merge → download
7. Ship the MVP in ~3 months from kickoff

---

## 10. Open Questions for Abdul (please answer in next reply)

1. **MVP scope** — 8 tools in 3 months, or 25 tools in 6 months?
2. **Team situation** — Solo or co-founder(s)?
3. **Funding runway** — Bootstrapped, angel, or VC?
4. **Hard launch date** — Any deadline driving this?
5. **iLovePDF mention** — OK to do "vs iLovePDF" comparison pages (aggressive SEO) or stay neutral?
6. **Privacy/E2E encryption** — Priority for MVP, or Phase 2?
7. **On-device AI** — Want offline-mode AI on mobile, or cloud-only for MVP?
8. **Brand name** — Keep "getpdfpro" or do you want a different name? (Domain is yours either way.)
