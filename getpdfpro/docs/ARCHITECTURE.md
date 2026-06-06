# GetPDFPro — Architecture

## System Overview

```
                          ┌──────────────────────────┐
                          │  CLOUDFLARE              │
                          │  - DNS, SSL, CDN, WAF     │
                          │  - Email routing          │
                          │  - R2 (object storage)    │
                          └────────────┬─────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
   ┌────────▼────────┐       ┌─────────▼──────────┐      ┌────────▼────────┐
   │  HOSTINGER      │       │  VERCEL (free)     │      │  RAILWAY ($5+)  │
   │  WordPress      │       │  Next.js 15        │      │  FastAPI        │
   │  (headless CMS) │       │  app.getpdfpro.com │      │  api.getpdfpro  │
   │  blog.getpdfpro │       │                    │      │  .com           │
   └─────────────────┘       └─────────┬──────────┘      └────────┬────────┘
                                       │                          │
                                       │         ┌────────────────┤
                                       │         │                │
                              ┌────────▼─────────▼───┐   ┌─────────▼────────┐
                              │  SUPABASE            │   │  CELERY WORKERS  │
                              │  - Auth (50K MAU)    │   │  (Railway)       │
                              │  - Postgres          │   │  - PDF jobs      │
                              └──────────────────────┘   │  - AI jobs       │
                                                         │  - Email sends   │
                                                         └─────────┬────────┘
                                                                   │
                                                         ┌─────────▼────────┐
                                                         │  REDIS           │
                                                         │  (Upstash free)  │
                                                         │  - Celery broker │
                                                         │  - WS pub/sub    │
                                                         │  - Cache         │
                                                         └──────────────────┘
```

## Data Flow: User Uploads & Processes a PDF

