# WordPress Headless Setup — GetPDFPro

> Spin up the marketing site on WordPress headless, paired with the
> Next.js app at `app.getpdfpro.com`. Goal: live marketing site within
> a weekend.

---

## TL;DR — Recommended Path

| Option | Setup time | Monthly cost | Best for |
|---|---|---|---|
| **Hostinger Shared** (what you have) | 1 hour | ~$3–10/mo (already paid) | Marketing site, MVP |
| **Hostinger VPS** (KVM 1) | 3–4 hours | ~$5–12/mo | More control, can run side services |
| **Railway** | 30 min | $5+/mo | Unified with the rest of the stack |

**My recommendation for you (solo, cost-min, marketing-first):**

Start with **Hostinger Shared** since you already have it. Migrate to **Hostinger VPS** later if you want more control or need to host side services. Skip Railway for WordPress — it works but you're paying for what's effectively a static-ish marketing site.

---

## Option Comparison: Hostinger Shared vs Hostinger VPS

### Hostinger Shared (Business plan ~$3.99/mo)

**Pros**
- Already paid for (you have this)
- Managed: zero security updates, zero server admin
- One-click WordPress install via hPanel
- Free SSL via Let's Encrypt
- Free email (limited)
- 200GB SSD, ~100GB bandwidth

**Cons**
- No Docker, no custom processes
- Limited cron (often disabled or throttled)
- No SSH access on cheap tiers
- Resource limits (CPU/RAM shared with other tenants)
- Can't run anything but PHP/WordPress

**Verdict:** Great for marketing site. Don't try to host the FastAPI or Node side services here.

---

### Hostinger VPS (KVM 1 ~$4.99/mo)

**Pros**
- Full root access, dedicated resources
- Run Docker, custom cron, anything
- One VPS can host WordPress + a small API + side services
- Snapshot backups (free on KVM)
- IPv6 included
- Predictable cost

**Cons**
- **You** manage security updates (apt upgrade weekly)
- Initial setup: 3–4 hours (vs 1 hour on shared)
- Need to configure: SSH keys, firewall (ufw), fail2ban, automatic backups, monitoring
- No managed WordPress — you install + harden yourself

**Verdict:** Best long-term. Worth the setup time. Run WordPress + a "tools-worker" service (a small Node/Python service for things like sitemap generation, broken-link checking).

---

### Railway

**Pros**
- 5-minute deploy from GitHub
- Same platform as the rest of your stack
- Free SSL
- Database included (Postgres)
- Easy to scale

**Cons**
- $5/mo minimum + usage
- For an always-on WordPress, more expensive than shared
- For a static-ish marketing site, overkill

**Verdict:** Skip for WordPress. Use Railway for the API and workers (already planned).

---

## My recommendation: Start with Hostinger Shared, plan VPS migration

**Phase 1 (now, week 1):** Use existing Hostinger Shared
- One-click WordPress install
- WPGraphQL + WPML + essential plugins
- Get the site live and ranking
- Cost: $0 (already paid)

**Phase 2 (when you have >$1K MRR, month 3+):** Migrate to Hostinger VPS
- More control for hosting side services
- Better performance
- One bill, one server

---

## Step-by-Step Setup (Hostinger Shared, 1 hour)

### Step 1: Point DNS to Hostinger (10 min)

In Cloudflare DNS (where the domain currently is):
- **Remove** the parked Hostinger page record (if any)
- **Add** an A record: `getpdfpro.com` → Hostinger server IP (hPanel shows it)
- **Add** a CNAME: `www` → `getpdfpro.com`
- **Add** a CNAME: `blog` → `getpdfpro.com` (for WordPress)
- Or, if you want WP at root: don't add `blog`, just point root to Hostinger

For now, put WordPress at `getpdfpro.com/blog` so the root stays available for the Next.js marketing landing.

Actually, simpler — put WordPress at the **root** for SEO (more on this in SEO-STRATEGY.md), and put the Next.js app at `app.getpdfpro.com`. SEO for a content-heavy site benefits from root domain.

### Step 2: One-click WordPress install (5 min)

