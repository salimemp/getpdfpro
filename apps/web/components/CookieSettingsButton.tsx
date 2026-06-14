'use client';

/**
 * <CookieSettingsButton /> — opens the cookie consent banner from a
 * static page. Used at the bottom of /privacy and /terms.
 */

import { useCallback } from 'react';

const REOPEN_EVENT = 'getpdfpro:consent:reopen';

export function CookieSettingsButton() {
  const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(REOPEN_EVENT));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="cookie-settings-button"
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      Manage cookie settings
    </button>
  );
}