```
1. User clicks "Upload" in web/mobile
2. Client requests pre-signed PUT URL from API
3. API returns R2 pre-signed URL (15-min expiry)
4. Client uploads directly to R2 (bypasses API)
5. Client notifies API: "upload done, file at s3://..."
6. API creates job in DB, enqueues Celery task
7. Celery worker picks up task, downloads from R2
8. Worker calls PyMuPDF for the operation
9. Worker uploads result to R2, updates DB with signed GET URL
10. Client polls or receives WebSocket notification
11. Client downloads from R2 via signed URL
12. Cloudflare Worker cron deletes `uploads/*` after 24h
```

## Data Flow: AI Chat via WebSocket

```
1. Client opens WebSocket to wss://api.getpdfpro.com/ai/chat
2. Sends auth token (Supabase JWT)
3. Server validates, opens stream
4. Client sends: { pdf_id: "...", question: "Summarize page 3" }
5. Server fetches PDF text from R2, truncates to fit context
6. Server enqueues Celery AI job
7. Worker calls Gemini API (streaming)
8. Worker publishes tokens to Redis pub/sub channel
9. WS endpoint subscribes to channel, forwards tokens to client
10. Client renders tokens as they arrive (ChatGPT-style)
11. Cache result in Redis for 24h
12. Decrement user's AI credit counter
```

## Repository Structure

```
getpdfpro/
├── apps/
│   ├── web/         # Next.js 15 (TypeScript, App Router)
│   ├── api/         # FastAPI (Python 3.12, Pydantic v2)
│   ├── mobile/      # Flutter (Dart, single codebase)
│   └── workers/     # Celery workers (Python, shares code with api/)
├── packages/
│   ├── shared-types/# TypeScript types + Pydantic schemas
│   ├── pdf-engine/  # PyMuPDF wrappers, OCR helpers
│   └── ui-tokens/   # Design tokens
├── infra/
│   ├── cloudflare/  # R2, DNS, Workers
│   ├── railway/     # API + worker deploy configs
│   ├── vercel/      # Web deploy configs
│   └── github/      # GitHub Actions workflows
└── docs/            # Architecture, runbooks, ADRs
```

## Why This Stack Wins on Cost

| Choice | TCO (Year 1) | Alternative | TCO (Year 1) |
|---|---|---|---|
| Cloudflare R2 | $50–100 | AWS S3 | $600–2,400 |
| Gemini Flash 8B | $50–200 | OpenAI GPT-4o | $500–2,000 |
| Vercel free + Railway $5 | $60–150 | AWS Lambda + ALB | $1,200–3,600 |
| Supabase free | $0–25 | Auth0 | $1,200+ |
| Resend free | $0–20 | SendGrid Pro | $240+ |
| **Total** | **$160–495** | **$3,740–9,240** | |

**Saving: ~$3,500–8,700/Year 1** at equivalent scale.

## Key Design Decisions

### 1. Why Celery (not BullMQ)?
BullMQ is Node.js only. Since the backend is Python/FastAPI, Celery is the natural fit. Adding a separate Node.js worker process just for queue management adds runtime overhead, deployment complexity, and hosting cost — all violations of the cost-minimization mandate.

### 2. Why Cloudflare R2 (not S3, not Railway Volumes)?
- **R2**: $0.015/GB storage, **$0 egress** — the egress is the killer feature
- **S3**: $0.023/GB + $0.09/GB egress — costs add up fast with user downloads
- **Railway Volumes**: $0.25/GB, no S3 API, no CDN integration

At 500GB and 5TB egress/month: R2 = $8 vs S3 = $460. This is the single biggest cost win.

### 3. Why Supabase Auth (not Auth0/Clerk/roll-our-own)?
- Ships all 6 auth methods (email+pw, Google, GitHub, magic link, passkey, biometrics via WebAuthn) out of the box
- 50K MAU free tier
- Bundled with Postgres if we want to consolidate
- Open-source (can self-host if we outgrow free tier)

### 4. Why Gemini Flash 8B (not GPT-4o)?
- 10× cheaper per token ($0.0375/M input vs $2.50/M for GPT-4o)
- Comparable quality for PDF Q&A, summaries, translations
- 1M token context (handles entire books)
- Free tier: 60 RPM
- Pro available as fallback for complex reasoning

### 5. Why Flutter (not React Native)?
- Single codebase → 6 platforms (iOS, Android, Web, macOS, Windows, Linux)
- Mature PDF plugins (pdfx, syncfusion_flutter_pdf, printing)
- AI/voice plugin ecosystem
- Truly native feel on each platform
- Web: Flutter Web for the app, but Next.js handles the marketing site

## Database Schema (initial)

```sql
-- Users (synced from Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription tier
CREATE TYPE tier AS ENUM ('free', 'pro', 'team', 'business');

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tier tier NOT NULL DEFAULT 'free',
  stripe_subscription_id TEXT,
  razorpay_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  status TEXT NOT NULL,  -- active, canceled, past_due
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI credits (per user, per month)
CREATE TABLE ai_credits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  credits_remaining INT NOT NULL,
  credits_used INT DEFAULT 0,
  UNIQUE(user_id, period_start)
);

-- File processing jobs
CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE job_type AS ENUM (
  'merge', 'split', 'compress', 'convert_pdf_to_word', 'convert_word_to_pdf',
  'convert_pdf_to_jpg', 'convert_jpg_to_pdf', 'sign', 'ocr', 'summarize',
  'translate', 'redact', 'watermark', 'rotate', 'protect', 'unlock'
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type job_type NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  input_files TEXT[] NOT NULL,    -- R2 keys
  output_file TEXT,                -- R2 key
  options JSONB,                   -- type-specific options
  error TEXT,
  progress INT DEFAULT 0,          -- 0-100
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- Usage tracking (for rate limiting)
CREATE TABLE usage_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_log_user_id_created ON usage_log(user_id, created_at DESC);
```

## API Routes (v1)

```
POST   /api/v1/auth/...           # Supabase handles (frontend talks directly)
GET    /api/v1/me                 # Get current user
PATCH  /api/v1/me                 # Update profile
GET    /api/v1/me/usage           # Usage stats

POST   /api/v1/files/upload-url   # Get R2 pre-signed PUT URL
POST   /api/v1/files/confirm      # Confirm upload, create job
GET    /api/v1/files/:id/download # Get R2 pre-signed GET URL

POST   /api/v1/jobs               # Create processing job
GET    /api/v1/jobs               # List user's jobs
GET    /api/v1/jobs/:id           # Get job status
DELETE /api/v1/jobs/:id           # Cancel job

POST   /api/v1/tools/merge        # Convenience: upload + merge in one
POST   /api/v1/tools/split
POST   /api/v1/tools/compress
POST   /api/v1/tools/convert
# ... etc for all 25 tools

GET    /api/v1/billing/plans      # List available plans
POST   /api/v1/billing/checkout   # Create Stripe/Razorpay checkout session
POST   /api/v1/billing/portal     # Customer portal link
POST   /api/v1/billing/webhook    # Stripe + Razorpay webhooks

WS     /api/v1/ai/chat            # AI chat WebSocket
GET    /api/v1/ai/credits         # Remaining credits

GET    /api/v1/health             # Health check
```

## ADR (Architecture Decision Records)

See `docs/adr/` for full list. Key ones:
- ADR-001: Use MuPDF over Adobe PDF Services API (cost)
- ADR-002: Use Cloudflare R2 over AWS S3 (egress)
- ADR-003: Use Supabase Auth over roll-our-own (time-to-market)
- ADR-004: Use Celery over BullMQ (stack fit)
- ADR-005: Use Gemini Flash 8B over GPT-4o (cost)
- ADR-006: WordPress as headless CMS (not full app)
- ADR-007: Flutter for cross-platform apps
