# GetPDFPro — Deployment Guide

## Vercel (web app)

**One-time dashboard setup** for the `getpdfpro-web` project:

| Field | Value |
|---|---|
| **Root Directory** | *(empty / blank — points to repo root)* |
| **Install Command** | *(leave default — `vercel.json` overrides)* |
| **Build Command** | *(leave default — `vercel.json` overrides)* |
| **Output Directory** | *(leave default — `vercel.json` overrides)* |
| **Node Version** | 20.x |

All actual commands live in `apps/web/vercel.json`:

```json
{
  "framework": "nextjs",
  "installCommand": "npm install --workspaces --include-workspace-root",
  "buildCommand": "npm run build --workspace=web",
  "outputDirectory": "apps/web/.next"
}
```

### Why these settings

- **Empty Root Directory** → Vercel treats the whole monorepo as the project
- **`--workspaces --include-workspace-root`** → canonical npm-workspaces install for monorepos (replaces fragile `cd ../..` tricks)
- **`--workspace=web`** → builds only the web app, not the FastAPI service
- **Explicit outputDirectory** → Vercel doesn't have to guess where `.next` lives

### Auto-deploy

Every push to `main` triggers a Vercel build. Production URL: `https://getpdfpro-web.vercel.app`.

### Custom domain

In Vercel → Settings → Domains → add `app.getpdfpro.com`. Then add the CNAME in Cloudflare/Hostinger DNS.

---

## Railway (FastAPI backend) — TODO

Settings TBD when we deploy `apps/api`. The `Procfile` and `runtime.txt` are already in place:

```
web: cd apps/api && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Python 3.12, FastAPI + PyMuPDF + Celery + Redis. Will write a Railway guide when we get there.

---

## Local dev

```bash
# one-time
npm install --workspaces --include-workspace-root

# all apps (turbo orchestrator)
npm run dev

# just the web app
npm run dev --workspace=web
```

Web runs on http://localhost:3000.
