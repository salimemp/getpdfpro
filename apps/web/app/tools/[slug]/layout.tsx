/**
 * Shared layout for /tools/<slug> pages.
 *
 * Adds:
 *  - <RelatedBlogGuide toolSlug={params.slug} /> below each tool when a
 *    daily-generated guide post exists for that tool. Renders nothing
 *    otherwise. Provides the "in-link" half of the daily-blog SEO
 *    strategy: every tool eventually gets a blog post linked from it.
 *
 * To add new shared UI to all tool pages (e.g. a footer disclaimer,
 * an upsell banner), do it here.
 */

import { RelatedBlogGuide } from "@/components/RelatedBlogGuide";

export default function ToolsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <>
      {children}
      <div className="container-narrow pb-16">
        <RelatedBlogGuide toolSlug={params.slug} />
      </div>
    </>
  );
}
