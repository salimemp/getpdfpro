# Buyer Persona — "Solo Sarah" & "Indie Ilya" (Technical Entrepreneurs)

This persona document drives the landing page at `/for/founders`. Every
section of that page is anchored in one of the pain points / jobs
below — when the copy doesn't match a persona need, the page is wrong.

---

## Who they are

**Name pattern:** "Solo Sarah" (28-35, female-presenting) and "Indie
Ilya" (32-45, male-presenting). Both are the same persona, different
genders — copy tests against both.

**Role:** Solo technical founder, technical co-founder, or first
engineer at a seed-stage startup. Not a CEO-only; they ship code
themselves. They have a product in market, or are about to. The
company has 1-10 people, usually 1-3.

**Stack fluency:** Comfortable with command lines, REST APIs, Git,
CI/CD, Docker, OAuth flows. Reads technical documentation for fun.
Has opinions about Postgres, React, and Python versions. Knows what
WebSockets are. Has burned themselves on Webflow, no-code tools, and
"easy" SaaS at least once.

**Location:** Anywhere. US, EU, India, Southeast Asia, Latin America.
English-fluent, sometimes bilingual. Comfortable paying for software
in USD.

**Income reality:**
- Bootstrapped: revenue $1k-20k MRR, but personal income is tight
- Seed-funded: $50-200k in the bank, expenses covered, but every
  dollar still gets scrutinized
- Series A: $1M+ raised, more relaxed but still hate waste

**Age range:** 26-45, peaks at 30-38. They've been burned enough times
to be skeptical of marketing claims.

---

## What they're trying to do (jobs-to-be-done)

1. **Close a deal** — send a polished PDF contract / proposal / pitch
   deck to a prospect. The PDF is the artifact that represents them.
2. **Process a customer file** — convert a Word doc to PDF, merge a
   customer's contract with an NDA, compress a 40MB brochure to
   email-friendly.
3. **Share a polished doc internally** — investor update, team
   handbook, design review PDF.
4. **Operate the business** — invoice, expense report, signed
   agreement with a vendor.

In all four, the PDF is NOT the goal. The goal is "close the deal /
ship the work / move the project forward." The PDF is friction.

---

## Their pain points (what they're Googling at 11pm)

Ranked by frequency × intensity, from real search queries:

| # | Pain point | What they say | What they actually want |
|---|------------|---------------|-------------------------|
| 1 | **"Uploading a sensitive file to a server feels gross"** | "I just need to merge these contracts but the file has my customer's financials" | In-browser, no upload, no retention, no analytics |
| 2 | **"The file is 47MB and the tool is going to take 4 minutes"** | "I have a 50MB PDF and iLovePDF says it'll take 3 minutes" | Sub-10-second processing for normal docs |
| 3 | **"Free tier is fine until it isn't"** | "I need this 6 times today, not 1" | Generous free tier (50+/day), no ad-upgrade popups |
| 4 | **"Output is image-only, I can't select text"** | "After splitting the PDF, the result is just images" | Output preserves PDF structure (selectable text, bookmarks, form fields) |
| 5 | **"Desktop apps require install + updates"** | "I don't want to download Acrobat" | Browser-native, no install |
| 6 | **"Privacy policy is a 10-page novel about ads"** | "What's actually in the privacy policy?" | Clear, short, no-ads privacy posture |
| 7 | **"Free tier shows me ads"** | "Why am I seeing banner ads in a tool" | Zero ads, even on free |
| 8 | **"Subscription fatigue"** | "I have 14 SaaS subscriptions and 4 of them are <$10/mo each" | One subscription that covers everything PDF, transparent pricing |
| 9 | **"API access costs extra"** | "I want to script this from my own code" | Public API, fair pricing, no enterprise gatekeeping |
| 10 | **"The tool doesn't work in my terminal / CI"** | "I need this to work in my build pipeline" | CLI or HTTP API access |

---

## Their search queries (verbatim, by intent)

**Informational (early research):**
- "best pdf tool for developers"
- "pdf tool that runs in browser"
- "private pdf tool no upload"
- "ilovepdf alternative privacy"
- "pdf tool without ads"
- "is there a pdf tool that doesn't send my files to a server"

