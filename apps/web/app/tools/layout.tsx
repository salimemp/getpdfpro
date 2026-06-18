/**
 * Shared layout for ALL /tools/* pages.
 *
 * Renders the page + (for tool pages, not the index) the RelatedBlogGuide
 * callout below it when a matching daily-generated guide post exists.
 *
 * Why at this level (not tools/[slug]/layout.tsx):
 *   Next.js prioritizes static segments over dynamic ones. With the
 *   35 tools as static segments (merge, split, etc.) AND a dynamic
 *   [slug] layout, Next.js resolves each request to the static page
 *   and skips the [slug] layout entirely. Putting the layout at the
 *   parent segment (tools/) means it applies to both the index page
 *   AND every individual tool page.
 *
 * Tool-slug detection:
 *   We extract the slug from the URL pathname. The tools index page
 *   (/tools) won't have a slug, so we render nothing extra there.
 */

import { RelatedBlogGuide } from "@/components/RelatedBlogGuide";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // We can't useParams() in a layout reliably, so the layout just
  // renders the page and lets each child page add its own guide
  // callout. (Alternative: read the URL in a client component and
  // conditionally render the guide — but that adds JS for SEO-crucial
  // content.)
  //
  // ACTUALLY: rather than have each tool page add the callout, we
  // use a small client-side trick: the layout wraps a tiny client
  // component that reads the pathname and renders the guide if the
  // path matches /tools/<slug>. This keeps the page files clean and
  // doesn't require editing 35 components.
  //
  // For SEO, the RelatedBlogGuide is wrapped in <aside> with a
  // stable test-id so search engines see it once rendered.

  return (
    <>
      {children}
      <div className="container-narrow pb-16">
        <ToolGuideSentinel />
      </div>
    </>
  );
}

/**
 * Client-side component that reads the URL pathname and renders the
 * RelatedBlogGuide for the current tool. Renders nothing on /tools
 * (the index page).
 */
import { ClientRelatedBlogGuide } from "@/components/ClientRelatedBlogGuide";

function ToolGuideSentinel() {
  return <ClientRelatedBlogGuide />;
}
