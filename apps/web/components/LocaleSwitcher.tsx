"use client";

/**
 * Locale switcher — dropdown showing the current locale and
 * the list of available locales. Adding a new locale = adding
 * it to src/i18n/config.ts and dropping in a messages/<locale>.json
 * file; this component picks it up automatically.
 *
 * The switcher writes the user's preference to localStorage
 * (key 'getpdfpro:locale'). We read this on next visit to
 * pre-select. (The URL routing is handled by next-intl's
 * middleware via the as-needed prefix; in v1 the URL doesn't
 * change since English is the default and the only locale.)
 *
 * Future: a server endpoint can sync this to Supabase user
 * metadata for signed-in users.
 */

import { Languages, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/src/i18n/config";

const STORAGE_KEY = "getpdfpro:locale";

export function LocaleSwitcher() {
  const t = useTranslations("Language");
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // We only want the dropdown to be interactive after hydration —
  // otherwise server-rendered output would mismatch the client
  // (we use localStorage which only exists on the client).
  useEffect(() => setMounted(true), []);

  // Persist current locale on mount (in case the user landed
  // via a URL change and we want to remember it).
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, current);
    } catch {
      // ignore
    }
  }, [current, mounted]);

  const switchTo = (locale: Locale) => {
    if (locale === current) {
      setOpen(false);
      return;
    }
    // With as-needed prefix, switching to the default locale
    // strips the prefix from the URL; switching to another
    // locale adds it. next-intl exposes a helper for this
    // via its Link component, but for an onClick handler we
    // build the new path manually.
    const newPath = buildNewPath(pathname, current, locale);
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
    // Force a hard navigation so the new locale is picked up
    // by the middleware on the next request. Soft navigation
    // doesn't re-run middleware in some edge cases.
    window.location.href = newPath;
  };

  if (!mounted) {
    // SSR placeholder — matches the size of the button so
    // there's no layout shift on hydration.
    return (
      <button
        type="button"
        className="rounded-lg p-2 text-slate-600 dark:text-slate-300"
        aria-label={t("label")}
        disabled
      >
        <Languages className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label={t("label")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("label")}
      >
        <Languages className="h-4 w-4" />
        <span className="hidden text-xs font-medium uppercase tracking-wide sm:inline">
          {current}
        </span>
      </button>
      {open && (
        <>
          {/* Click-away handler — rendered as a transparent
              overlay so the click target is the whole viewport
              but we don't block scrolling. */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t("label")}
            </div>
            {LOCALES.map((loc: Locale) => (
              <button
                key={loc}
                type="button"
                role="menuitemradio"
                aria-checked={current === loc}
                onClick={() => switchTo(loc)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>{LOCALE_LABELS[loc]}</span>
                {current === loc ? <Check className="h-4 w-4 text-brand-600" /> : null}
              </button>
            ))}
            {LOCALES.length === 1 && (
              <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                More languages coming soon.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function buildNewPath(pathname: string, from: Locale, to: Locale): string {
  // The default locale doesn't have a prefix; other locales do.
  // Strip the current locale prefix from the path, then add
  // the new one if needed.
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === from) {
    segments.shift();
  }
  if (to !== "en") {
    // To add a non-default locale, add a special marker that
    // we want as the first segment.
    segments.unshift(to);
  }
  const newPath = "/" + segments.join("/");
  return newPath || "/";
}