**Commercial (comparing options):**
- "ilovepdf vs smallpdf"
- "ilovepdf vs adobesign"
- "best pdf tool for startups"
- "pdf editor privacy comparison"
- "pdf tool open source"

**Transactional (ready to use):**
- "free pdf merge no signup"
- "compress pdf online"
- "merge pdf online free"
- "extract text from pdf online"
- "pdf to word converter online free"

**Long-tail (specific to their stack):**
- "pdf api for developers"
- "pdf cli tool"
- "self hosted pdf converter"
- "pdf library python"

---

## Their decision criteria (in order)

1. **Privacy** — "Will this tool see my data?" Top criterion. If the
   answer is unclear, they bounce. They are technical enough to
   check the network tab.
2. **Speed** — "Will it be done in 30 seconds, or do I need to wait?"
   They have low tolerance for upload-then-process-then-download.
3. **Cost** — "Is the free tier enough? If not, is the paid tier
   priced sensibly?" They compare $/month against actual usage.
4. **Output quality** — "Does the output preserve the source PDF's
   structure, or rasterize everything?" They check by selecting
   text in the result.
5. **No ads, no trackers** — "Does the free tier push me to upgrade
   with banner ads?" Strongly negative signal.
6. **Openness / transparency** — "Is the company clear about what
   they do? Can I see the privacy policy without a lawyer?"
7. **Brand / trust** — "Does this company have a track record?
   Are they a real team?" Solo founder with no LinkedIn = skip.

---

## Their objections (what we have to address in copy)

1. **"I don't trust free tools with my data."**
   → Address: in-browser processing, no file storage, technical
   proof in the privacy section.

2. **"Your pricing will go up / you'll get acquired / you'll enshittify."**
   → Address: solo founder, transparent pricing, no investor pressure
   to "grow the business", clear long-term roadmap.

3. **"I already have iLovePDF / Smallpdf in my bookmarks."**
   → Address: clear comparison table with sourced facts, "how to
   switch" instructions.

4. **"I'll have to upload and download every file — that's slow."**
   → Address: technical explanation of in-browser processing,
   benchmark numbers.

5. **"Your Pro tier is $5.99/mo — I don't pay for software that I
   can use for free."**
   → Address: clear "what you get for Pro", honest comparison
   between free and Pro, no dark patterns.

6. **"What happens to my files if your company disappears?"**
   → Address: in-memory processing means files are never stored,
   so there's no data loss event.

7. **"How do I know the result is correct?"**
   → Address: source-cited benchmark numbers, real-world examples,
   transparency about limitations.

---

## Their emotional state when they land on the page

- **Tired** of free tools that don't work
- **Skeptical** of marketing copy
- **Time-pressured** — they have 6 other things to do
- **Cautious** about privacy because they've been burned
- **Curious** about the "in-browser, no upload" claim because it
  sounds too good to be true

The page must:
- Be readable in 30 seconds (skimmable)
- Have specific numbers (not "fast" but "10 seconds for a 10-page
  contract")
- Have source citations (otherwise it's marketing, not evidence)
- Have a clear next step (CTA)
- Respect their intelligence (no condescending copy, no emoji
  overload, no exclamation marks)

---

## Page structure (one-to-one with the persona)

| Section | Persona need addressed | What it must include |
|---|---|---|
| Hero | Pain #1 + Pain #2 (privacy + speed) | Headline that names the pain, subhead that names the solution, single primary CTA |
| The 6-minute problem | All pains (agitate) | Specific scenario, real numbers, source citations |
| What you'd actually want | Need (transition) | 4-5 named requirements, framed as a list |
| The GetPDFPro way | Pain #1 + #4 + #5 (differentiators) | In-browser processing proof, structure-preserving output, zero ads |
| Toolkit | Pain #7 (breadth) | All 35 tools organized by what they do |
| For technical buyers | Pain #9 + #10 (API, CLI) | Public API, mobile apps, future integrations |
| Privacy & Security | Pain #1 + #6 (privacy) | Technical details, in-memory processing, GDPR posture |
| Pricing | Pain #3 (cost) | Free tier specifics, Pro tier value, no dark patterns |
| FAQ | All objections | 8-10 Q&As with sourced answers |
| Final CTA | Decision moment | Restate USP, single primary action, no upsell pressure |
