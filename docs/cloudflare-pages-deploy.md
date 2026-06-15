# Cloudflare Pages deployment

This document explains how to deploy `apps/web` to Cloudflare Pages after the Vercel → Cloudflare migration. The build is configured and tested; you do the platform setup.

## One-time setup

### 1. Create a Cloudflare account

- Go to <https://dash.cloudflare.com/sign-up>
- Sign up (free tier is enough — no card required for the Pages free plan)
- Pick "Workers & Pages" from the dashboard sidebar

### 2. Create a Pages project

- **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
- Authorize the GitHub org (`salimemp`)
- Pick the **`salimemp/getpdfpro`** repository
- **Project name**: `getpdfpro-web` (this becomes the `*.pages.dev` subdomain)
- **Production branch**: `main`

### 3. Configure the build

The Cloudflare Pages UI will ask for build settings. Fill in:

| Setting | Value |
|---|---|
| **Framework preset** | **None** (we have a custom build via OpenNext) |
| **Root directory** | `apps/web` |
| **Build command** | `pnpm install && pnpm pages:build` |
| **Build output directory** | `.open-next` |
| **Install command** | *(leave blank — `pnpm install` in the build command above handles it)* |
| **Environment variables** | See below |

**Why Root directory = `apps/web` and not blank:**

Setting Root directory to `apps/web` is the key fix. With it blank (the default), Cloudflare's runner does two things that break our build:

1. It runs its own `npm ci` against the **repo root** before executing the build command. The root has its own `package.json` (for turbo + supabase tooling) with a stale `package-lock.json` (regenerated during the PR #25 monorepo consolidation, but its entries no longer match the root's trimmed manifest). `npm ci` strict mode fails with dozens of `Missing X from lock file` errors before the build command ever runs.
2. It looks for `wrangler.toml` at the repo root and reports `No Wrangler configuration file found` — ours is at `apps/web/wrangler.toml`.

By setting Root directory to `apps/web`, the runner:
- finds `wrangler.toml` and `open-next.config.ts` immediately,
- runs from the right context, so `pnpm install` reads `apps/web/pnpm-lock.yaml` (which is what we ship), and
- the build command's `pnpm pages:build` runs from `apps/web/` and writes `.open-next/` there — which matches Build output directory = `.open-next`.

The `pnpm install && pnpm pages:build` chain inside the build command replaces the older `cd apps/web && pnpm install --filter web... && pnpm pages:build` — the `cd` is unnecessary once Root directory is set, and the `pnpm install` in the build command is what actually installs the web app's deps (the Install command field is intentionally left blank so Cloudflare doesn't pre-run `npm ci`).

**Important**: do NOT set the "Node.js version" preset — OpenNext requires Node 20+, and Cloudflare Pages' default (20.x) is fine. If you see an older default, change to 20.

### 4. Environment variables

In **Settings → Environment variables**, add the following for **Production** (and Preview if you want):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://osjtyipxwpkmzsextbne.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(the verified 208-char anon key from Supabase — paste via the Cloudflare UI which has no known truncation issues)* |
| `NEXT_PUBLIC_API_URL` | `https://api.getpdfpro.com` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (your Stripe live key) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_live_...` (if you have one) |
| `RESEND_API_KEY` | `re_...` (for any future transactional email — optional for now) |
| `GEMINI_API_KEY` | *(optional, for AI tools)* |

Click **Save** after each. Cloudflare encrypts secrets at rest and exposes them to the worker runtime. There is no known truncation or silent-drop bug on the Cloudflare side (the Vercel one we were fighting is a Vercel-specific issue).

### 5. First deploy

After saving env vars, click **Save and Deploy** on the project setup page (or **Retry deployment** from the deployments tab if it already tried to build with missing vars).

The build takes 1-2 minutes. The first deployment may show "Cancel" or "Failure" briefly if the OpenNext bundle is new — the build is complex, and Cloudflare's free tier is sometimes flaky on first runs. If it fails, click **Retry deployment**.

### 6. Verify

Once the build is green, Cloudflare will give you a `https://getpdfpro-web.pages.dev` URL. Test:

- `/` → home page renders
- `/login` → form shows, **no "Supabase isn't configured" banner**
- `/tools/merge` → PDF tool loads
- `/pricing` → pricing page
- `/api/v1/health` (via `lib/api.ts` to Railway) → 200 OK

