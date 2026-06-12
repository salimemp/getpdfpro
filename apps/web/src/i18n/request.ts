/**
 * next-intl request config — runs in both server (Pages Router
 * getStaticProps) and edge (middleware) contexts. The middleware
 * uses this to figure out which locale to apply, and server
 * components use it to load the message catalog.
 *
 * For v1 we only ship "en" but the routing is wired so adding
 * a new locale is a one-line change in i18n/config.ts.
 */

import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

// Static message imports. Webpack needs statically analyzable
// import paths, so we use a mapping instead of a dynamic
// `import(\`../messages/${locale}.json\`)` (which fails the
// build because the template variable isn't resolved at
// compile time). When you add a new locale, add its import
// here AND to LOCALES.
import en from "../../messages/en.json";

const MESSAGES: Record<Locale, Record<string, any>> = {
  en,
};

export default getRequestConfig(async ({ requestLocale }) => {
  // The locale is resolved by the middleware. For server
  // components that aren't behind a [locale] route, it falls
  // back to the default. The middleware sets the
  // x-next-intl-locale header so we can read it here.
  const requested = await requestLocale;
  const locale: Locale = (LOCALES as readonly string[]).includes(requested ?? "")
    ? (requested as Locale)
    : DEFAULT_LOCALE;

  const messages = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];

  return {
    locale,
    messages,
    // We use the modern (v3) API. Set the current time zone
    // for any date formatting in messages.
    timeZone: "UTC",
  };
});
