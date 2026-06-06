# SEO Strategy & Content Playbook

> Goal: rank #1–#3 for high-intent PDF tool keywords within 6 months.
> Built for solo founder, low budget, long-term compounding traffic.

---

## SEO Positioning

### Primary keyword universe
PDF tool searches fall into 4 buckets by intent:

1. **Tool-specific** (highest intent)
   - "merge PDF", "split PDF", "compress PDF", "PDF to Word", "PDF to JPG"
   - "merge PDF online free", "compress PDF to 1MB"
   - ~50K–500K monthly searches per tool in English alone

2. **Brand comparison** (high intent, lower volume)
   - "iLovePDF alternative", "Smallpdf vs X", "Adobe Acrobat alternative"
   - 1K–10K monthly per comparison

3. **How-to / educational** (mid intent, high volume)
   - "how to merge PDFs", "how to compress PDF", "how to convert PDF to Word"
   - 10K–100K monthly per topic

4. **Use-case / problem** (very high intent)
   - "compress PDF for email", "combine scanned documents", "edit PDF free"
   - 5K–50K monthly

### Our targets
Rank for **buckets 1 + 2 + 3** in 25 languages = ~10,000 keyword targets
in Year 1. Realistic ranking count: ~500 top-10, ~50 top-3 in Year 1
(assuming consistent content production).

---

## Technical SEO Foundation

### Already covered
- Cloudflare CDN (fast global delivery)
- WordPress with WPGraphQL + Next.js frontend
- Schema markup (Organization, SoftwareApplication, FAQ)
- XML sitemap
- Hreflang for 25 languages
- Mobile-first responsive design
- HTTPS everywhere

### Still needed
- [ ] Submit sitemap to Google Search Console + Bing Webmaster
- [ ] Set up Plausible analytics (privacy-friendly, no cookie banner needed)
- [ ] Configure Cloudflare Bot Fight Mode
- [ ] Set up log monitoring for crawl errors
- [ ] Implement canonical URLs
- [ ] Audit page speed (target 90+ on mobile)

### Page speed target
- Landing pages: LCP < 1.5s, FID < 100ms, CLS < 0.1
- Tool pages: LCP < 2s (tool UI is heavier)
- Blog posts: LCP < 1.5s, lazy-load images

---

## Content Pillars

Five content pillars, each owning a section of the site:

### Pillar 1: Tools (highest commercial intent)
**Format:** Landing page per tool, 1,500–3,000 words
**Examples:**
- /tools/merge — "Merge PDF Files Online — Free, Fast, Secure"
- /tools/compress — "Compress PDF to Any Size — Free PDF Compressor"
- /tools/pdf-to-word — "PDF to Word Converter — Accurate, Fast, Free"
**SEO wins:** Long-tail variants like "merge PDF online free no signup"

### Pillar 2: Comparisons (mid-intent, high-conversion)
**Format:** Side-by-side comparison, 1,500–2,500 words
**Examples:**
- /vs-ilovepdf
- /vs-smallpdf
- /vs-adobe-acrobat
- /vs-sejda
- /vs-pdf24
- /vs-soda-pdf
**SEO wins:** "[competitor] alternative" keywords

### Pillar 3: How-to guides (top of funnel, high volume)
**Format:** Step-by-step with screenshots, 1,500–3,000 words
**Examples:**
- /blog/how-to-merge-pdfs
- /blog/how-to-compress-pdf-without-losing-quality
- /blog/how-to-convert-pdf-to-word
- /blog/how-to-edit-a-pdf
- /blog/how-to-make-pdf-accessible
**SEO wins:** "how to" + "PDF" combinations

### Pillar 4: Use cases (mid-funnel, problem-aware)
**Format:** Problem → solution, 1,000–2,000 words
**Examples:**
- /blog/compress-pdf-for-email
- /blog/combine-scanned-pdfs-into-one
- /blog/sign-pdf-without-printer
- /blog/extract-tables-from-pdf
- /blog/translate-pdf-to-another-language
**SEO wins:** Problem-specific searches

### Pillar 5: Thought leadership (brand building)
**Format:** Opinion + analysis, 1,000–2,000 words
**Examples:**
- /blog/why-pdf-accessibility-matters
- /blog/ai-and-pdfs-the-future-of-document-work
- /blog/zero-knowledge-encryption-explained
- /blog/why-we-built-a-better-ilovepdf
**SEO wins:** Brand searches, backlinks, social shares

---

## First 30 Posts (Launch Quarter)

### Week 1: Foundation (5 posts)
1. How to merge PDFs (3,000 words, comprehensive guide)
2. How to compress a PDF (2,500 words)
3. iLovePDF vs GetPDFPro (2,000 words)
4. How to convert PDF to Word (2,500 words)
5. How to edit a PDF (2,000 words)

### Week 2: More tools (5 posts)
6. How to split a PDF
7. How to compress a PDF to 1MB
8. How to sign a PDF electronically
9. How to convert PDF to JPG
10. PDF to Word vs Google Docs import

