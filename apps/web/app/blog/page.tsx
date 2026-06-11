import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { getAllPosts } from "@/lib/blog";
import { feedDiscoveryLinks } from "@/lib/feeds";
import {
  SITE_NAME,
  SITE_URL,
  ldJson,
  breadcrumbLd,
  blogListingLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: `Blog — ${SITE_NAME}`,
  description:
    "Practical, sourced writing on PDFs and the tools that work with them. Merge, split, compress, format primer, and honest comparisons.",
  alternates: {
    canonical: "/blog",
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
    type: "website",
    url: `${SITE_URL}/blog`,
    title: `Blog — ${SITE_NAME}`,
    description:
      "Practical, sourced writing on PDFs and the tools that work with them.",
  },
};

export default function BlogIndexPage() {
  const all = getAllPosts();
  const bc = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "Blog", url: `${SITE_URL}/blog` },
  ]);
  const listing = blogListingLd(
    all.map((p) => ({ slug: p.slug, title: p.title, date: p.date }))
  );

  return (
    <>
      {/* Auto-discovery link tags for feed readers */}
      {feedDiscoveryLinks().map((link) => (
        <link
          key={link.href}
          rel={link.rel}
          type={link.type}
          title={link.title}
          href={link.href}
        />
      ))}
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(bc)}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(listing)}
        />

        <section className="container-narrow py-16">
          <header className="mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              The {SITE_NAME} blog
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Practical, sourced writing on PDFs and the tools that work with
              them. Tutorials, format primers, and honest comparisons — all
              built on facts we can cite.
            </p>
          </header>

          <ul className="grid gap-6 sm:grid-cols-2">
            {all.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.cover}
                      alt=""
                      width={1280}
                      height={720}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span>{post.readingMinutes} min read</span>
                    </div>
                    <h2 className="text-lg font-semibold leading-snug text-slate-900 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                      {post.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {post.excerpt}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
