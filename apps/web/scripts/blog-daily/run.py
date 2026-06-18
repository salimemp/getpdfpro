"""
Run — the orchestrator. This is what the daily cron invokes.

Flow:
  1. Pick the next topic (rotates through all 35 tools, skipping ones
     that already have a generated post).
  2. Call Gemini (via writer.py) to generate the post body.
  3. Run fact-checker (filler + LLM-as-judge hallucination check).
  4. If checks fail, write the post to a "review/" subdirectory and
     notify the user via the cron prompt. Don't publish to live.
  5. If checks pass, publish to content/blog/<slug>.json + cover WebP.
  6. Return a status summary the cron can pass to the user.

Usage:
  GEMINI_API_KEY=... python3 run.py             # generate next topic
  GEMINI_API_KEY=... python3 run.py --tool merge  # generate a specific tool
  GEMINI_API_KEY=... python3 run.py --dry-run    # show what would run, no API calls

Exit codes:
  0 = post generated and published (or dry-run completed)
  1 = generation failed (API error, parse error, etc.)
  2 = fact-check failed — post written to review/ for manual review
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import pathlib
import subprocess
import sys

import fact_check
import publisher
import topic_queue
import writer


REPO_ROOT = pathlib.Path(__file__).resolve().parents[4]
CONTENT_DIR = REPO_ROOT / "apps" / "web" / "content" / "blog"
REVIEW_DIR = CONTENT_DIR / "_review"


def list_existing_slugs() -> list[str]:
    """Return slugs of posts already in content/blog/ (excluding _review/)."""
    if not CONTENT_DIR.exists():
        return []
    slugs = []
    for p in CONTENT_DIR.iterdir():
        if p.is_file() and p.suffix == ".json" and not p.name.startswith("_"):
            slugs.append(p.stem)
    return slugs


def git_has_changes() -> bool:
    """Return True if the repo has uncommitted changes."""
    try:
        r = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=REPO_ROOT,
            capture_output=True, text=True, timeout=10,
        )
        return bool(r.stdout.strip())
    except Exception:
        return False


def git_commit_post(slug: str) -> str:
    """Stage the new post + cover image and commit. Return the commit SHA.
    Requires git config user.name + user.email to be set (the cron does
    this via git -c flags)."""
    r = subprocess.run(
        ["git", "add",
         f"apps/web/content/blog/{slug}.json",
         f"apps/web/public/blog/cover-{slug}.webp",
         f"apps/web/public/blog/cover-{slug}.alt.txt"],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=30,
    )
    if r.returncode != 0:
        raise RuntimeError(f"git add failed: {r.stderr}")

    msg = f"blog(daily): generate post for {slug}"
    r = subprocess.run(
        ["git", "commit", "-m", msg],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=30,
    )
    if r.returncode != 0:
        raise RuntimeError(f"git commit failed: {r.stderr}")

    sha = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=10,
    ).stdout.strip()
    return sha


def git_push() -> None:
    """Push the commit to origin/main. Triggers the deploy-workers workflow."""
    # Use GH_TOKEN from env if available (per memory, gh auth lives in
    # `gh config`, not in netrc / keychain — we can't reuse it directly
    # without prefixing). The cron job runs `GH_TOKEN=...` separately.
    r = subprocess.run(
        ["git", "push", "origin", "main"],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=60,
    )
    if r.returncode != 0:
        raise RuntimeError(f"git push failed: {r.stderr}")


def run_daily(tool_slug: str | None = None, dry_run: bool = False) -> dict:
    """Generate and publish one post. Returns a status dict."""
    already_written = list_existing_slugs()

    # Pick topic
    if tool_slug:
        topic = topic_queue.getTopicByToolSlug(tool_slug)
        if not topic:
            return {"status": "error", "reason": f"Unknown tool slug: {tool_slug}"}
    else:
        topic = topic_queue.pickNextTopic(already_written)

    print(f"→ Topic: {topic['toolName']} ({topic['toolSlug']})")
    print(f"  Search intent: {topic['searchIntent']}")
    print(f"  First-hand proof: {len(topic['firstHandProof'])} facts")

    if dry_run:
        return {
            "status": "dry-run",
            "topic": topic["toolSlug"],
            "tool_name": topic["toolName"],
            "search_intent": topic["searchIntent"],
            "first_hand_proof_count": len(topic["firstHandProof"]),
        }

    # Generate the post body
    try:
        post = writer.write_post(topic)
    except Exception as exc:
        return {"status": "error", "stage": "writer", "reason": str(exc)}

    print(f"  Generated {len(post.get('sections', []))} sections")
    print(f"  Title: {post.get('title')}")
    print(f"  Reading time: ~{post.get('readingMinutes')} min")

    # Fact-check
    print("→ Fact-checking ...")
    checks = fact_check.run_all_checks(post, topic["firstHandProof"])
    if checks["filler_hits"]:
        print(f"  Filler phrases: {', '.join(checks['filler_hits'])}")
    if checks["unsupported_claims"]:
        print(f"  Unsupported claims: {len(checks['unsupported_claims'])}")
        for c in checks["unsupported_claims"][:3]:
            print(f"    - {c[:120]}")

    # Strict gating: if filler hit OR hallucination judge says !pass with
    # multiple unsupported claims, send to review/ instead of publishing.
    block = (
        len(checks["filler_hits"]) > 0
        or len(checks["unsupported_claims"]) >= 3
    )
    if block:
        REVIEW_DIR.mkdir(parents=True, exist_ok=True)
        review_path = REVIEW_DIR / f"{post['slug']}.json"
        review_path.write_text(
            json.dumps({"post": post, "checks": checks}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return {
            "status": "review",
            "stage": "fact-check",
            "slug": post["slug"],
            "review_file": str(review_path.relative_to(REPO_ROOT)),
            "issues": checks["issues"],
            "title": post["title"],
        }

    # Publish
    print("→ Publishing ...")
    try:
        paths = publisher.publish_post(post)
    except Exception as exc:
        return {"status": "error", "stage": "publisher", "reason": str(exc)}

    print(f"  Wrote {paths['json']}")
    print(f"  Wrote {paths['cover']}")

    # Commit + push (best-effort — if git isn't set up, just report paths)
    committed = False
    commit_sha = None
    pushed = False
    try:
        commit_sha = git_commit_post(post["slug"])
        committed = True
        print(f"  Committed: {commit_sha[:8]}")
        # Only push if GH_TOKEN is in env (cron sets it; one-off runs may not)
        if os.environ.get("GH_TOKEN") or os.environ.get("PUSH_ENABLED"):
            try:
                git_push()
                pushed = True
                print("  Pushed to origin/main")
            except Exception as exc:
                print(f"  ! Push failed: {exc}")
    except Exception as exc:
        print(f"  ! Commit failed: {exc}")

    return {
        "status": "published",
        "slug": post["slug"],
        "title": post["title"],
        "tool_slug": topic["toolSlug"],
        "tool_name": topic["toolName"],
        "search_intent": topic["searchIntent"],
        "paths": paths,
        "committed": committed,
        "commit_sha": commit_sha,
        "pushed": pushed,
        "fact_check": checks,
        "published_url": f"https://app.getpdfpro.com/blog/{post['slug']}",
        "tool_page_url": f"https://app.getpdfpro.com/tools/{topic['toolSlug']}",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tool", help="Specific tool slug to write about")
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would run, no API calls")
    args = ap.parse_args()

    result = run_daily(tool_slug=args.tool, dry_run=args.dry_run)

    # Print a structured status line the cron can grep
    print()
    print("=" * 60)
    print(json.dumps(result, indent=2, default=str))
    print("=" * 60)

    if result["status"] == "published":
        sys.exit(0)
    elif result["status"] == "review":
        sys.exit(2)
    elif result["status"] == "dry-run":
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
