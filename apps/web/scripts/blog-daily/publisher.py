"""
Publisher — writes a generated post to disk and wires it into the blog.

What it does (in order):
  1. Writes content/blog/<slug>.json with the post data.
  2. Writes public/blog/cover-<slug>.webp with the cover image.
  3. (No code edits needed to lib/blog.ts — it auto-scans content/blog/.)

Architecture (one-time setup):
  - apps/web/content/blog/<slug>.json      ←  post data
  - apps/web/public/blog/cover-<slug>.webp ←  cover image (1280x720)
  - apps/web/lib/blog.ts                   ←  scans content/blog/ + merges with inline legacy posts

Why JSON files (not TypeScript modules):
  - The cron is Python. Writing TS string manipulation is fragile.
  - JSON is the right format for typed data that isn't code.
  - lib/blog.ts already exports a `BlogPost` type — JSON files match it.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import pathlib
import re

import image_gen

REPO_ROOT = pathlib.Path(__file__).resolve().parents[4]
CONTENT_DIR = REPO_ROOT / "apps" / "web" / "content" / "blog"
PUBLIC_BLOG_DIR = REPO_ROOT / "apps" / "web" / "public" / "blog"


def publish_post(post: dict, cover_alt: str | None = None) -> dict[str, str]:
    """Write a post to content/blog/<slug>.json and its cover to public/blog/.

    Returns a dict with paths and the alt text (for the publisher to log).
    """
    slug = post["slug"]
    cover_path = post.get("cover", f"/blog/cover-{slug}.webp")
    # The cover URL is /blog/cover-X.webp — strip the leading /blog/ to get
    # the relative path under public/.
    cover_rel = cover_path.lstrip("/")
    if cover_rel.startswith("blog/"):
        cover_rel = cover_rel[len("blog/"):]

    # 1. Write the JSON file
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = CONTENT_DIR / f"{slug}.json"
    json_path.write_text(
        json.dumps(post, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # 2. Generate the cover WebP if it doesn't already exist.
    #     (Always re-generate if missing. The image is deterministic from
    #     the slug, so it's idempotent.)
    cover_abs = PUBLIC_BLOG_DIR / cover_rel
    if not cover_abs.exists():
        PUBLIC_BLOG_DIR.mkdir(parents=True, exist_ok=True)
        info = image_gen.generate_cover(
            tool_name=_extract_tool_name(post),
            tool_slug=_slug_to_tool_slug(slug),
            category=_extract_category(post),
            title=post.get("title", slug),
            out_path=str(cover_abs),
        )
        if cover_alt:
            info["alt"] = cover_alt
        cover_alt_final = info["alt"]
    else:
        cover_alt_final = cover_alt or (
            f"GetPDFPro blog cover for {post.get('title', slug)}"
        )

    # 3. Write a sidecar .alt.txt so we can grep alt text easily
    alt_path = PUBLIC_BLOG_DIR / f"cover-{slug}.alt.txt"
    alt_path.write_text(cover_alt_final + "\n", encoding="utf-8")

    return {
        "json": str(json_path.relative_to(REPO_ROOT)),
        "cover": str(cover_abs.relative_to(REPO_ROOT)),
        "alt": cover_alt_final,
        "alt_file": str(alt_path.relative_to(REPO_ROOT)),
    }


def _extract_tool_name(post: dict) -> str:
    """Pull the tool name out of the post. Falls back to a sensible default."""
    # First tag is often the tool name (lowercase)
    tags = post.get("tags", [])
    if tags:
        return tags[0].replace("-", " ").title()
    # Or from the title — strip "How to" / "Guide to" prefixes
    title = post.get("title", "")
    for prefix in ["How to ", "A guide to ", "Guide to ", "The "]:
        if title.startswith(prefix):
            title = title[len(prefix):]
    # Strip trailing ": a 2026 guide" etc.
    title = re.sub(r":\s*a\s+\d{4}.*$", "", title)
    return title.strip() or "GetPDFPro"


def _slug_to_tool_slug(slug: str) -> str:
    """Convert a post slug like 'merge-guide' to 'merge'."""
    # Heuristic: strip '-guide' suffix; fall back to first segment.
    if slug.endswith("-guide"):
        return slug[: -len("-guide")]
    return slug.split("-")[0]


def _extract_category(post: dict) -> str:
    """Best-effort category extraction. The writer doesn't include it in the
    JSON, so we look at tags and infer."""
    tags = post.get("tags", [])
    for tag in tags:
        if tag in {"organize", "optimize", "convert-to", "convert-from",
                   "edit", "security", "intelligence", "accessibility"}:
            return tag
    # Fallback to a generic category
    return "organize"


def slugify(s: str) -> str:
    """Convert any string to a URL-friendly slug."""
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def today_iso() -> str:
    return _dt.date.today().isoformat()
