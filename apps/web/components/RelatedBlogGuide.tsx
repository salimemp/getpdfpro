/**
 * RelatedBlogGuide — renders a "Read the guide" callout below a tool when
 * a related blog post exists for that tool.
 *
 * Used by /tools/<slug> pages to surface the daily-generated blog post
 * for that tool. Provides the "in-link" half of the daily-blog SEO
 * strategy: every tool page eventually gets a high-quality, source-backed
 * blog post linked from it.
 *
 * Renders nothing if there's no matching post yet. (For tools that are
 * not in the topic queue, or before the cron has written a post for them.)
 */

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getGuideForTool } from "@/lib/blog";

export function RelatedBlogGuide({ toolSlug }: { toolSlug: string }) {
  const post = getGuideForTool(toolSlug);
  if (!post) return null;

  return (
    <aside
      data-testid="related-blog-guide"
      className="mt-12 rounded-xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-900 dark:bg-brand-950"
    >
      <div className="flex items-start gap-3">
        <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
            Read the full guide
          </p>
          <p className="mt-1 text-sm text-brand-800 dark:text-brand-200">
            We wrote a sourced, in-depth guide to this tool — what it does,
            when to use it, and the limits to know about. {post.readingMinutes}{" "}
            min read.
          </p>
          <Link
            href={`/blog/${post.slug}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-100"
          >
            {post.title}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
