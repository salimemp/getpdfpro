/**
 * Single source of truth for the public site URL.
 * - In production: app.getpdfpro.com (the Vercel custom domain)
 * - In preview:      the Vercel preview URL
 * - In dev:          http://localhost:3000
 *
 * Read this in:
 * - app/sitemap.ts    (sitemap URLs)
 * - app/robots.ts     (robots.txt host)
 * - app/layout.tsx    (metadataBase, og:url)
 * - app/page.tsx      (canonical)
 *
 * Precedence: NEXT_PUBLIC_SITE_URL env > this default.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://app.getpdfpro.com";

export const SITE_NAME = "GetPDFPro";
export const SITE_DESCRIPTION =
  "Free, fast, private PDF tools. Merge, split, compress, convert, sign, and edit PDFs in your browser. End-to-end encrypted, GDPR-ready, WCAG 2.1 AA.";
export const SITE_LOCALE = "en_US";
export const SITE_TWITTER = "@getpdfpro";
