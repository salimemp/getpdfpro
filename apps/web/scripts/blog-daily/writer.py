"""
Writer — calls Gemini to generate the post body in content-capsule format.

Output is a JSON object matching the BlogPost type in apps/web/lib/blog.ts.

Content capsule technique (B.L.U.F. — Bottom Line Up Front):
  1. First paragraph: direct answer to the search intent. No throat-clearing.
  2. "30-second version" — a short ordered list of the key steps.
  3. Main explanation in 3-5 sections.
  4. Real numbers / first-hand proof (numbers MUST come from firstHandProof).
  5. "Try it" CTA linking to /tools/<slug>.

The writer is told:
  - One search intent, one job-to-be-done. No "and also" posts.
  - Front-load the answer in the first 2 sentences.
  - Cite real facts from firstHandProof. If a fact isn't in firstHandProof,
    do NOT make one up — leave it out and rely on a single cited source.
  - Human voice. No "in today's fast-paced world" filler.
  - The output is JSON, not markdown.
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any

from topic_queue import TopicEntry


# ---------------------------------------------------------------------------
# Output schema — mirrors the BlogPost type in apps/web/lib/blog.ts
# ---------------------------------------------------------------------------
WRITER_SCHEMA = {
    "type": "object",
    "required": ["title", "description", "excerpt", "sections", "tags"],
    "properties": {
        "title": {
            "type": "string",
            "description": (
                "The H1. Format: '<Action> + <keyword> + year qualifier if useful>'. "
                "Examples: 'How to merge PDFs in 2026', 'Compress PDF without losing quality: a 2026 guide'. "
                "Never clickbait ('You won't believe...'). Always leads with the action."
            ),
        },
        "description": {
            "type": "string",
            "description": (
                "Meta description for OG + search. 140-160 chars. Plain English. "
                "Reads as a benefit statement, not a keyword list. Must include "
                "the primary keyword."
            ),
        },
        "excerpt": {
            "type": "string",
            "description": (
                "1-2 sentence summary shown on the blog index. Front-loads the answer. "
                "Same voice as the title — direct, no throat-clearing."
            ),
        },
        "tags": {
            "type": "array",
            "items": {"type": "string"},
            "description": (
                "3-5 tags. Each tag is lowercase, no spaces (use hyphens), "
                "and a real category a reader might filter by. Examples: "
                "'merge', 'tutorial', 'beginner', 'compress', 'performance', "
                "'deep-dive', 'comparison'."
            ),
        },
        "sections": {
            "type": "array",
            "description": (
                "The post body. Each section is one of: "
                "{type:'p',text}, {type:'h2',text}, {type:'h3',text}, "
                "{type:'ul',items:[...]}, {type:'ol',items:[...]}, "
                "{type:'callout',tone:'info|tip|warning',text}, "
                "{type:'table',headers:[...],rows:[[...],[...]]}, "
                "{type:'code',lang:'text',code:'...'}. "
                "First section should be type:'p' with the front-loaded answer "
                "(2-3 sentences, no throat-clearing). "
                "Second section should be 'h2: The 30-second version' with an "
                "ordered list of 3-5 steps. Subsequent sections can mix h2, p, "
                "list, table, and callout as needed."
            ),
        },
    },
}


def build_prompt(topic: TopicEntry) -> str:
    """Build the full prompt. Topic + facts + structure + style rules."""
    facts_str = "\n".join(
        f"- [{p['sourceType']}] {p['fact']}  (source: {p['source']})"
        for p in topic["firstHandProof"]
    )
    secondary_kw = ", ".join(topic["secondaryKeywords"])
    return f"""You are writing a blog post for GetPDFPro — a private, browser-based PDF toolkit.

PRIMARY SEARCH INTENT (target this query, and only this query):
  "{topic['searchIntent']}"

