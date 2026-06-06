# Google AdSense Compliance Checklist for GetPDFPro

> Goal: get the site AdSense-approved on first application, and keep
> it compliant for the long term. Covers both the **publisher
> requirements** (site must qualify) and **content policies** (what
> you can and can't publish).

---

## Before You Apply: Site-Wide Requirements

### 1. Original, high-quality content
- [ ] At least **25–30 substantial posts** (1,500+ words each) before applying
- [ ] Mix of content types: how-to guides, comparisons, product updates
- [ ] All content is **original** — not scraped, not spun, not AI-only with no editing
- [ ] You have a clear editorial process (even if it's just you writing)
- [ ] No auto-generated content that adds no value

**Why:** AdSense reviewers check content quality. Sites with thin or
duplicate content get rejected. The "How to Merge PDFs" post is
3,000+ words of original, well-structured content — exactly what they
want to see.

### 2. Required pages (must exist and be linked from footer)
- [ ] **About** page — who you are, what the company does
- [ ] **Contact** page — real contact method (email, form, or address)
- [ ] **Privacy Policy** — comprehensive, accurate, GDPR/CCPA-compliant
- [ ] **Terms of Use** — clear, enforceable
- [ ] **Cookie Notice** — if you use ANY cookies at all

See `docs/LEGAL/SPEC.md` for what each must contain.

### 3. Site design
- [ ] Clean navigation (header + footer)
- [ ] Working internal links (no broken links)
- [ ] Mobile-responsive (test in Google's Mobile-Friendly Test)
- [ ] HTTPS everywhere (Cloudflare handles this)
- [ ] Fast page load (90+ PageSpeed on mobile)
- [ ] Clear hierarchy: Home → Categories → Posts
- [ ] No popup spam or interstitials blocking content

### 4. Domain & hosting
- [ ] Custom domain (getpdfpro.com ✓)
- [ ] Domain at least **1 month old** before applying
- [ ] Working HTTPS with valid SSL
- [ ] Site is publicly accessible (not behind login)

### 5. Traffic & history
- [ ] **Not required** to have traffic for AdSense approval, but helps
- [ ] Site at least 3–6 months old helps
- [ ] Google Search Console set up (not required, but recommended)

### 6. Webmaster Tools setup
- [ ] Google Search Console verified
- [ ] Sitemap submitted
- [ ] robots.txt exists and is correct
- [ ] No manual actions in Search Console

---

## Content Policies: What You Can and Can't Publish

### ✅ ALLOWED
- PDF how-to guides
- Tool comparison pages (iLovePDF vs GetPDFPro, etc.)
- Product updates and changelogs
- Educational content about PDFs, accessibility, document workflows
- Industry news and commentary
- Customer success stories
- Company news

### ❌ NOT ALLOWED (will get you banned)
- Adult content
- Copyrighted material (lyrics, books, articles you don't own)
- Sale of counterfeit goods
- Illegal content (drugs, weapons, hacked data)
- Content encouraging violence or hate
- Misleading health claims
- Misleading financial claims
- Clickbait (headline doesn't match content)
- Auto-generated content with no human review
- Doorway pages (thin content designed only for SEO)

### ⚠️ GRAY AREA — be careful
- **"Best [tool]" comparison pages** — fine, but must be honest and disclose
  affiliate relationships
- **AI-generated content** — must be edited, fact-checked, add value
- **Sponsored posts** — must be disclosed with `rel="sponsored"`
- **Affiliate links** — must be disclosed
- **Reviews of competitors** — must be honest, not defamatory
- **Crypto/forex content** — heavily restricted
- **Health/medical PDFs** — must not give medical advice, just describe the tools

---

## Ad Placement Best Practices

### DO
- Place ads **between content sections** (after 1–2 paragraphs of text)
- Use **responsive ad units** (Google's recommended sizes)
- Have a clear **content-to-ad ratio** — at least 60% content, 40% or less ad space
- Test multiple placements and optimize based on performance
- Use **in-article ads** (native-looking, less intrusive)
- Label sponsored content clearly

### DON'T
- Place ads that **cover content** (AdSense will reject)
- Use "above the fold only" ad layout (Google penalizes)
- Place too many ads per page (3–4 max on long articles)
- Use misleading ad labels ("Download Now" buttons that lead to ads)
- Place ads in popups, modals that block content
- Encourage users to click ads ("Click here to support us")
- Place ads near navigation that could cause accidental clicks

### Recommended placements
- **Below the title**, before the first paragraph (one ad)
- **Mid-article**, after 2–3 paragraphs (one ad)
- **End of article**, before comments/related posts (one ad)
- **Sidebar** (sticky but doesn't cover content on mobile)
- **No ads in the tool UI itself** — only on blog posts and content pages

---

## AdSense-Specific Technical Setup

### ads.txt file
Create `https://getpdfpro.com/ads.txt`:
```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```
Replace `pub-XXXXXXXXXXXXXXXX` with your actual publisher ID. This
prevents ad fraud and is required by Google.

### Auto-ads (recommended for start)
1. Get AdSense account approved
2. Go to **Ads** → **Get code** → **Auto ads**
3. Add the single snippet to your `<head>`:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```
4. Google will automatically place ads on your pages

### Manual ad units (more control)
1. **Ads** → **By ad unit** → **Display ads**
2. Choose format: Display, In-article, In-feed
3. Copy the code
4. Paste into your WordPress theme (via custom HTML widget) or
   use a plugin like **Ad Inserter** (free, well-maintained)

### Recommended plugins
- **Ad Inserter** (free) — best for manual placement
- **Advanced Ads** (free + paid) — for advanced targeting
- **Quick AdSense** (lightweight)

### Cookie consent (GDPR)
If you serve EU users and use AdSense:
- **Affects AdSense behavior:** EU users must give consent before
  personalized ads
- **Recommended:** Use a free CMP (Consent Management Platform) like
  **Cookiebot** (free for <100 pages) or **CookieYes**
- Or use **Plausible Analytics** (no cookies, but AdSense still drops
  cookies — so you still need a CMP for AdSense)

---

## Pre-Application Checklist (run through this before applying)

### Content quality
- [ ] 25+ posts, 1,500+ words each
- [ ] All posts are proofread, with images, internal links
- [ ] No AI slop — every post has a human review
- [ ] Categories and tags are organized
- [ ] Archive pages render correctly

### Site structure
- [ ] About page ✓
- [ ] Contact page ✓ (real email, not a form that doesn't work)
- [ ] Privacy Policy ✓
- [ ] Terms of Use ✓
- [ ] Cookie Notice ✓
- [ ] Footer with links to all of the above
- [ ] Sitemap.xml exists and submits to Google
- [ ] robots.txt configured

### Technical
- [ ] HTTPS everywhere
- [ ] PageSpeed Insights 85+ on mobile, 90+ on desktop
- [ ] No 404 errors in Search Console
- [ ] ads.txt file ready
- [ ] Google Search Console verified

### Legal
- [ ] Privacy Policy mentions AdSense and Google's data use
  (you can paste Google's standard disclosure)
- [ ] Cookie Policy mentions Google AdSense cookies
  (add the standard Google disclosure text)
- [ ] Terms of Use doesn't prohibit ads

### Reality check
- [ ] You won't apply with placeholder content and expect to pass
- [ ] You'll spend 1–2 hours weekly on content for the first 6 months
- [ ] You understand rejection is common — fix issues, reapply in 30 days

---

## After Approval: Ongoing Compliance

### Weekly
- [ ] Check AdSense dashboard for policy violations
- [ ] Review new posts before publishing for policy compliance
- [ ] Monitor ad performance (CTR, RPM, fill rate)

### Monthly
- [ ] Review Search Console for manual actions
- [ ] Check for broken pages, dead links
- [ ] Audit ad placements (remove underperforming ones)
- [ ] Check that ad-to-content ratio stays healthy

### Quarterly
- [ ] Review AdSense policies for updates (Google changes them)
- [ ] Update Privacy Policy + Cookie Notice if needed
- [ ] Audit any new content categories for policy fit
- [ ] Review and refresh top-performing content

### Red flags that get you banned
- 🚩 Sudden traffic spikes from irrelevant sources
- 🚩 Users clicking ads but bouncing immediately
- 🚩 Lots of low-quality content published quickly
- 🚩 Ads placed where they could be confused with navigation
- 🚩 Same ad slot showing different content rapidly
- 🚩 Self-clicking (NEVER click your own ads)

---

## What AdSense Won't Allow On Your Site

Beyond content policies, AdSense has specific restrictions on:

### Page types
- ❌ Error pages (404, 500)
- ❌ Login pages
- ❌ Thank you / confirmation pages
- ❌ Pages with no content
- ❌ PDFs (sigh — we are a PDF company, so this matters)

### PDF implications
**Important:** Google does NOT serve AdSense ads on PDF files directly.
This means:
- Don't make your blog posts available as PDFs without first showing
  them on a webpage
- If you offer free downloadable PDFs, link to them from a webpage
  (the webpage can have ads, the PDF itself cannot)
- For "tool result" pages, the HTML page is monetizable, the downloaded
  PDF is not

### What this means for GetPDFPro
- ✅ Blog posts → monetizable
- ✅ Tool landing pages → monetizable
- ✅ Comparison pages → monetizable
- ✅ Pricing page → monetize carefully (don't overdo ads)
- ❌ Downloaded PDF files → not monetizable (which is fine, they leave your site)
- ❌ Login/signup pages → no ads

---

## Alternative Monetization (Beyond AdSense)

For a tool like GetPDFPro, AdSense is probably the **secondary** revenue
stream. Primary is the subscription (Pro $4.99/mo). AdSense fills the gap
on free-tier users and content readers.

| Channel | Revenue potential | Effort |
|---|---|---|
| **Pro subscriptions** | $50K–$500K/yr at scale | High (need product) |
| **AdSense on blog** | $500–$5K/mo at 100K monthly visitors | Medium |
| **Affiliate links** (PDF software, SaaS tools) | $200–$2K/mo | Low |
| **Sponsored posts** | $500–$5K per post | Medium |
| **Display ads via Ezoic/Mediavine** (after 50K sessions/mo) | Higher RPM than AdSense | Low (after threshold) |
| **Selling downloadable PDF templates** | $100–$2K/mo | Medium |

**Pro tip:** When you hit 50K sessions/month, apply to **Mediavine** or
**Ezoic** — they pay 2–5× more than AdSense for the same traffic.

---

## Summary: Path to AdSense Revenue

1. **Month 1–2:** Set up site, publish 25+ posts, set up Search Console
2. **Month 3:** Apply to AdSense
3. **Month 4:** If approved, place auto-ads. If rejected, fix issues + reapply in 30 days
4. **Month 6–12:** Grow traffic, optimize ad placements, build toward Mediavine threshold
5. **Year 2+:** Diversify — sponsorships, affiliates, Mediavine if traffic justifies

**Realistic Year 1 AdSense revenue:** $0.50–$2 RPM × 50K pageviews = $25–$100/month. Not life-changing, but it pays for hosting and a small coffee budget.
