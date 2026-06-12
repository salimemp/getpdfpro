const createNextIntlPlugin = require("next-intl/plugin");

/** @type {import('next').NextConfig} */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // typed routes (Next 15.5+) — catches broken links at build time
  typedRoutes: true,
  // CORS-safe headers for the API
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
