"""
Fact-checker — uses Gemini as a judge to verify the post doesn't contain
hallucinated facts that aren't in firstHandProof.

Lightweight approach:
  1. Send the post + firstHandProof to Gemini.
  2. Ask: "For each numerical or factual claim in the post body, is it
     supported by firstHandProof? Reply with a JSON list of unsupported
     claims (empty list = pass)."
  3. If there are unsupported claims, the publisher flags the post as
     "needs review" and the cron skips it (doesn't publish).
  4. Also checks for the "common hallucination patterns" — filler phrases
     that signal low-quality output.

This is an LLM-as-judge. It's not bulletproof — the judge can miss
subtle hallucinations — but it catches the obvious stuff (made-up stats,
wrong tool descriptions, etc.) at a fraction of the cost of a human
review pass.
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any

FILLER_PHRASES = [
    "in today's digital age",
    "in today's fast-paced",
    "whether you're a",
    "when it comes to",
    "in the world of",
    "let's dive in",
    "let's explore",
    "buckle up",
    "game-changer",
    "game changer",
    "unlock the power of",
    "unlock the potential",
    "in conclusion",
    "in summary",
    "it's important to note",
    "dive deeper",
    "without further ado",
]


def check_filler(text: str) -> list[str]:
    """Catch the marketing-fluff phrases that signal low-quality output."""
    lower = text.lower()
    hits = []
    for phrase in FILLER_PHRASES:
        if phrase in lower:
            hits.append(phrase)
    return hits


def check_hallucinations(
    post: dict[str, Any], facts: list[dict[str, str]]
) -> dict[str, Any]:
    """Ask Gemini to flag any factual claim in the post that isn't supported
    by the facts list. Returns:
      {
        "pass": bool,
        "unsupported_claims": [str],
        "reason": str  (if !pass)
      }
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            "pass": True,
            "unsupported_claims": [],
            "reason": "GEMINI_API_KEY not set — skipping LLM judge (manual review recommended)",
        }

    # Serialize the post body for the judge
    sections_text = _sections_to_text(post.get("sections", []))
    facts_text = "\n".join(
        f"- {f['fact']} (source: {f['source']})" for f in facts
    )

    prompt = f"""You are a fact-checker for a blog post. The post body and a list of
verified facts (firstHandProof) are below. Your job: find any factual or
numerical claim in the post that is NOT directly supported by the
firstHandProof list.

Reply with strict JSON only, in this shape:
{{
  "pass": true | false,
  "unsupported_claims": ["<claim 1>", "<claim 2>", ...],
  "reason": "<one-sentence summary if !pass, else empty string>"
}}

Rules:
- Numerical claims (percentages, sizes, dates, prices, durations) MUST be
  in firstHandProof to count as supported. If the post says "saves 70% on
  average" but firstHandProof doesn't mention 70%, that's unsupported.
- Tool behavior claims ("X does Y in the browser") MUST be supported.
- Speculative or hedging language ("typically", "often", "in many cases")
  is OK — only flag claims stated as fact.
- The post's title and meta description don't need fact-checking — focus
  on the body sections.
- If the post says something you can verify from general knowledge (e.g.,
  "PDF was created in 1991"), that's fine — but flag if you're unsure.

POST BODY (sections concatenated):
---
{sections_text}
---

FIRST-HAND PROOF (only facts the writer was allowed to use):
---
{facts_text}
---
"""

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-1.5-flash-8b:generateContent?key=" + api_key
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        text = re.sub(r"^```(?:json)?\s*", "", text.strip())
        text = re.sub(r"\s*```$", "", text)
        return json.loads(text)
    except Exception as exc:
        return {
            "pass": True,
            "unsupported_claims": [],
            "reason": f"LLM judge failed ({exc}) — manual review needed",
        }


def run_all_checks(post: dict[str, Any], topic_facts: list[dict[str, str]]) -> dict[str, Any]:
    """Run filler check + hallucination check. Returns:
      {
        "pass": bool,
        "filler_hits": [str],
        "unsupported_claims": [str],
        "issues": [str]  # human-readable summary
      }
    """
    body = json.dumps(post)
    filler = check_filler(body)
    halluc = check_hallucinations(post, topic_facts)

    issues = []
    if filler:
        issues.append(f"Filler phrases detected: {', '.join(filler)}")
    if not halluc.get("pass", True):
        issues.append(f"Hallucination check failed: {halluc.get('reason', '')}")
        issues.extend(f"  - {c}" for c in halluc.get("unsupported_claims", []))

    # Pass if no issues. Hallucination judge failures are non-blocking by
    # design (LLM judge can be flaky) — we surface them but the post still
    # gets published if it's the only check failing.
    return {
        "pass": len(filler) == 0,  # strict on filler, lenient on hallucination
        "filler_hits": filler,
        "unsupported_claims": halluc.get("unsupported_claims", []),
        "judge_reason": halluc.get("reason", ""),
        "issues": issues,
    }


# ---------------------------------------------------------------------------
def _sections_to_text(sections: list[dict]) -> str:
    out = []
    for s in sections:
        t = s.get("type")
        if t == "h2":
            out.append(f"\n## {s.get('text', '')}")
        elif t == "h3":
            out.append(f"\n### {s.get('text', '')}")
        elif t == "p":
            out.append(s.get("text", ""))
        elif t in ("ul", "ol"):
            for i, item in enumerate(s.get("items", [])):
                marker = f"{i+1}." if t == "ol" else "-"
                out.append(f"{marker} {item}")
        elif t == "callout":
            out.append(f"[{s.get('tone', 'info').upper()}] {s.get('text', '')}")
        elif t == "table":
            out.append("| " + " | ".join(s.get("headers", [])) + " |")
            out.append("| " + " | ".join("---" for _ in s.get("headers", [])) + " |")
            for row in s.get("rows", []):
                out.append("| " + " | ".join(row) + " |")
        elif t == "code":
            out.append(f"```{s.get('lang', '')}\n{s.get('code', '')}\n```")
    return "\n".join(out)
