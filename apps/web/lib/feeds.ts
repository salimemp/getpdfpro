import { getAllPosts, getPostBySlug } from "./blog";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_LOCALE } from "./site";

/**
 * Blog feed generators.
 *
 * Four feed formats are exported:
 *  - rssXml()    -> RSS 2.0       (legacy readers, Feedburner)
 *  - atomXml()   -> Atom 1.0      (IETF standard, modern readers)
 *  - jsonFeed()  -> JSON Feed 1.1 (developer-friendly, GitHub-style)
 *
 * We also export the auto-discovery <link> tags for use in the blog's
 * <head> so feed readers can find all four.
 *
 * IMPORTANT: every feed is XSS-safe. Body text is HTML-escaped, and
 * the body itself is omitted (we use excerpts only) so a malicious
 * post can't inject markup. Links point to the public post page, not
 * to any third-party endpoint.
 */

/** HTML-escape a string for safe inclusion in XML/HTML output. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convert a date string (YYYY-MM-DD) to RFC 822 format for RSS 2.0. */
function toRfc822(iso: string): string {
  // YYYY-MM-DD -> Date in UTC midnight -> RFC 822
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toUTCString();
}

/** ISO 8601 (full) for Atom and JSON Feed. */
function toIso(iso: string): string {
  return `${iso}T12:00:00.000Z`;
}

/** Stable hash for a post — used for Atom <id> uniqueness. */
function postId(slug: string, date: string): string {
  return `tag:${SITE_URL.replace(/^https?:\/\//, "")},${date}:/blog/${slug}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RSS 2.0
// ─────────────────────────────────────────────────────────────────────────────

export function rssXml(): string {
  const posts = getAllPosts();
  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/blog/${p.slug}`;
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${toRfc822(p.date)}</pubDate>
      <description>${esc(p.description)}</description>
      <category>${esc(p.tags[0] || "blog")}</category>${p.tags
        .slice(1)
        .map((t) => `\n      <category>${esc(t)}</category>`)
        .join("")}
      <author>${esc(SITE_NAME)} (support@getpdfpro.com)</author>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME)} Blog</title>
    <link>${esc(`${SITE_URL}/blog`)}</link>
    <description>${esc(SITE_DESCRIPTION)}</description>
    <language>${SITE_LOCALE.replace("_", "-").toLowerCase()}</language>
    <lastBuildDate>${toRfc822(new Date().toISOString().slice(0, 10))}</lastBuildDate>
    <atom:link href="${esc(`${SITE_URL}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <generator>GetPDFPro feed generator</generator>
${items}
  </channel>
</rss>
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Atom 1.0
// ─────────────────────────────────────────────────────────────────────────────

export function atomXml(): string {
  const posts = getAllPosts();
  const updated = posts[0]?.date
    ? toIso(posts[0].date)
    : new Date().toISOString();
  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/blog/${p.slug}`;
      return `  <entry>
    <id>${esc(postId(p.slug, p.date))}</id>
    <title>${esc(p.title)}</title>
    <link href="${esc(url)}" rel="alternate" type="text/html" />
    <updated>${toIso(p.date)}</updated>
    <published>${toIso(p.date)}</published>
    <summary>${esc(p.description)}</summary>
    <author>
      <name>${esc(SITE_NAME)}</name>
      <email>support@getpdfpro.com</email>
    </author>${p.tags
      .map((t) => `\n    <category term="${esc(t)}" />`)
      .join("")}
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${esc(`${SITE_URL}/blog`)}</id>
  <title>${esc(SITE_NAME)} Blog</title>
  <subtitle>${esc(SITE_DESCRIPTION)}</subtitle>
  <link href="${esc(`${SITE_URL}/blog`)}" rel="alternate" type="text/html" />
  <link href="${esc(`${SITE_URL}/atom.xml`)}" rel="self" type="application/atom+xml" />
  <updated>${updated}</updated>
  <generator uri="${esc(SITE_URL)}" version="1.0">GetPDFPro feed generator</generator>
  <rights>© ${new Date().getFullYear()} ${esc(SITE_NAME)}</rights>
${items}
</feed>
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Feed 1.1
// ─────────────────────────────────────────────────────────────────────────────

export function jsonFeed(): string {
  const posts = getAllPosts();
  return JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: `${SITE_NAME} Blog`,
      home_page_url: `${SITE_URL}/blog`,
      feed_url: `${SITE_URL}/feed.json`,
      description: SITE_DESCRIPTION,
      language: SITE_LOCALE.replace("_", "-").toLowerCase(),
      authors: [{ name: SITE_NAME, url: SITE_URL }],
      items: posts.map((p) => ({
        id: `${SITE_URL}/blog/${p.slug}`,
        url: `${SITE_URL}/blog/${p.slug}`,
        title: p.title,
        summary: p.description,
        content_text: p.excerpt,
        image: `${SITE_URL}${p.cover}`,
        date_published: toIso(p.date),
        date_modified: toIso(p.date),
        authors: [{ name: SITE_NAME, url: SITE_URL }],
        tags: p.tags,
        _external_url: undefined, // omit rather than null
      })),
    },
    null,
    2
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-discovery <link> tags for the blog <head>
// ─────────────────────────────────────────────────────────────────────────────

export function feedDiscoveryLinks() {
  return [
    {
      rel: "alternate",
      type: "application/rss+xml",
      title: `${SITE_NAME} Blog (RSS 2.0)`,
      href: `${SITE_URL}/rss.xml`,
    },
    {
      rel: "alternate",
      type: "application/atom+xml",
      title: `${SITE_NAME} Blog (Atom 1.0)`,
      href: `${SITE_URL}/atom.xml`,
    },
    {
      rel: "alternate",
      type: "application/atom+xml",
      title: `${SITE_NAME} Blog (Atom — feed.xml)`,
      href: `${SITE_URL}/feed.xml`,
    },
    {
      rel: "alternate",
      type: "application/feed+json",
      title: `${SITE_NAME} Blog (JSON Feed 1.1)`,
      href: `${SITE_URL}/feed.json`,
    },
  ];
}

// (unused export kept for parity with future per-post endpoints)
export { getPostBySlug };
