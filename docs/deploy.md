# GetPDFPro — Deployment Guide

This is the source of truth for getting GetPDFPro into production. Two hosts, two deploy contracts:

| Host    | What runs there         | Auto-deploys from             |
|---------|-------------------------|-------------------------------|
| Vercel  | `apps/web` (Next.js)    | `main` branch → vercel.json   |
| Railway | `apps/api` + worker     | `main` branch → Dockerfile    |

The Vercel side is already live at `https://getpdfpro-web.vercel.app`. This doc covers Railway.

---

## Vercel (web app) — already shipped ✅

Settings on the `getpdfpro-web` project (Vercel dashboard):

| Field              | Value                                                          |
|--------------------|----------------------------------------------------------------|
| **Root Directory** | *(blank / empty — points to repo root)*                        |
| **Build Command**  | *(default — `vercel.json` overrides)*                          |
| **Output Dir**     | *(default — `vercel.json` overrides)*                          |
| **Install Cmd**    | *(default — `vercel.json` overrides)*                          |
| **Node Version**   | 20.x                                                           |

`vercel.json` at the repo root owns the actual commands:

```json
{
  "framework": "nextjs",
  "installCommand": "npm install --workspaces --include-workspace-root",
  "buildCommand": "npm run build --workspace=web",
  "outputDirectory": "apps/web/.next"
}
```

**Why these settings**

- Empty Root Directory → Vercel treats the whole monorepo as the project.
- `--workspaces --include-workspace-root` → canonical npm-workspaces install.
- `--workspace=web` → builds only the web app, skips FastAPI.
- Explicit `outputDirectory` → Vercel doesn't have to guess where `.next` lives.

**Auto-deploy:** every push to `main` triggers a Vercel build.

**Custom domain:** add `app.getpdfpro.com` in Vercel → Settings → Domains, then CNAME in Cloudflare.

---

## Railway (FastAPI + Celery) — deploy in 10 min

Railway will host three things in one project:

1. **`getpdfpro-api`** — FastAPI service (web, public URL)
2. **`getpdfpro-worker`** — Celery worker (background, no public URL)
3. **`redis`** — managed Redis (broker + result backend)

### One-time setup in the Railway dashboard

#### 1. Create the project

- Go to https://railway.com/new
- Click **Deploy from GitHub repo**
- Pick `salimemp/getpdfpro`
- Railway will spin up a default service and start building — ignore it for now.

#### 2. Configure the **API** service

Click on the auto-created service, then **Settings**:

| Setting                     | Value                                |
|-----------------------------|--------------------------------------|
| **Service Name**            | `getpdfpro-api`                      |
| **Root Directory**          | *(blank — build context = repo root)* |
| **Dockerfile Path**         | `apps/api/Dockerfile.api`            |
| **Watch Patterns**          | `apps/api/**`                        |
| **Healthcheck Path**        | `/health`                            |
| **Healthcheck Timeout**     | `30`                                 |
| **Port** (auto)             | `$PORT`                              |

> **Why blank Root Directory?** Railway's build context is always the repo
> root, and the Dockerfile paths use full `apps/api/...` prefixes so they
> resolve correctly. Setting Root Directory to `apps/api` would upload
> only that subtree but the Dockerfile's `COPY` paths would still expect
> the repo-root layout, leading to `failed to compute cache key: "/app":
> not found` build errors.

#### 3. Add the **Worker** service

- **+ New** → **GitHub Repo** → pick `salimemp/getpdfpro` again
- **Settings**:

| Setting             | Value                              |
|---------------------|------------------------------------|
| **Service Name**    | `getpdfpro-worker`                 |
| **Root Directory**  | *(blank — same as API)*            |
| **Dockerfile Path** | `apps/api/Dockerfile.worker`       |
| **Watch Patterns**  | `apps/api/**`                      |

**Important:** worker has no port, no healthcheck. In **Settings** → **Networking**, **do NOT generate a domain** — leave it as a private service. If Railway tries to assign a domain, that's fine; it just won't get traffic.

#### 4. Add **Redis**

- **+ New** → **Database** → **Redis**
- Railway will provision Redis in seconds.
- In each of the two services above, go to **Variables** → **New Variable** → **Add Reference** → pick the Redis service. Railway will inject `REDIS_URL` automatically into both. Verify by going to the API service's **Variables** tab and confirming `REDIS_URL` is there pointing to `redis.railway.internal`.

#### 5. Set environment variables on the API service

In the `getpdfpro-api` service's **Variables** tab, add:

| Variable                      | Example / source                                                                                     |
|-------------------------------|------------------------------------------------------------------------------------------------------|
| `ENV`                         | `production`                                                                                          |
| `LOG_LEVEL`                   | `info`                                                                                                |
| `CORS_ORIGINS`                | `https://getpdfpro-web.vercel.app,https://app.getpdfpro.com`                                         |
| `APP_VERSION`                 | `0.1.0`                                                                                               |
| `SUPABASE_URL`                | from your Supabase project (or leave blank for now)                                                  |
| `SUPABASE_ANON_KEY`           | from Supabase                                                                                         |
| `SUPABASE_SERVICE_ROLE_KEY`   | from Supabase                                                                                         |
| `GEMINI_API_KEY`              | from Google AI Studio                                                                                 |
| `R2_*`                        | from Cloudflare R2 (when ready — workers can run without R2 for now)                                 |
| `STRIPE_*`                    | from Stripe (later)                                                                                   |
| `RAZORPAY_*`                  | from Razorpay (later)                                                                                 |
| `FREE_TIER_DAILY_TASKS`       | `50` (default)                                                                                        |
| `FREE_TIER_MAX_FILE_SIZE_MB`  | `100` (default)                                                                                       |