To check env vars landed correctly, open browser DevTools on `/login` and run:

```js
// Check that the Supabase client initializes
const r = await fetch('/_next/static/chunks/2377-*.js')
const t = await r.text()
console.log('JWT length:', [...t.matchAll(/eyJ[A-Za-z0-9_\-\.]{50,}/g)].map(m => m[0].length))
// Should print 208+
```

### 7. DNS cutover

Once `*.pages.dev` is working, point `app.getpdfpro.com` to it:

1. **Cloudflare Pages** → your project → **Custom domains** → **Set up a custom domain**
2. Enter `app.getpdfpro.com`
3. Cloudflare will give you a CNAME target like `getpdfpro-web.pages.dev`
4. If `getpdfpro.com` is on Cloudflare DNS, this is automatic. If on a different registrar, add the CNAME record manually:
   ```
   Type: CNAME
   Name: app
   Value: getpdfpro-web.pages.dev
   TTL: Auto
   ```
5. DNS propagates in 1-60 minutes (usually <5)

During the transition, Vercel and Cloudflare may both serve requests. That's fine — the app is the same code on both.

### 8. Decommission Vercel

Once Cloudflare is serving production traffic for 24+ hours without issues:

1. Vercel dashboard → **Settings** → **Danger Zone** → **Delete Project**
2. **Important**: don't do this until you've verified DNS is fully propagated, otherwise you may have a brief outage
3. Optional: revoke the Vercel Personal Access Token at <https://vercel.com/account/tokens>

## Ongoing workflow

Every push to `main` automatically triggers a Cloudflare Pages build. The build runs `pages:build` which:
1. Runs `next build` to produce the `.next/` output
2. OpenNext converts that to a Cloudflare Worker at `.open-next/worker.js`
3. Copies `_headers` to the build output for Cloudflare to apply

Build times: ~90 seconds for a full build. Faster than Vercel.

## Troubleshooting

### Build fails with `npm error code EUSAGE` / `Missing: @opennextjs/cloudflare@1.19.11 from lock file` (or 100+ other "Missing" lines)

**Symptom:** the build log shows Cloudflare running `npm clean-install` (or `npm ci`), which fails with `EUSAGE` and a long list of `Missing: <package>@<version> from lock file` errors, well before the actual `pnpm install` in the build command ever runs.

**Cause:** Root directory is set to blank (the default) instead of `apps/web`. Cloudflare's runner auto-runs `npm ci` against the repo root before the build command. The root `package-lock.json` is stale (it was last regenerated during the PR #25 monorepo consolidation and its entries no longer match the root's trimmed `package.json`), so `npm ci` strict mode rejects the install. This happens *before* your build command runs, which is why the `pnpm install` in the build command is never reached.

**Fix:** go to **Settings → Builds & deployments** and change **Root directory** from blank to `apps/web`. The build command and build output directory also need to drop the `cd apps/web` and `apps/web/.open-next` prefixes (since the runner is already in `apps/web`). See the table in step 3 above for the exact values.

The wrangler.toml lookup warning (`No Wrangler configuration file found`) is a related symptom of the same root cause — with the wrong Root directory, Cloudflare scans the wrong place.

### Build fails with "Cannot find module @opennextjs/cloudflare"

The dep isn't installed. Run:
```bash
cd apps/web && pnpm install
```

### Build succeeds but `/login` shows "Supabase isn't configured" banner

Env vars didn't land. Go to **Settings → Environment variables** and verify the values are there. Cloudflare encrypts them in the UI display, but the actual values should be the full strings.

If you want to confirm:
```bash
# Use wrangler locally with the same env vars
cd apps/web
pnpm pages:dev
# Visit http://localhost:8788
```

### Build cache issues

If a deploy doesn't pick up your latest code (chunk hashes are stale), push an empty commit:
```bash
git commit --allow-empty -m "chore: trigger Cloudflare rebuild"
git push
```

Cloudflare's cache is much less aggressive than Vercel's — this should rarely be needed.

### Custom domain SSL issues

If `app.getpdfpro.com` shows an SSL error after the CNAME cutover, the cert hasn't propagated yet. Wait 5-10 minutes and try again. Cloudflare usually issues the cert within 60 seconds of the CNAME being detected.
