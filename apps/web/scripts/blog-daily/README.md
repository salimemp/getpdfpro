# Daily Blog Generator

A cron-driven pipeline that publishes one fact-verified, fact-cited,
source-backed blog post per day — one per tool, one search intent, content
capsule structure, WebP cover image, internal linking on both ends.

## What it produces

For each daily run, the pipeline:

1. **Picks a topic** from a 35-tool rotation (the 35 PDF tools live at
   `/tools/<slug>`). Skips tools that already have a `-guide.json` post.
2. **Generates the post body** via Gemini 1.5 Flash 8B with a strict
   prompt enforcing:
   - Content capsule / BLUF (Bottom Line Up Front) — first paragraph
     is the direct answer, no throat-clearing
   - One search intent per post (e.g., "merge pdf online" only — not
     "merge pdf online AND split pdf")
   - Real facts from a curated `firstHandProof` list (live API,
     self-source code paths, PDF spec URLs, etc.)
   - Inline citations `[1]`, `[2]` that map to the sources section
   - 2-4 internal links to other tools or blog posts
3. **Generates a WebP cover image** (1280×720, ~20 KB) procedurally
   with PIL — brand-coherent blue gradient + tool glyph + title.
4. **Fact-checks** the post (filler phrase detection + LLM-as-judge
   hallucination check against firstHandProof).
5. **Publishes** to `content/blog/<slug>.json` + `public/blog/cover-<slug>.webp`.
6. **Commits and pushes** the new post to `main` — triggers the existing
   deploy-workers GitHub Actions workflow.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  mavis cron (daily, 02:00 IST)                              │
│  ─────────────────────────────────────────────────────────  │
│  python3 apps/web/scripts/blog-daily/run.py                 │
│                                                             │
│  1. pick_next_topic()  ← topic_queue.py                     │
│  2. write_post()       ← writer.py    → Gemini 1.5 Flash 8B │
│  3. fact_check()       ← fact_check.py → Gemini (judge)     │
│  4. publish_post()     ← publisher.py  → JSON + WebP        │
│  5. git_commit + push  ← run.py                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
            GitHub Actions (deploy-workers.yml)
                          │
                          ▼
                  Cloudflare Workers live
                          │
                          ▼
            /tools/<slug>  ←── RelatedBlogGuide ──→  /blog/<slug>
            (links OUT)                              (links IN)
```

## Files

| File | Purpose |
|------|---------|
| `topic_queue.py` | 35 entries × (toolSlug, searchIntent, firstHandProof facts). |
| `writer.py`      | Builds the strict Gemini prompt + calls Gemini + parses response. |
| `image_gen.py`   | Procedural WebP cover generation with PIL. |
| `fact_check.py`  | Filler phrase check + LLM-as-judge hallucination check. |
| `publisher.py`   | Writes the post JSON + cover WebP + alt sidecar. |
| `migrate_inline_to_json.mts` | One-time: extract 5 legacy inline posts from `lib/blog.ts` to JSON. |
| `run.py`         | Orchestrator. CLI entry point. Commits + pushes on success. |

Plus the supporting web app changes:

| File | Purpose |
|------|---------|
| `apps/web/lib/blog.ts` | Updated to scan `content/blog/*.json` (was inline). |
| `apps/web/components/RelatedBlogGuide.tsx` | Renders a "Read the guide" callout below each tool when a related blog post exists. |
| `apps/web/app/tools/[slug]/layout.tsx` | Shared layout that injects `<RelatedBlogGuide toolSlug={slug} />` below every tool. |

## Running locally

### Dry-run (no API calls — show what would happen)
```bash
cd apps/web/scripts/blog-daily
python3 run.py --dry-run
```

### Generate one post for a specific tool
```bash
GEMINI_API_KEY=<your-key> python3 run.py --tool merge
```

### Daily rotation (the cron does this)
```bash
GEMINI_API_KEY=<your-key> GH_TOKEN=<github-pat> python3 run.py
```

Exit codes:
- `0` — published (or dry-run)
- `1` — generation failed (API error, parse error)
- `2` — fact-check failed; post written to `content/blog/_review/` for manual review

## Cron setup

The cron job runs `python3 run.py` once per day with:
- `GEMINI_API_KEY` — Gemini API key from https://aistudio.google.com/apikey
- `GH_TOKEN` — GitHub PAT with `contents:write` scope on salimemp/getpdfpro
- `PATH` — must include `/opt/homebrew/bin` for python3

The cron uses `mavis cron self` with a TTL of 2h. Notification is sent
to the user only on a status change (no change → silent skip).

## Adding new topics

Edit `topic_queue.py` and append a new `TopicEntry` to the list:

```python
{
    "toolSlug": "my-new-tool",
    "toolName": "My New Tool",
    "category": "edit",  # one of: organize | optimize | convert-to | convert-from | edit | security | intelligence | accessibility
    "searchIntent": "do the thing online",
    "secondaryKeywords": ["keyword 1", "keyword 2"],
    "firstHandProof": [
        {
            "fact": "GetPDFPro does X in the browser without uploading the file.",
            "source": "apps/web/app/tools/my-new-tool/page.tsx",
            "sourceType": "self",
        },
        {
            "fact": "The library used is documented at...",
            "source": "https://...",
            "sourceType": "external",
        },
    ],
},
```

The cron picks it up on the next rotation.

## Cost

- **LLM**: ~$0.0001 per post (gemini-1.5-flash-8b is cheap). ~30 posts/month = $0.003/month.
- **LLM judge**: another ~$0.0001 per post for the hallucination check.
- **Image generation**: $0 (procedural PIL, no API).
- **Total**: ~$0.01/month.

## Quality guarantees

Every published post:

1. **Targets exactly one search intent.** The topic queue enforces this.
2. **Front-loads the answer** in the first paragraph (the writer prompt
   is explicit about this).
3. **Cites real sources** via inline `[N]` markers that map to the
   sources section. The fact-checker verifies no claim is fabricated.
4. **Has a WebP cover** with alt text written alongside.
5. **Links out** to 2-4 related pages (in the writer prompt).
6. **Gets linked in** from the corresponding `/tools/<slug>` page via
   the `<RelatedBlogGuide>` component.
7. **Passes the filler check** (no "in today's digital age", "let's
   dive in", etc.).
8. **Has structured data** (BlogPosting JSON-LD) emitted by the blog
   post page (`apps/web/app/blog/[slug]/page.tsx`) — title, author,
   date, OG image, etc.

## What happens if a post fails fact-check

`run.py` writes the post to `content/blog/_review/<slug>.json` with
the full check report, then exits with code 2. The cron surfaces this
to the user. Nothing is published.

This means a bad generation never reaches the live site — even if the
LLM hallucinates, the post is quarantined for human review.

## Migration history

| Date | Event |
|------|-------|
| 2026-06-18 | Initial pipeline + 5 legacy posts migrated to JSON |
| (future) | Add a vitest coverage test for `lib/blog.ts` loader |