**Set the same variables on the worker** (it needs `REDIS_URL` to talk to Celery, plus `GEMINI_API_KEY` / `R2_*` for AI/storage tasks).

#### 6. Wire up the public URL

- In the `getpdfpro-api` service → **Settings** → **Networking** → **Generate Domain**
- You'll get something like `getpdfpro-api-production.up.railway.app`
- Copy it. This is your public API URL.

#### 7. Custom domain (optional)

In **Settings** → **Networking** → **Custom Domain** → add `api.getpdfpro.com`. Then in Cloudflare DNS add a CNAME `api → <railway-provided-target>.up.railway.app`.

### Verify the deploy

Once Railway finishes building (the build log will show `pip install` then `uvicorn` starting), hit the public URL:

```bash
# Health
curl https://getpdfpro-api-production.up.railway.app/health
# → {"status":"ok","service":"getpdfpro-api","version":"0.1.0","env":"production"}

# API root
curl https://getpdfpro-api-production.up.railway.app/
# → {"service":"getPDFPro API","docs":"/docs","health":"/health"}
```

If `ENV=production` the `/docs` and `/redoc` Swagger UIs are disabled. Set `ENV=staging` in a staging service to keep them on.

### Smoke-test the async queue

```bash
# Enqueue a fake job (base64 of "%PDF-1.0\n" — won't actually parse, but proves
# the round trip works)
curl -X POST https://getpdfpro-api-production.up.railway.app/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"job_type":"pdf_to_text","file_b64":"JVBERi0K"}'

# → {"task_id":"<uuid>","job_id":"<uuid>","status":"queued"}

# Poll for status
curl https://getpdfpro-api-production.up.railway.app/api/v1/jobs/<uuid>
# → {"task_id":"<uuid>","job_id":"<uuid>","status":"failure", "error":"..."}
```

A real PDF will get a real result. The endpoint is wired and the worker pulls from Redis — the round trip is the proof.

---

## Repo layout (deploy-relevant files only)

```
.
├── apps/
│   ├── web/                    # Next.js 15 — Vercel
│   │   └── (no vercel.json — root one wins)
│   └── api/                    # FastAPI — Railway
│       ├── Dockerfile.api      # ← API service (build context = repo root)
│       ├── Dockerfile.worker   # ← Worker service
│       ├── requirements.txt
│       ├── runtime.txt         # python-3.12.4
│       ├── Procfile            # fallback if Railway's Nixpacks runs first
│       ├── .env.example        # all env vars, with descriptions
│       └── app/
│           ├── main.py         # FastAPI app
│           ├── config.py       # pydantic settings
│           ├── celery_app.py   # Celery + tasks
│           └── routers/
│               ├── pdf.py      # /api/v1/pdf/* sync
│               └── jobs.py     # /api/v1/jobs/* async
├── .dockerignore               # at repo root — applies to the API build
├── vercel.json                 # Vercel build contract
├── railway.toml                # (decorative — see note below)
└── package.json                # npm workspaces, root
```

**`railway.toml` note:** Railway reads the dashboard settings as the source of truth — `railway.toml` is mostly for documenting the contract and for `railway up` CLI users. The two Dockerfiles in `apps/api/` are the actual deploy contracts.

---

## Local dev (one machine)

```bash
# 1. Install once
npm install --workspaces --include-workspace-root

# 2. Web
npm run dev --workspace=web    # http://localhost:3000

# 3. API
cd apps/api
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Need a local Redis for the worker tests; brew install redis && brew services start redis
export REDIS_URL=redis://localhost:6379
uvicorn app.main:app --reload --port 8000    # http://localhost:8000

# 4. Worker (separate terminal)
cd apps/api && source .venv/bin/activate
export REDIS_URL=redis://localhost:6379
celery -A app.celery_app:celery_app worker --loglevel=info
```

---

## Cost snapshot

| Service | Plan | Cost |
|---|---|---|
| Vercel (web) | Hobby | $0 (free tier, 100 GB egress) |
| Railway API | Developer | ~$5/mo (512 MB RAM, 0.5 vCPU) |
| Railway Worker | Developer | ~$5/mo |
| Railway Redis | Developer | ~$3/mo (small) |
| Supabase | Free | $0 (50K MAU, 500 MB db) |
| Cloudflare R2 | Free | $0 (10 GB, **zero egress**) |
| Resend | Free | $0 (3K emails/mo) |
| **Total at MVP** | | **~$13/mo** |

Stripe + Razorpay are revenue-side, not infra cost. Gemini free tier is fine until ~10K requests/day.
