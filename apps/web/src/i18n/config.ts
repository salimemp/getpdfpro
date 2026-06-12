/**
 * next-intl configuration.
 *
 * Strategy for v1:
 *  - Single locale (English) shipped, but the infrastructure is ready
 *    for adding more — drop a new messages/<locale>.json file and
 *    add the locale to the LOCALES list.
 *  - The middleware (apps/web/src/middleware.ts) only kicks in for
 *    paths that are explicitly localized (see routing notes below).
 *  - Marketing pages (home, pricing, blog, about, contact, privacy,
 *    terms) get localized via the [locale] route group. The 26 tool
 *    pages and AI tools stay at root paths (/tools/*) and use the
 *    default English messages. In v2+ when we add more locales we
 *    can either move tools into the [locale] group or wrap their
 *    copy with t() calls directly.
 *
 * Routing note: we use next-intl's "as-needed" locale prefix via
 * `localePrefix: 'as-needed'` so English (default) lives at /pricing,
 * /, /about, etc. — no /en/ prefix. Future locales live at
 * /<locale>/pricing, /<locale>/about. This keeps existing URLs
 * working and gives clean SEO for the new locales.
 */

export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

// Add new locales here as you translate. Each needs a
// messages/<locale>.json file with the same keys as messages/en.json.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
};
// ISO codes for next-intl internals (date formatting, etc.)
export const LOCALE_CODES: Record<Locale, string> = {
  en: "en-US",
};
