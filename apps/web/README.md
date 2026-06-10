# GetPDFPro — apps/web

The Next.js 15 web app for GetPDFPro. Marketing site, tool UI, account dashboards.

## Stack

- Next.js 15 (App Router, React 19)
- TypeScript (strict)
- Tailwind CSS
- Supabase (auth + DB)
- lucide-react (icons)

## Local development

```bash
# from repo root
npm install
cp apps/web/.env.example apps/web/.env.local
# fill in the values
npm --workspace web run dev
```

App runs on http://localhost:3000.

## Build

```bash
npm --workspace web run build
```

## Deploy

Pushed to `main` → auto-deploys to Vercel.

Vercel config: see `vercel.json` in this directory.