TOOL: {topic['toolName']} (page at /tools/{topic['toolSlug']})
CATEGORY: {topic['category']}
SECONDARY KEYWORDS (weave in naturally, don't stuff): {secondary_kw}

FIRST-HAND PROOF (cite these facts, with their source URLs — these are the ONLY facts you can use):
{facts_str}

STRUCTURE (the content capsule / BLUF technique):
1. First section: a 'p' type that front-loads the answer to the search intent in 2-3 sentences. No throat-clearing like "In today's digital age" or "Whether you're a...". Direct answer.
2. Second section: h2 "The 30-second version" with an 'ol' of 3-5 steps the reader can take right now.
3. Then 3-5 explanatory sections (mix of h2/h3/p/list/callout/table as needed). Include at least one table or numbered list with REAL numbers from firstHandProof.
4. Include at least one callout (info or tip tone) that surfaces the most important fact from firstHandProof.
5. End with a 'Try it' h2 section: a single 'p' that links to /tools/{topic['toolSlug']} with the CTA "Try it free at /tools/{topic['toolSlug']}" or similar.

RULES:
- One search intent, one job-to-be-done. No "and also" posts. The post should fully satisfy the intent without needing to read another page.
- Title format: "<Action> <keyword>" or "<Topic>: a <year> guide". Examples that work: "How to merge PDFs in 2026", "Compress PDF without losing quality", "Splitting large PDFs: the 4 GB problem". Don't: clickbait, listicles with numbers like "7 ways to...", or vague titles.
- Description (meta): 140-160 chars. Includes the primary keyword. Reads as a benefit statement, not a keyword list.
- Excerpt: 1-2 sentences. Same voice as the title. The first sentence should be the answer, not a teaser.
- Tags: 3-5 lowercase-hyphenated tags. Examples: "merge", "tutorial", "beginner", "compress", "deep-dive".
- Sections: 8-14 sections total. Mix p, h2, h3, ul, ol, table, callout. Don't use 'code' unless absolutely necessary.
- Tables: include at least one table with real numbers. Numbers must come from firstHandProof.
- Length: 800-1500 words total across all sections.
- Tone: friendly but precise. Like a senior engineer writing for fellow engineers. No marketing fluff. No "we believe". No emoji except in the optional callout.
- Internal links: include 2-4 links to other GetPDFPro pages (use these patterns):
    - /tools/<other-slug> for related tools
    - /vs/<competitor> for comparison context
    - /blog/<other-post-slug> for related reading
  Add the link inline in 'p' or 'li' text using standard markdown [text](url) — the publisher will convert to <Link>.
- Source citations: reference firstHandProof sources inline as [1], [2], [3] (numbered). The publisher will render a Sources section at the bottom with the full URLs.
- DO NOT make up facts, statistics, prices, dates, study results, or "experts say" claims. If you don't have a fact in firstHandProof, don't state it.
- DO NOT use filler phrases: "In conclusion", "In summary", "It's important to note", "When it comes to", "In the world of", "Whether you're a X or a Y", "Let's dive in", "Let's explore", "Buckle up", "Game-changer", "Unlock the power of".

OUTPUT FORMAT: Strict JSON. No markdown fences. No preamble. No explanation. Just the JSON object matching the schema:
{json.dumps(WRITER_SCHEMA, indent=2)}
"""


def call_gemini(prompt: str, model: str | None = None) -> dict[str, Any]:
    """Call Gemini and parse the JSON response.

    Tries GEMINI_API_KEY env var first. Raises if missing — the caller
    should have a fallback or surface the error.

    Model selection:
      - Default: gemini-2.5-flash (current stable, broadly available,
        supports structured output, free tier friendly)
      - Override via GEMINI_MODEL env var
      - History of fallback models we've used:
        - gemini-1.5-flash-8b (older AI Studio keys, often unavailable)
        - gemini-2.0-flash (deprecated June 2026)
        - gemini-2.5-flash (current default as of June 2026)
        - gemini-flash-latest (alias to latest stable; sometimes busy)
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY env var not set. "
            "The blog generator needs a Gemini API key to write posts. "
            "Get one free at https://aistudio.google.com/apikey and run:\n"
            "  export GEMINI_API_KEY=..."
        )
    model = model or os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "topP": 0.9,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
            # NOTE: responseSchema disabled. Gemini rejects schemas whose
            # array properties don't define `items`, and our `sections`
            # is a discriminated union (oneOf 8 variants) that Gemini
            # doesn't express well. We rely on:
            #   - responseMimeType: application/json  (forces JSON output)
            #   - explicit "OUTPUT FORMAT: Strict JSON" in the prompt
            #   - post-hoc validation in _validate_post() below
            # This is more permissive but has been the more reliable path
            # across gemini-2.0-flash → gemini-2.5-flash.
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ],
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())

    # Extract text from response
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Unexpected Gemini response shape: {data}") from exc

    # Parse JSON from the text (responseMimeType:application/json should give us
    # clean JSON, but strip any markdown fences just in case)
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    parsed = json.loads(text)

    # Post-validate. We don't ship a responseSchema to Gemini (it rejects
    # schemas with array properties that lack `items`), so we validate here.
    # Throws with a clear message if the model returned something we can't
    # fix up automatically.
    return _validate_post(parsed)


_VALID_SECTION_TYPES = {"p", "h2", "h3", "ul", "ol", "callout", "table", "code"}
_VALID_CALLOUT_TONES = {"info", "tip", "warning"}


