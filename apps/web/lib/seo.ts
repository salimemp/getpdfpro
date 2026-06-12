import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_LOCALE, SITE_TWITTER } from "./site";

/**
 * JSON-LD structured data for the homepage.
 * - Organization: lets Google build a knowledge panel
 * - WebSite + SearchAction: enables the sitelinks searchbox
 * - SoftwareApplication: tells Google this is a software product with
 *   pricing tiers + ratings. (We don't have ratings yet; the
 *   aggregateRating field is omitted rather than fabricated.)
 */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    description: SITE_DESCRIPTION,
    sameAs: [
      // Add real social profile URLs here as we publish them.
      // We intentionally do not include URLs we don't actually own.
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@getpdfpro.com",
      availableLanguage: ["English"],
    },
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LOCALE,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/tools?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "PDF Editor",
    operatingSystem: "Web, iOS, Android, macOS, Windows, Linux",
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
        category: "free",
        description: "50 PDF tasks per day for signed-in users. 1 task per day for anonymous users.",
      },
      {
        "@type": "Offer",
        name: "Pro (Monthly)",
        price: "5.99",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "5.99",
          priceCurrency: "USD",
          unitCode: "MON",
        },
        category: "subscription",
      },
      {
        "@type": "Offer",
        name: "Pro (Yearly)",
        price: "53.88",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "53.88",
          priceCurrency: "USD",
          unitCode: "ANN",
        },
        category: "subscription",
      },
    ],
    featureList: [
      "Merge PDF files",
      "Split PDF files",
      "Compress PDF files",
      "Convert PDF to other formats",
      "Convert other formats to PDF",
      "End-to-end encryption",
      "GDPR compliant",
      "WCAG 2.1 AA accessible",
      "25+ language interface",
      "No file storage — files discarded after processing",
    ],
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function blogPostingLd(post: {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  cover: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: post.author, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png` },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    image: `${SITE_URL}${post.cover}`,
    inLanguage: SITE_LOCALE,
  };
}

export function blogListingLd(items: { slug: string; title: string; date: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${SITE_NAME} blog`,
    url: `${SITE_URL}/blog`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    blogPost: items.map((it) => ({
      "@type": "BlogPosting",
      headline: it.title,
      url: `${SITE_URL}/blog/${it.slug}`,
      datePublished: it.date,
    })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/**
 * One helper to render a script tag with JSON-LD. Use in any page:
 *   <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(...)} />
 */
export function ldJson(obj: object) {
  return { __html: JSON.stringify(obj) };
}

export { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_LOCALE, SITE_TWITTER };
