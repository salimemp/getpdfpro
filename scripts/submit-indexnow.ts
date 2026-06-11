#!/usr/bin/env -S node --no-warnings
/**
 * Submit recent blog post URLs to IndexNow.
 *
 * IndexNow is a protocol supported by Bing, Yandex, Seznam, Naver, and
 * DuckDuckGo (which uses Bing's index). Submitting a URL tells these
 * engines to crawl the page immediately, which speeds up indexing from
 * weeks to hours.
 *
 * Google does NOT officially support IndexNow as of 2026, but the
 * URLs we submit here are also auto-included in our sitemap.xml, so
 * Google will discover them on its next sitemap crawl.
 *
 * Requirements:
 *   1. An IndexNow API key. Generate one with:
 *        openssl rand -hex 16
 *      and put it in INDEXNOW_API_KEY env var.
 *   2. The key file must be served at https://<host>/<key>.txt
 *      containing just the key as a string. We generate this file too.
 *   3. Run after a new blog post is deployed:
 *        INDEXNOW_API_KEY=<key> npx tsx scripts/submit-indexnow.ts
 *      Or to submit a specific post:
 *        INDEXNOW_API_KEY=<key> npx tsx scripts/submit-indexnow.ts how-to-merge-pdfs
 *
 * API endpoint:
 *   POST https://api.indexnow.org/IndexNow
 *   {
 *     "host": "app.getpdfpro.com",
 *     "key": "<key>",
 *     "keyLocation": "https://app.getpdfpro.com/<key>.txt",
 *     "urlList": ["https://app.getpdfpro.com/blog/foo"]
 *   }
 *
 * Reference: https://www.indexnow.org/documentation
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(REPO_ROOT, "apps", "web");
const PUBLIC_DIR = path.join(WEB_DIR, "public");

const SITE_URL = "https://app.getpdfpro.com";
const HOST = "app.getpdfpro.com";

async function loadSlugs(): Promise<string[]> {
  const src = fs.readFileSync(path.join(WEB_DIR, "lib", "blog.ts"), "utf-8");
  const slugs: string[] = [];
  for (const m of src.matchAll(/\bslug:\s*"([^"]+)"/g)) {
    slugs.push(m[1]);
  }
  return slugs;
}

async function main() {
  const key = process.env.INDEXNOW_API_KEY;
  const targetSlug = process.argv[2];

  if (!key || !/^[a-f0-9]{16,}$/i.test(key)) {
    console.error(
      "INDEXNOW_API_KEY env var is required (16+ hex chars).\n" +
        "Generate one with: openssl rand -hex 16\n" +
        "Then put it in your .env (or .envrc)."
    );
    process.exit(1);
  }

  // 1. Drop the key file at /public/<key>.txt so IndexNow can verify
  //    domain ownership on each submission. Existing file is overwritten.
  const keyFile = path.join(PUBLIC_DIR, `${key}.txt`);
  fs.writeFileSync(keyFile, key);
  console.log(`✓ Wrote key file to ${path.relative(REPO_ROOT, keyFile)}`);

  // 2. Build the URL list
  const allSlugs = await loadSlugs();
  const slugsToSubmit = targetSlug
    ? allSlugs.filter((s) => s === targetSlug)
    : allSlugs;

  if (slugsToSubmit.length === 0) {
    console.error(`No post matching "${targetSlug}" found.`);
    process.exit(1);
  }

  const urlList = slugsToSubmit.map((s) => `${SITE_URL}/blog/${s}`);

  // 3. POST to IndexNow
  const body = {
    host: HOST,
    key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList,
  };

  console.log(`\nSubmitting ${urlList.length} URL(s) to IndexNow...`);
  for (const u of urlList) console.log(`  - ${u}`);

  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  const status = res.status;
  const text = await res.text();
  // IndexNow returns 200 on success, 202 if accepted (queued),
  // 400 if key/url format invalid, 403 if key doesn't match.
  if (status === 200 || status === 202) {
    console.log(`\n✓ Accepted (HTTP ${status}): ${text || "no body"}`);
  } else {
    console.error(`\n✗ Failed (HTTP ${status}): ${text}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
