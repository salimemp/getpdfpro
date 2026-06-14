/**
 * Cookie consent — public event API.
 *
 * Other code (analytics loaders, marketing pixels) should listen for
 *   window.dispatchEvent(new CustomEvent('getpdfpro:consent', { detail }))
 * to learn when the user has decided.
 *
 * The detail shape is the full ConsentDecision.
 */

import type { ConsentDecision } from './consent';

export const CONSENT_EVENT = 'getpdfpro:consent';
export const CONSENT_REOPEN_EVENT = 'getpdfpro:consent:reopen';

export type ConsentEventDetail = ConsentDecision;

export function emitConsentEvent(detail: ConsentDecision): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent<ConsentEventDetail>(CONSENT_EVENT, { detail }));
  } catch {
    /* SSR / non-DOM — ignore */
  }
}
