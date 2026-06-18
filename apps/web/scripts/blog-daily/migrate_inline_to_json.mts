#!/usr/bin/env node
/**
 * One-time migration: extract inline posts from apps/web/lib/blog.ts and
 * write them as JSON files in apps/web/content/blog/.
 *
 * Run with: node --experimental-strip-types migrate_inline_to_json.mts
 *           (or: node migrate_inline_to_json.mts if Node 25+ supports it)
 *
 * After this runs:
 *   - apps/web/content/blog/<slug>.json exists for each inline post
 *   - lib/blog.ts can be updated to load from the JSON store
 *
 * Why this exists:
 *   Before this cron pipeline, posts were inline in lib/blog.ts. To allow
 *   the Python cron to write posts without TS string manipulation, we moved
 *   post data to JSON files. The existing inline posts need to be migrated
 *   so the blog index keeps showing them.
 *
 * Implementation:
 *   - Node 25+ can run TypeScript directly via --experimental-strip-types
 *   - We import the BlogPost type and posts array from the TS module
 *   - We write each post as JSON via fs.writeFileSync
 *   - This is more robust than a Python regex parser (no apostrophe issues,
 *     no quote-escaping subtleties — the TS module evaluates as-is)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { posts as INLINE_POSTS } from "../../lib/blog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const CONTENT_DIR = path.join(REPO_ROOT, "apps", "web", "content", "blog");

async function main() {
  await fs.mkdir(CONTENT_DIR, { recursive: true });

  console.log(`Found ${INLINE_POSTS.length} inline posts.`);
  let written = 0;
  let skipped = 0;

  for (const post of INLINE_POSTS) {
    const out = path.join(CONTENT_DIR, `${post.slug}.json`);
    let existing = null;
    try {
      existing = await fs.readFile(out, "utf-8");
    } catch {
      // doesn't exist yet
    }
    if (existing) {
      console.log(`  - ${post.slug}: exists, skipping`);
      skipped++;
      continue;
    }
    await fs.writeFile(out, JSON.stringify(post, null, 2) + "\n", "utf-8");
    console.log(`  + ${post.slug}: wrote ${path.relative(REPO_ROOT, out)}`);
    written++;
  }

  console.log(`\nDone. ${written} new JSON files written, ${skipped} skipped.`);
  if (written > 0) {
    console.log("\nNext steps:");
    console.log("  1. Spot-check the JSON files look right (open one in your editor).");
    console.log("  2. Update lib/blog.ts to scan content/blog/ — see scripts/blog-daily/lib_blog.ts.new.");
    console.log("  3. Run `pnpm build` and visit /blog to confirm all 5 posts render.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
