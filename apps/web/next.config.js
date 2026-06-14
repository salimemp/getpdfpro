const createNextIntlPlugin = require("next-intl/plugin");

/** @type {import('next').NextConfig} */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // typed routes (Next 15.5+) — catches broken links at build time
  typedRoutes: true,
  // NOTE: security headers (X-Content-Type-Options, X-Frame-Options,
  // Referrer-Policy, Permissions-Policy, HSTS) used to live in this
  // file's `headers()` function. They moved to apps/web/_headers for
  // the Cloudflare Pages migration — the wrangler/OpenNext deploy reads
  // the file at the build output root and applies headers there.
  // The site-wide /* block in that file is the moral equivalent of
  // what used to live here.
};

module.exports = withNextIntl(nextConfig);
