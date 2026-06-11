#!/usr/bin/env -S node --no-warnings
/**
 * Generate ready-to-post social share text for every blog post.
 *
 * Output:
 *   social-queue/<slug>.md          — Twitter/X + LinkedIn text for the post
 *
 * Why this exists:
 *   We don't have Blotato/Twitter/LinkedIn API credentials wired up yet
 *   (and we shouldn't pretend we do). But every new blog post should
 *   get a shareable caption anyway. This script generates polished
 *   captions that Salim can paste into each platform manually, with
 *   hashtags and hooks tuned for each platform's style.
 *
 * Platform conventions (2026):
 *   - Twitter/X: 1 tweet, ≤280 chars, 1-2 hashtags, hook in first 80 chars
 *   - LinkedIn: longer (3-5 short paragraphs), professional voice, 3-5 hashtags
 *
 * Usage:
 *   npx tsx scripts/generate-social-share.ts                 # all posts
 *   npx tsx scripts/generate-social-share.ts how-to-merge-pdfs  # one post
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(REPO_ROOT, "apps", "web");
const OUT_DIR = path.join(REPO_ROOT, "social-queue");

const SITE_URL = "https://app.getpdfpro.com";
const SITE_NAME = "GetPDFPro";
const TWITTER_HANDLE = "@getpdfpro";

type Post = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  cover: string;
  date: string;
  tags: string[];
};

/**
 * Parse the blog.ts file using a stateful brace-aware walker.
 * Returns one Post per top-level object in the `posts` array.
 *
 * Why not just import the .ts? Two reasons:
 *   1. We want this script to run without a build step.
 *   2. The blog module has type annotations that need a TS parser.
 * Walking the source character-by-character handles all that.
 */
function parseBlogTs(src: string): Post[] {
  // Find the start of the posts array. Note: `BlogPost[]` has an
  // empty `[]` that we must skip past to find the actual array `]`.
  const arrayStart = src.indexOf("export const posts: BlogPost[] = [");
  if (arrayStart === -1) {
    throw new Error("Could not find 'export const posts' in blog.ts");
  }
  // Skip past the first '[' (of '[]'), then find the second '[' (the array)
  const firstBracket = src.indexOf("[", arrayStart);
  const bodyStart = src.indexOf("[", firstBracket + 1) + 1;

  // Walk from bodyStart, tracking brace depth. Each top-level object ends
  // at a `},` or the closing `]` of the array.
  let depth = 0;
  let i = bodyStart;
  const objects: string[] = [];
  let currentStart = -1;

  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      if (depth === 0) currentStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && currentStart !== -1) {
        objects.push(src.slice(currentStart, i + 1));
        currentStart = -1;
      }
    } else if (ch === "]" && depth === 0) {
      break;
    }
    i++;
  }

  // For each object, extract simple string fields
  const posts: Post[] = [];
  for (const obj of objects) {
    const get = (key: string): string | undefined => {
      // Match: key: possibly-newlines "..." possibly with escaped quotes
      // The string may be on the same line as the key, or on the next line.
      const re = new RegExp(
        `\\b${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`,
        "s"
      );
      const m = obj.match(re);
      return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : undefined;
    };
    const getArray = (key: string): string[] => {
      // Match: key: [ "a", "b", "c" ]  — the array may span multiple lines
      const re = new RegExp(`\\b${key}:\\s*\\[([^\\]]+)\\]`, "s");
      const m = obj.match(re);
      if (!m) return [];
      return m[1]
        .split(/,(?![^[]*\])/)  // split on top-level commas only
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    };

    const slug = get("slug");
    if (!slug) continue;

    posts.push({
      slug,
      title: get("title") || "",
      description: get("description") || "",
      excerpt: get("excerpt") || "",
      cover: get("cover") || "",
      date: get("date") || "",
      tags: getArray("tags"),
    });
  }
  return posts;
}

/** Build the Twitter/X caption (≤280 chars, hook in first 80). */
function tweetFor(post: Post): string {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const handle = TWITTER_HANDLE; // appended to make it discoverable
  // Pick the most engaging 2 hashtags
  const tags = post.tags
    .slice(0, 2)
    .map((t) => "#" + t.replace(/[^a-zA-Z0-9]/g, ""))
    .join(" ");
  // Lead with a hook — keep first line ≤70 chars to leave room in previews
  const colonIdx = post.title.indexOf(":");
  const hook = colonIdx > 0 && colonIdx < 70
    ? post.title.slice(0, colonIdx)
    : post.title.length > 70
    ? post.title.slice(0, 67).trimEnd() + "…"
    : post.title;

  // Reserve: url (33) + " " + tags (≈20) + " " + " " + newlines (4) + hook with newline (hook.length+1)
  const fixedOverhead = url.length + 1 + tags.length + 4 + hook.length + 1;
  const bodyBudget = 280 - fixedOverhead;
  // Body must be informative; allow ellipsis
  let body = post.excerpt;
  if (body.length > bodyBudget) {
    // Cut at a sentence boundary if possible
    const cut = body.slice(0, bodyBudget - 1);
    const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" — "));
    body = (lastDot > bodyBudget / 2 ? cut.slice(0, lastDot + 1) : cut.trimEnd() + "…");
  }

  return `${hook}

${body}

${tags}
${url}`;
}

/** Build a LinkedIn post (3-4 short paragraphs, professional voice). */
function linkedInFor(post: Post): string {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const tags = post.tags
    .slice(0, 4)
    .map((t) => "#" + t.replace(/[^a-zA-Z0-9]/g, ""))
    .join(" ");

  // LinkedIn rewards line breaks and short paragraphs. Lead with the
  // hook, follow with the why-it-matters, then the read.
  return `${post.title}.

${post.description}

${post.excerpt}

Read the full post: ${url}

${tags}`;
}

async function main() {
  const targetSlug = process.argv[2];
  const src = fs.readFileSync(path.join(WEB_DIR, "lib", "blog.ts"), "utf-8");
  const allPosts = parseBlogTs(src);
  const posts = targetSlug
    ? allPosts.filter((p) => p.slug === targetSlug)
    : allPosts;

  if (posts.length === 0) {
    console.error(
      `No post${targetSlug ? ` matching "${targetSlug}"` : "s"} found in apps/web/lib/blog.ts`
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const post of posts) {
    const tweet = tweetFor(post);
    const li = linkedInFor(post);

    const tweetOk = tweet.length <= 280;
    if (!tweetOk) {
      console.warn(`⚠️  Tweet for ${post.slug} is ${tweet.length} chars (> 280).`);
    }

    const out = `# ${post.title}

> ${post.excerpt}
> URL: ${SITE_URL}/blog/${post.slug}
> Cover: ${post.cover}
> Date: ${post.date}

---

## Twitter / X (${tweet.length} chars${tweetOk ? "" : " — OVER LIMIT"})

\`\`\`
${tweet}
\`\`\`

---

## LinkedIn (${li.length} chars)

\`\`\`
${li}
\`\`\`

---

_Generated by scripts/generate-social-share.ts. Paste into the platform manually until the Blotato API is wired up._
`;

    const outPath = path.join(OUT_DIR, `${post.slug}.md`);
    fs.writeFileSync(outPath, out);
    console.log(
      `✓ ${post.slug}: tweet ${tweet.length}c${tweetOk ? "" : " ⚠"}, LinkedIn ${li.length}c → ${path.relative(REPO_ROOT, outPath)}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
