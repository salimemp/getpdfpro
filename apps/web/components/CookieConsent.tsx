'use client';

/**
 * <CookieConsent /> — GDPR / CCPA consent banner.
 *
 * Mounted once at the [locale] layout level. Once the user has decided,
 * this component renders nothing. It re-opens if a `getpdfpro:consent:reopen`
 * window event is fired (used by the footer's "Cookie settings" link).
 *
 * No external UI library — pure Tailwind. Matches the existing brand
 * tokens (brand-500 / brand-600 / brand-700).
 *
 * Accessibility:
 *   - role="dialog" + aria-modal="true" + aria-labelledby
 *   - ESC closes (treated as "Reject non-essential")
 *   - focus is moved into the banner on open
 *   - focus is restored to the previously focused element on close
 *   - native HTML inputs for category toggles (no custom role attr)
 *
 * Blocking non-essential scripts:
 *   - On every decision, we emit a `getpdfpro:consent` window CustomEvent
 *     with the full decision in `detail`. Analytics / marketing loaders
 *     should `window.addEventListener('getpdfpro:consent', ...)` and gate
 *     their load on `detail.analytics` / `detail.marketing`.
 *   - On mount, if a decision is already stored, we emit it once so
 *     late-mounting scripts learn the current state.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';

import {
  ACCEPT_ALL,
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT,
  REJECT_NON_ESSENTIAL,
  clearConsent,
  hasDecided,
  isDoNotTrackEnabled,
  readConsent,
  withTimestamp,
  writeConsent,
} from '@/lib/consent';
import type { ConsentDecision } from '@/lib/consent';
import { CONSENT_REOPEN_EVENT, emitConsentEvent } from '@/lib/consent-events';

const REOPEN_EVENT = CONSENT_REOPEN_EVENT;

type View = 'summary' | 'customize';

export function CookieConsent() {
  const headingId = useId();
  const descId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const acceptAllRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<View>('summary');
  const [draft, setDraft] = useState<{ analytics: boolean; marketing: boolean }>({
    analytics: false,
    marketing: false,
  });

  // ── mount-time decision ─────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const stored = readConsent(window.localStorage);
    if (hasDecided(stored)) {
      // Already decided — hide banner, but emit the current state so
      // late-mounting analytics scripts can load if they're allowed.
      setVisible(false);
      emitConsentEvent(stored);
      return;
    }

    // No decision yet. Respect Do Not Track.
    if (isDoNotTrackEnabled(window.navigator, window)) {
      const decided = withTimestamp(REJECT_NON_ESSENTIAL);
      writeConsent(window.localStorage, decided);
      emitConsentEvent(decided);
      setVisible(false);
      return;
    }

    // Show the banner.
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    setVisible(true);
  }, []);

  // ── focus management when visibility flips on ───────────────────────
  useEffect(() => {
    if (!visible) return;
    // Move focus to the primary action after the slide-in finishes.
    const t = window.setTimeout(() => acceptAllRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [visible]);

  // ── restore focus on close ──────────────────────────────────────────
  useEffect(() => {
    if (visible) return;
    // Run after the close transition so the element we want to focus is mounted.
    const t = window.setTimeout(() => {
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    }, 0);
    return () => window.clearTimeout(t);
  }, [visible]);

  // ── ESC to dismiss (treated as reject non-essential) ────────────────
  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        commit(REJECT_NON_ESSENTIAL);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── reopen event from footer link ───────────────────────────────────
  useEffect(() => {
    function onReopen() {
      // Clear stored decision, then re-show.
      clearConsent(window.localStorage);
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      setDraft({ analytics: false, marketing: false });
      setView('summary');
      setVisible(true);
    }
    window.addEventListener(REOPEN_EVENT, onReopen);
    return () => window.removeEventListener(REOPEN_EVENT, onReopen);
  }, []);

  // ── focus trap (simple — Tab cycles within the banner) ──────────────
  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, view]);

  // ── commit a decision ───────────────────────────────────────────────
  const commit = useCallback(
    (decision: Omit<ConsentDecision, 'decidedAt'>) => {
      const stamped = withTimestamp(decision);
      writeConsent(window.localStorage, stamped);
      emitConsentEvent(stamped);
      setVisible(false);
    },
    [],
  );

  function handleAcceptAll() {
    commit(ACCEPT_ALL);
  }
  function handleRejectAll() {
    commit(REJECT_NON_ESSENTIAL);
  }
  function handleSaveCustom() {
    commit({
      essential: true,
      analytics: draft.analytics,
      marketing: draft.marketing,
    });
  }

  if (!mounted) return null;
  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descId}
      data-testid="cookie-consent-banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-2xl ring-1 ring-black/5
                 dark:border-slate-800 dark:bg-slate-950 dark:ring-white/10
                 md:inset-x-4 md:bottom-4 md:rounded-2xl"
    >
      <div className="mx-auto max-w-5xl p-5 md:p-6">
        {view === 'summary' ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <div className="flex-1">
              <h2
                id={headingId}
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                We use cookies
              </h2>
              <p
                id={descId}
                className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
              >
                We use essential cookies to keep GetPDFPro running. With your
                permission we also use analytics cookies to improve the product
                and marketing cookies to measure campaigns. You can change your
                choice at any time in{' '}
                <Link
                  href="#cookie-settings"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(new Event(REOPEN_EVENT));
                  }}
                  className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-500"
                >
                  Cookie settings
                </Link>
                .
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <Link
                  href="/privacy"
                  className="hover:underline"
                >
                  Privacy Policy
                </Link>
                <span aria-hidden="true"> · </span>
                <Link
                  href="/terms"
                  className="hover:underline"
                >
                  Terms of Use
                </Link>
              </p>
            </div>

            <div className="flex flex-col gap-2 md:items-end">
              <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                <button
                  ref={acceptAllRef}
                  type="button"
                  onClick={handleAcceptAll}
                  data-testid="cookie-accept-all"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={handleRejectAll}
                  data-testid="cookie-reject-all"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Reject non-essential
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraft({ analytics: false, marketing: false });
                  setView('customize');
                }}
                className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-400"
              >
                Customize
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4">
              <h2
                id={headingId}
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Cookie preferences
              </h2>
              <button
                type="button"
                onClick={() => setView('summary')}
                className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-400"
                aria-label="Back to summary"
              >
                Back
              </button>
            </div>
            <p
              id={descId}
              className="mt-1 text-sm text-slate-600 dark:text-slate-300"
            >
              Choose which cookies you allow. Essential cookies are always on
              because the site can&apos;t function without them.
            </p>

            <ul className="mt-4 space-y-3">
              <ConsentRow
                title="Essential"
                description="Required for core features like session management, security, and accessibility settings. Cannot be disabled."
                checked
                disabled
                onChange={() => undefined}
              />
              <ConsentRow
                title="Analytics"
                description="Help us understand how visitors use GetPDFPro so we can improve it. Aggregated, no personal data."
                checked={draft.analytics}
                onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
                testId="cookie-toggle-analytics"
              />
              <ConsentRow
                title="Marketing"
                description="Used to measure the effectiveness of campaigns. We do not run ad retargeting on this site."
                checked={draft.marketing}
                onChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
                testId="cookie-toggle-marketing"
              />
            </ul>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setView('summary')}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                data-testid="cookie-save-custom"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentRow({
  title,
  description,
  checked,
  disabled,
  onChange,
  testId,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  const id = useId();
  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div>
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-900 dark:text-slate-100"
        >
          {title}
        </label>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>
      <div className="pt-0.5">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          data-testid={testId}
          className="h-5 w-5 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>
    </li>
  );
}

// Re-exported so server components can import the key constant.
export { CONSENT_STORAGE_KEY, DEFAULT_CONSENT };