### Week 3: Comparisons (5 posts)
11. Smallpdf vs GetPDFPro
12. Adobe Acrobat Online vs GetPDFPro
13. Sejda vs GetPDFPro
14. PDF24 vs GetPDFPro
15. Soda PDF vs GetPDFPro

### Week 4: Use cases (5 posts)
16. How to compress a PDF for email
17. How to combine scanned documents into one PDF
18. How to extract tables from a PDF
19. How to translate a PDF to another language
20. How to OCR a scanned PDF

### Week 5 (and beyond): Batch production
Aim for **4–8 posts per week** to hit 100 posts in 6 months.

---

## Keyword Research Process

### Free tools
- Google Search Console (after launch)
- Google Trends
- Ubersuggest (free tier)
- AnswerThePublic
- Keyword Surfer (Chrome extension)

### Paid tools (Phase 2 budget)
- Ahrefs ($99/mo) — best backlink + keyword research
- SEMrush ($120/mo) — similar
- Surfer SEO ($69/mo) — content optimization

### Process
1. Find a topic
2. Check Google search results (SERP) — what ranks? What format?
3. Identify keyword variants (e.g. "merge PDF" / "combine PDF" / "join PDF files")
4. Check volume + difficulty (Ubersuggest free)
5. Write a comprehensive piece (1,500+ words)
6. Add schema markup (FAQ, HowTo)
7. Internal link from 3+ related posts
8. Submit to indexing API

---

## Link Building (off-page SEO)

### Year 1 strategy (free + cheap)
- **Product Hunt launch** (free, ~5K visits, ~50 backlinks)
- **Hacker News "Show HN"** (free, 10K+ visits if it hits front page)
- **Reddit** — r/productivity, r/sysadmin, r/webdev, r/selfhosted, r/privacy
- **IndieHackers** — build-in-public story
- **Dev.to / Hashnode** — cross-post technical articles
- **Comparison pages get backlinks naturally** — sites reviewing PDF tools will link to you

### Year 2+ (with revenue)
- Sponsor newsletters (PDF Toolkit Weekly, etc.)
- Guest posts on productivity blogs
- Affiliate program (referral fees for influencers)
- HARO (Help a Reporter Out) — pitch quotes to journalists

---

## Multilingual SEO

### 25 languages = 25× the keyword universe

**Approach:**
- Use WPML (paid, $79 one-time) or Polylang (free) on WordPress
- Each major post translated into 5–10 priority languages
- Use hreflang tags correctly
- Don't auto-translate — hire native speakers or use professional services

### Priority languages for content (vs just UI)
1. English (canonical)
2. Spanish (huge market)
3. Portuguese (Brazil, large)
4. French (Europe + Africa)
5. German (high-value users)
6. Hindi (India, your home market)
7. Arabic (RTL, big market)
8. Japanese (high-value users)
9. Italian
10. Korean

### Translation cost
- ~$0.10/word for professional
- A 2,000-word post = $200 per language
- 50 posts × 10 languages × $200 = $100K — too expensive
- **Better:** Translate the top 30 posts only, 3–5 languages = $9K–$15K

### Translation workflow
1. Write in English
2. Native speaker (or yourself if bilingual) translates
3. Proofread
4. Publish with hreflang tags
5. Update English post → back-translate to other languages

---

## Local SEO (future)

GetPDFPro is a SaaS, not a local business, so local SEO matters less. But:
- If you ever want an enterprise sales motion, having a Google Business Profile
  for your registered business address helps
- If you do any in-person events (conferences, meetups), create location pages

---

## KPIs to Track

### Months 1–3 (foundation)
- Index coverage: 50+ pages indexed in Google
- Organic impressions: 1K+/month
- Organic clicks: 50–200/month
- Top 10 rankings: 5+

### Months 4–6 (compounding)
- Indexed: 200+ pages
- Organic impressions: 50K+/month
- Organic clicks: 1K–3K/month
- Top 10: 50+ keywords
- Top 3: 5+ keywords

### Months 7–12 (scaling)
- Indexed: 500+ pages
- Organic impressions: 500K+/month
- Organic clicks: 20K–50K/month
- Top 10: 500+ keywords
- Top 3: 50+ keywords

### Track in
- Plausible (privacy-friendly analytics)
- Google Search Console (free, must-have)
- Bing Webmaster Tools (free, often overlooked)
- Ahrefs/SEMrush (paid, when revenue allows)

---

## Quick Wins (do this week)

1. ✅ Submit sitemap to Google Search Console
2. ✅ Submit to Bing Webmaster
3. ✅ Set up Plausible analytics
4. ✅ Publish 5 tool landing pages with target keywords
5. ✅ Publish 3 comparison pages
6. ✅ Publish 5 how-to guides
7. ✅ Internal linking: every blog post links to 3+ related tools
8. ✅ Add FAQ schema to every tool page
9. ✅ Set up Plausible custom events for "tool used" (conversion tracking)
10. ✅ Launch on Product Hunt within 30 days of public launch
