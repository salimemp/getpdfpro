import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { BlogSectionView } from "@/components/BlogSectionView";
import { getAllSlugs, getPostBySlug, getAllPosts } from "@/lib/blog";
import {
  SITE_NAME,
  SITE_URL,
  ldJson,
  breadcrumbLd,
  blogPostingLd,
} from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
      // Feed auto-discovery — every post page emits the same 4 links
      // so a feed reader visiting any post can find the blog feed.
      types: {
        "application/rss+xml": [
          { url: "/rss.xml", title: `${SITE_NAME} Blog (RSS 2.0)` },
        ],
        "application/atom+xml": [
          { url: "/atom.xml", title: `${SITE_NAME} Blog (Atom 1.0)` },
          { url: "/feed.xml", title: `${SITE_NAME} Blog (Atom — feed.xml)` },
        ],
        "application/feed+json": [
          { url: "/feed.json", title: `${SITE_NAME} Blog (JSON Feed 1.1)` },
        ],
      },
    },
    openGraph: {
      type: "article",
      url: `${SITE_URL}/blog/${post.slug}`,
      title: post.title,
      description: post.description,
      images: [
        {
          url: post.cover,
          width: 1280,
          height: 720,
          alt: post.title,
        },
      ],
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.cover],
    },
  };
}

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "Blog", url: `${SITE_URL}/blog` },
    { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
  ]);
  const ld = blogPostingLd(post);

  // Suggested next reads: the 2 most recent posts excluding the current one
  const related = getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 2);

  const formattedDate = new Date(post.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(bc)}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(ld)}
        />

        <article className="container-narrow py-12">
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            All posts
          </Link>

          <header className="mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <time dateTime={post.date}>{formattedDate}</time>
              <span aria-hidden="true">·</span>
              <span>{post.readingMinutes} min read</span>
              <span aria-hidden="true">·</span>
              <span>By {post.author}</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-4 text-lg leading-7 text-slate-600 dark:text-slate-400">
              {post.excerpt}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <div className="mb-12 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover}
              alt=""
              width={1280}
              height={720}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="prose prose-slate max-w-none dark:prose-invert">
            {post.sections.map((section, i) => (
              <BlogSectionView key={i} section={section} />
            ))}
          </div>

          {post.sources.length > 0 && (
            <section className="mt-16 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Sources
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Every fact in this post is linked to a source we verified.
              </p>
              <ul className="mt-4 space-y-2">
                {post.sources.map((s, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 hover:underline dark:text-brand-400"
                    >
                      {s.label}
                    </a>
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}
                      — accessed {s.accessedOn}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Keep reading
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {related.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.cover}
                          alt=""
                          width={1280}
                          height={720}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-5">
                        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                          {new Date(p.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                        <h3 className="text-base font-semibold leading-snug text-slate-900 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                          {p.title}
                        </h3>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