def _validate_post(post: dict) -> dict:
    """Normalize and validate the post object returned by Gemini.

    Fixes common issues:
      - Sections missing 'type' are dropped (rare but happens)
      - Sections with unknown type are coerced to 'p' (defensive)
      - ul/ol items is missing → empty list
      - callout tone is missing/invalid → defaults to 'info'
      - table missing rows/headers → empty
      - sources is missing → empty list
      - tags is missing → empty list
    Throws ValueError if post is fundamentally malformed.
    """
    if not isinstance(post, dict):
        raise ValueError(f"Post is not a dict: {type(post).__name__}")

    # Required top-level fields (post slug/date/author injected later)
    for field in ("title", "description", "excerpt", "sections"):
        if field not in post:
            raise ValueError(f"Post missing required field: {field!r}")

    if not isinstance(post["sections"], list):
        raise ValueError(f"sections is not a list: {type(post['sections']).__name__}")
    if not post["sections"]:
        raise ValueError("sections is empty")

    cleaned_sections = []
    for s in post["sections"]:
        if not isinstance(s, dict):
            continue
        t = s.get("type")
        if t not in _VALID_SECTION_TYPES:
            # Coerce unknown types to a paragraph of the text
            if "text" in s:
                cleaned_sections.append({"type": "p", "text": str(s["text"])})
            continue
        if t in ("ul", "ol"):
            items = s.get("items") or []
            if not isinstance(items, list):
                items = [str(items)]
            s["items"] = [str(x) for x in items]
        elif t == "callout":
            tone = s.get("tone")
            if tone not in _VALID_CALLOUT_TONES:
                s["tone"] = "info"
        elif t == "table":
            s["headers"] = [str(h) for h in (s.get("headers") or [])]
            rows = s.get("rows") or []
            if not isinstance(rows, list):
                rows = []
            s["rows"] = [[str(c) for c in row] for row in rows if isinstance(row, list)]
        elif t == "code":
            s.setdefault("lang", "text")
        cleaned_sections.append(s)

    if not cleaned_sections:
        raise ValueError("All sections were dropped during validation")

    post["sections"] = cleaned_sections
    post.setdefault("tags", [])
    post.setdefault("sources", [])
    if not isinstance(post["tags"], list):
        post["tags"] = []
    if not isinstance(post["sources"], list):
        post["sources"] = []
    return post


def write_post(topic: TopicEntry, model: str | None = None) -> dict[str, Any]:
    """Generate a complete post object for the topic."""
    prompt = build_prompt(topic)
    post = call_gemini(prompt, model=model)

    # Inject the slug and date — the model doesn't decide these.
    post["slug"] = f"{topic['toolSlug']}-guide"
    post["date"] = post.get("date") or _today_iso()
    post["author"] = "GetPDFPro"
    post["cover"] = f"/blog/cover-{post['slug']}.webp"

    # Estimate reading time from word count.
    word_count = _count_words(post.get("sections", []))
    post["readingMinutes"] = max(2, round(word_count / 220))

    # Convert inline [1] / [2] / [3] citation markers into the sources array.
    post["sources"] = _build_sources(post.get("sections", []), topic)

    return post


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _today_iso() -> str:
    import datetime as _dt
    return _dt.date.today().isoformat()


def _count_words(sections: list[dict]) -> int:
    n = 0
    for s in sections:
        if s.get("type") == "p":
            n += len(s.get("text", "").split())
        elif s.get("type") in ("h2", "h3"):
            n += len(s.get("text", "").split())
        elif s.get("type") in ("ul", "ol"):
            n += sum(len(it.split()) for it in s.get("items", []))
        elif s.get("type") == "callout":
            n += len(s.get("text", "").split())
        elif s.get("type") == "table":
            n += sum(len(c.split()) for c in s.get("headers", []))
            for row in s.get("rows", []):
                n += sum(len(c.split()) for c in row)
        elif s.get("type") == "code":
            n += len(s.get("code", "").split())
    return n


def _build_sources(
    sections: list[dict], topic: TopicEntry
) -> list[dict[str, str]]:
    """Look for [1] [2] [3] markers in the post body and build a sources
    list from firstHandProof entries that the writer actually cited.

    Falls back to including all firstHandProof entries if the writer
    didn't add explicit citation markers — better to over-cite than to
    miss a source the writer actually referenced.
    """
    text_blob = json.dumps(sections)
    cited_indices: set[int] = set()
    for m in re.finditer(r"\[(\d+)\]", text_blob):
        cited_indices.add(int(m.group(1)))

    sources = []
    for i, proof in enumerate(topic["firstHandProof"], start=1):
        if cited_indices and i not in cited_indices:
            continue  # writer didn't cite this one
        sources.append(
            {
                "label": _source_label(proof),
                "url": proof["source"],
                "accessedOn": _today_iso(),
            }
        )
    # Always include at least one source per post.
    if not sources and topic["firstHandProof"]:
        sources.append(
            {
                "label": _source_label(topic["firstHandProof"][0]),
                "url": topic["firstHandProof"][0]["source"],
                "accessedOn": _today_iso(),
            }
        )
    return sources


def _source_label(proof: dict) -> str:
    """Build a human-readable label for the sources section."""
    src = proof["source"]
    if src.startswith("apps/"):
        return f"GetPDFPro source: {src}"
    if src.startswith("https://api.getpdfpro.com"):
        return f"GetPDFPro API (live, {src})"
    if src.startswith("https://opensource.adobe.com"):
        return "PDF specification (Adobe open source)"
    if src.startswith("https://www.iso.org"):
        return "ISO 32000 (PDF 2.0)"
    if src.startswith("https://pymupdf.readthedocs.io"):
        return "PyMuPDF documentation"
    if src.startswith("https://ai.google.dev"):
        return "Google AI / Gemini documentation"
    if src.startswith("https://developer.mozilla.org"):
        return "MDN Web Docs"
    # Fallback: domain
    try:
        from urllib.parse import urlparse
        return urlparse(src).netloc.replace("www.", "")
    except Exception:
        return src
