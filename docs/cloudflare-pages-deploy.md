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
| **Root directory** | `apps` |
| **Build command** | `cd web && pnpm install && pnpm pages:build` |
| **Build output directory** | `web/.open-next` |
| **Install command** | *(leave blank — `pnpm install` in the build command above handles it)* |
| **Environment variables** | See below |

**Why Root directory = `apps` and not `apps/web` or blank:**

The first build attempts used `apps/web` and blank respectively; both failed. The "v2 root directory strategy" Cloudflare uses has two quirks:

- With Root directory blank, the runner does an `npm ci` against the repo root before the build command. The root's stale `package-lock.json` (from before the PR #25 monorepo consolidation) fails npm ci strict mode, and the actual build never starts.
- With Root directory = `apps/web`, the v2 strategy mangles the path during `cd` resolution and tries to chdir to a non-existent directory (`/opt/buildhome/repo/app/web`, with the `s` from `apps` dropped).

Setting Root directory to just `apps` and putting the `cd web` inside the build command avoids both bugs. The runner is happy with a top-level directory, and the build command handles the deeper `cd` natively (no path normalization involved).

**Why the build command's `cd web && pnpm install`:**

- `pnpm install` reads `apps/web/pnpm-lock.yaml` and installs the web app's deps (including `@opennextjs/cloudflare` and `wrangler`).
- `pnpm pages:build` then runs the OpenNext build, which produces `.open-next/worker.js` + static assets. The script also renames `worker.js` → `_worker.js` (the Cloudflare Pages convention) and copies `_headers` + `_redirects` into `.open-next/`.
- Build output directory = `web/.open-next` because the runner is still in `apps/`.

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

**Cause:** Root directory is set to blank (the default) instead of `apps`. Cloudflare's runner auto-runs `npm ci` against the repo root before the build command. The root `package-lock.json` is stale (it was last regenerated during the PR #25 monorepo consolidation and its entries no longer match the root's trimmed `package.json`), so `npm ci` strict mode rejects the install. This happens *before* your build command runs, which is why the `pnpm install` in the build command is never reached.

**Fix:** go to **Settings → Builds & deployments** and change **Root directory** from blank to `apps`. The build command needs to add a `cd web &&` prefix (since the runner is now in `apps/`, not `apps/web/`), and the build output directory needs the `web/` prefix. See the table in step 3 above for the exact values.

The wrangler.toml lookup warning (`No Wrangler configuration file found`) is a related symptom of the same root cause — with the wrong Root directory, Cloudflare scans the wrong place.

### Build succeeds ("✨ Your site was deployed!") but every page 404s at `*.pages.dev`

**Symptom:** the build log ends with `Success: Your site was deployed!` and `Uploading... (N/N)` for several hundred files, but visiting `https://getpdfpro-web.pages.dev/` (or any page) returns `404 Not Found` from Pages.

**Cause:** the Cloudflare Pages deploy uploaded the static assets, but the request handler (the OpenNext Worker) was never registered. Pages auto-detects a request handler only if the build output contains a file named **`_worker.js`** (not `worker.js`). Our build outputs `.open-next/worker.js` (OpenNext's standard name) but Pages looks for `_worker.js` and finds nothing, so all requests fall through to Pages' default 404.

This is a **code-side issue** (the original PR #28 setup assumed a Cloudflare Workers-style deploy, not Pages), and the fix lives in `apps/web/`:

- `apps/web/wrangler.toml` — set `pages_build_output_dir = ".open-next"` (was `".open-next/worker"`), drop the `main` and `[build]` fields (Pages reads `_worker.js` from the output dir, not from wrangler.toml).
- `apps/web/package.json` — extend `pages:build` / `pages:dev` / `pages:deploy` to also `cp .open-next/worker.js .open-next/_worker.js` so Pages can find the handler.
- `apps/web/_redirects` — new file with `/* /_worker.js/:splat 200` so all routes reach the worker (Pages' default would otherwise 404 non-static paths).

After the fix lands, push a new commit to `main` and the next build will deploy the worker. `https://getpdfpro-web.pages.dev/` will start returning the actual home page.

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
