/**
 * next-intl middleware.
 *
 * With `localePrefix: 'as-needed'`, English (the default) lives at
 * the root path (e.g. /pricing), and non-default locales get a
 * prefix (e.g. /es/pricing). For v1 we only ship English so the
 * middleware is effectively a no-op for routing — but we still
 * need it for next-intl internals.
 *
 * The matcher excludes paths that should never be locale-aware:
 * API routes, static files, the marketing assets, the public
 * folder. See next-intl docs for the recommended pattern.
 */

import createMiddleware from "next-intl/middleware";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./i18n/config";

export default createMiddleware({
  // All locales we support. Adding a new locale = adding it here
  // and dropping in a messages/<locale>.json file.
  locales: LOCALES as unknown as string[],
  defaultLocale: DEFAULT_LOCALE,
  // 'as-needed' = no prefix for the default locale, prefix for
  // the rest. Marketing URLs (/, /pricing, /about) stay clean
  // for English, get /<locale>/ prefix for other languages.
  localePrefix: "as-needed",
  // Disable the locale cookie. We don't persist locale across
  // sessions in v1 — it's read from the URL each time. Future
  // v2: enable locale cookie + sync with Supabase user prefs.
  localeCookie: undefined,
});

// Match every path EXCEPT:
//  - /api/* (API routes — no locale prefix)
//  - /_next/* (Next.js internals)
//  - Static files
//  - Public assets (favicon, robots.txt, sitemap.xml, RSS, atom, feed)
//  - The /[locale] route group (already localized)
export const config = {
  matcher: [
    "/((?!api|_next|_vercel|favicon\\.ico|robots\\.txt|sitemap\\.xml|rss\\.xml|atom\\.xml|feed\\.xml|feed\\.json|.*\\..*).*)",
  ],
};
