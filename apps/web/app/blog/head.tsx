import { SITE_URL } from "@/lib/site";

/**
 * Per-route head injection for /blog and /blog/*.
 *
 * Next 15's `metadata.alternates.types` does NOT emit <link rel="alternate">
 * tags (it's only used for the XML sitemap). To give feed readers real
 * auto-discovery on the blog, we declare the four feeds here. Next collects
 * all <link> children returned by `head.tsx` files and injects them into
 * the document <head>.
 *
 * This file applies to /blog and all nested routes (e.g. /blog/<slug>) —
 * exactly the pages where feed auto-discovery is wanted.
 */
export default function Head() {
  return (
    <>
      <link
        rel="alternate"
        type="application/rss+xml"
        title="GetPDFPro Blog (RSS 2.0)"
        href={`${SITE_URL}/rss.xml`}
      />
      <link
        rel="alternate"
        type="application/atom+xml"
        title="GetPDFPro Blog (Atom 1.0)"
        href={`${SITE_URL}/atom.xml`}
      />
      <link
        rel="alternate"
        type="application/atom+xml"
        title="GetPDFPro Blog (Atom — feed.xml)"
        href={`${SITE_URL}/feed.xml`}
      />
      <link
        rel="alternate"
        type="application/feed+json"
        title="GetPDFPro Blog (JSON Feed 1.1)"
        href={`${SITE_URL}/feed.json`}
      />
    </>
  );
}
