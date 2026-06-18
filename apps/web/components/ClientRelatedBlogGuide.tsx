"use client";

/**
 * Client component that reads window.location.pathname and renders
 * the RelatedBlogGuide for /tools/<slug> pages. Renders nothing on
 * /tools (the index page) or anywhere else.
 *
 * Why client-side and not server-side:
 *   Next.js App Router layouts don't have a reliable way to read the
 *   current route's dynamic segment params (the layout above all
 *   dynamic children doesn't get the params). useParams() only works
 *   inside the same dynamic segment.
 *
 *   Workaround: a tiny client component that reads window.location
 *   and renders the guide on the client. The content is the same as
 *   what a server-side render would produce (it imports the same
 *   loader and the same component) — only the initial paint is
 *   delayed by one tick. For SEO, the next prerender pass picks this
 *   up; for users, the page is interactive by the time the guide
 *   shows.
 *
 * To migrate to a server-side render later:
 *   Move this into each tool's page.tsx and pass params.slug as a
 *   prop. That's 35 file edits — only worth it if you see measurable
 *   SEO impact.
 */

import { usePathname } from "next/navigation";
import { RelatedBlogGuide } from "./RelatedBlogGuide";

export function ClientRelatedBlogGuide() {
  const pathname = usePathname();
  // /tools/<slug> — extract the slug
  const match = pathname?.match(/^\/tools\/([a-z0-9-]+)\/?$/);
  if (!match) return null;
  const slug = match[1];
  return <RelatedBlogGuide toolSlug={slug} />;
}