1. Log into hPanel (https://hpanel.hostinger.com)
2. Go to **Hosting** → **Manage** → **Auto Installer**
3. Select **WordPress**
4. Choose the latest version, set admin email, install at `/` (root)
5. Note the admin URL: `https://getpdfpro.com/wp-admin`

### Step 3: Install essential plugins (15 min)

In WP Admin → Plugins → Add New, install:

**Required (for headless setup):**
- **WPGraphQL** (`wp-graphql/wp-graphql`) — exposes WP content as GraphQL API for Next.js
- **WPGraphQL for ACF** (if using Advanced Custom Fields)
- **Yoast SEO** or **Rank Math SEO** — meta tags, sitemaps, schema
- **WPML Multilingual CMS** ($79 one-time, but the best) — for 25+ languages
  - Cheaper alt: **Polylang** (free, also works with WPGraphQL)
- **Wordfence Security** — firewall, malware scan
- **UpdraftPlus** — automatic backups (free tier)

**Recommended (for SEO + UX):**
- **W3 Total Cache** or **WP Super Cache** — page caching
- **Smush** — image compression
- **ShortPixel** — better image optimization (paid, but cheap)
- **Redirection** — 301 redirects
- **Table of Contents Plus** — for long blog posts
- **Plausible Analytics** (if not using their hosted script)

**For content marketing specifically:**
- **Astra** or **Kadence** theme (lightweight, SEO-friendly)
- **Elementor** (only if you need visual editing; otherwise stick to Gutenberg blocks)

### Step 4: Configure security (10 min)

1. **Change admin URL** — use a plugin like WPS Hide Login (so `/wp-admin` is hidden)
2. **Disable XML-RPC** — add to wp-config.php (see template in `infra/wordpress/`)
3. **Limit login attempts** — Wordfence handles this
4. **Set strong admin password** + 2FA via Wordfence
5. **Disable file editing in WP admin** — add `define('DISALLOW_FILE_EDIT', true);` to wp-config.php

### Step 5: Set up WPGraphQL (5 min)

1. Settings → WPGraphQL → Enable
2. Test at `https://getpdfpro.com/graphql` (GraphiQL IDE should be available)
3. Custom post types and fields auto-exposed

### Step 6: Create initial content structure (15 min)

In WP Admin, create these post types and pages:

**Pages:**
- Home (later will be replaced by Next.js)
- Pricing
- Features
- About
- Contact
- Privacy Policy (placeholder — final from Iubenda)
- Terms of Use (placeholder)
- Cookies
- Acceptable Use
- DPA (Data Processing Addendum)
- Subprocessor List
- Security
- Status

**Comparison pages (SEO goldmine):**
- vs iLovePDF
- vs Smallpdf
- vs Adobe Acrobat Online
- vs Sejda
- vs PDF24
- vs Soda PDF

**Blog categories:**
- PDF Tips
- Productivity
- Comparisons
- Product Updates
- Accessibility
- AI & PDFs

**First 5 blog posts (for SEO seeding):**
1. "How to Merge PDFs: A Complete Guide (2026)"
2. "iLovePDF vs GetPDFPro: Honest Comparison (2026)"
3. "How to Compress a PDF Without Losing Quality"
4. "Best Free PDF Tools in 2026 (Tested & Ranked)"
5. "PDF Accessibility: What It Means and Why It Matters"

### Step 7: Configure Cloudflare in front of WordPress (10 min)

1. In Cloudflare DNS, ensure `getpdfpro.com` is proxied (orange cloud ON)
2. Cloudflare Settings:
   - SSL/TLS: **Full (strict)**
   - Always Use HTTPS: ON
   - Auto Minify: HTML, CSS, JS all ON
   - Brotli: ON
   - Browser Cache TTL: 4 hours
   - Security Level: Medium
   - Bot Fight Mode: ON
3. Page Rules:
   - `getpdfpro.com/wp-admin*` — Security: High, Cache: Bypass
   - `getpdfpro.com/wp-login*` — Security: High, Cache: Bypass
   - `getpdfpro.com/graphql*` — Cache: Bypass

### Step 8: Connect to Next.js (5 min)

In Next.js (`apps/web/lib/wordpress.ts`):
```ts
const WP_GRAPHQL_URL = process.env.WORDPRESS_GRAPHQL_URL || 'https://getpdfpro.com/graphql';

export async function fetchWP(query: string, variables?: any) {
  const res = await fetch(WP_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 }, // ISR
  });
  return res.json();
}
```

This is already wired in the architecture. Just need to set the env var.

### Step 9: Verify and launch (5 min)

1. Visit `https://getpdfpro.com` — should load
2. Visit `https://getpdfpro.com/graphql` — GraphiQL should work
3. Visit `https://getpdfpro.com/wp-admin` — login works (after changing admin slug)
4. Submit sitemap to Google Search Console: `https://getpdfpro.com/sitemap.xml`
5. Submit to Bing Webmaster Tools
6. (Optional) Set up Plausible analytics

**Time: ~1 hour. Cost: $0 incremental.**

---

## Step-by-Step Setup (Hostinger VPS, 3-4 hours)

Skip if you're going with shared. Documented for Phase 2 migration.

### Step 1: Provision KVM 1 VPS
- Hostinger hPanel → VPS → Order KVM 1
- Choose OS: **Ubuntu 24.04 LTS**
- Note the root password (or set up SSH key in the panel)

### Step 2: Initial server hardening (30 min)
```bash
ssh root@YOUR_VPS_IP

# Update
apt update && apt upgrade -y

# Create non-root user
adduser getpdfpro
usermod -aG sudo getpdfpro
mkdir -p /home/getpdfpro/.ssh
cp ~/.ssh/authorized_keys /home/getpdfpro/.ssh/
chown -R getpdfpro:getpdfpro /home/getpdfpro/.ssh

# Disable root SSH
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable

# Fail2ban
apt install -y fail2ban
systemctl enable fail2ban
```

### Step 3: Install Docker (5 min)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker getpdfpro
```

### Step 4: Deploy WordPress via Docker Compose

See `infra/wordpress/docker-compose.yml` in the monorepo. Brings up:
- WordPress (latest)
- MariaDB 11
- WPGraphQL via image plugin
- WP-CLI for automation

### Step 5: SSL via Caddy or Traefik
Recommended: Caddy (auto-HTTPS, simple config). Or use Cloudflare Tunnel to avoid exposing port 80.

### Step 6: Backups
- UpdraftPlus → S3-compatible (Cloudflare R2)
- Daily snapshot of VPS via Hostinger panel
- 30-day retention

---

## Recommended Plugins (curated)

### Must-have
- WPGraphQL (free)
- WPML ($79) or Polylang (free)
- Yoast SEO or Rank Math (both free, Rank Math is more feature-rich)
- Wordfence Security (free tier)
- UpdraftPlus (free tier)
- WPS Hide Login (free)

### Nice-to-have
- WP Super Cache (free) — static page caching
- Smush (free) — image compression
- ShortPixel Image Optimizer (paid) — better compression
- Redirection (free) — 301 redirect manager
- Table of Contents Plus (free) — for long articles
- Broken Link Checker (free) — find dead links
- WPForms Lite (free) — contact form

### Skip
- Jetpack (heavy, privacy concerns, expensive at scale)
- WooCommerce (we use Stripe + Razorpay directly)
- Elementor (Gutenberg + Kadence is enough)
- Most "AI content" plugins (writes garbage, Google penalizes)

---

## SEO Foundation Checklist

- [ ] XML sitemap enabled (Yoast/Rank Math handles)
- [ ] robots.txt configured
- [ ] Schema markup (Organization, SoftwareApplication, FAQ)
- [ ] Open Graph + Twitter Card meta
- [ ] Canonical URLs
- [ ] Hreflang for multilingual (handled by WPML/Polylang)
- [ ] Page speed: 90+ on mobile (use Cloudflare APO + caching)
- [ ] HTTPS everywhere
- [ ] Submit to Google Search Console
- [ ] Submit to Bing Webmaster
- [ ] Create Google Business Profile (if applicable)
- [ ] Set up Plausible or GA4 (Plausible recommended for GDPR)
- [ ] Internal linking structure
- [ ] Image alt text discipline
- [ ] 301 redirect map for any old URLs

See `docs/SEO-STRATEGY.md` for the full content plan.

---

## Monitoring

- **Uptime:** UptimeRobot (free, 50 monitors) or Better Stack (free tier)
- **Security:** Wordfence email alerts
- **Performance:** Cloudflare Analytics (built-in, free)
- **Backups:** UpdraftPlus email + R2 storage

---

## What to skip (don't do)

- ❌ Don't install 50+ plugins — every plugin is a security + perf risk
- ❌ Don't use a heavy theme (Astra/Kadence/GeneratePress are fine; avoid multipurpose themes)
- ❌ Don't host videos directly — embed YouTube or use Cloudflare Stream
- ❌ Don't run a forum/buddypress/etc. — security nightmare
- ❌ Don't enable comments without anti-spam (Akismet or Antispam Bee)
- ❌ Don't use the default `admin` username
- ❌ Don't leave the WP version visible (security)
- ❌ Don't use weak hosting for a high-traffic site (if you grow past 100K visits/mo, consider VPS or Cloudflare Workers for static pages)

---

## Quick Cost Summary

| Item | Cost |
|---|---|
| Hostinger Shared (current) | $0 incremental |
| WPML (one-time) | $79 |
| Wordfence Premium (optional) | $99/yr |
| Smush Pro (optional) | $60/yr |
| Total upfront | ~$79 |
| Total annual | ~$100–200 (optional upgrades) |
