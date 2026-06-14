/**
 * Cookie consent — pure data + helpers.
 *
 * No React, no DOM, no Next. Easy to unit-test.
 *
 * Storage shape (localStorage key: getpdfpro.consent.v1):
 *   {
 *     "essential":  true,                    // always true, not user-controllable
 *     "analytics":  boolean,
 *     "marketing":  boolean,
 *     "decidedAt":  "2026-06-13T11:30:00.000Z"
 *   }
 *
 * v1: initial schema. Bump the key suffix on breaking changes.
 */

export const CONSENT_STORAGE_KEY = 'getpdfpro.consent.v1';

/** Consent decision shape. */
export type ConsentDecision = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string; // ISO-8601
};

/** The categories we expose to the user. */
export type ConsentCategory = 'essential' | 'analytics' | 'marketing';

/** Default state — no decision has been recorded yet. */
export const DEFAULT_CONSENT: ConsentDecision = {
  essential: true,
  analytics: false,
  marketing: false,
  decidedAt: '',
};

/** "Accept all" preset. */
export const ACCEPT_ALL: ConsentDecision = {
  essential: true,
  analytics: true,
  marketing: true,
  decidedAt: '', // filled in at write time
};

/** "Reject non-essential" preset. */
export const REJECT_NON_ESSENTIAL: ConsentDecision = {
  essential: true,
  analytics: false,
  marketing: false,
  decidedAt: '',
};

/**
 * Serialize a decision to a stable JSON string.
 * Keys are written in fixed order so equality is deterministic.
 */
export function serializeConsent(decision: ConsentDecision): string {
  return JSON.stringify({
    essential: decision.essential,
    analytics: decision.analytics,
    marketing: decision.marketing,
    decidedAt: decision.decidedAt,
  });
}

/**
 * Parse a stored value. Returns null if it's malformed, missing fields,
 * or wrong types — treat malformed data the same as no decision.
 */
export function deserializeConsent(raw: string | null | undefined): ConsentDecision | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  if (obj.essential !== true) return null; // essential must be true
  if (typeof obj.analytics !== 'boolean') return null;
  if (typeof obj.marketing !== 'boolean') return null;
  if (typeof obj.decidedAt !== 'string') return null;

  return {
    essential: true,
    analytics: obj.analytics,
    marketing: obj.marketing,
    decidedAt: obj.decidedAt,
  };
}

/**
 * Apply a preset, stamping the current time. Pure — no I/O.
 */
export function withTimestamp(decision: Omit<ConsentDecision, 'decidedAt'>, now: Date = new Date()): ConsentDecision {
  return { ...decision, decidedAt: now.toISOString() };
}

/**
 * Has the user made a decision?
 */
export function hasDecided(decision: ConsentDecision | null): decision is ConsentDecision {
  return decision !== null && decision.decidedAt !== '';
}

/**
 * Is Do Not Track enabled? We respect both the modern and legacy forms.
 *
 * - navigator.doNotTrack: '1' / 'yes'  (spec form)
 * - window.doNotTrack:    '1'          (legacy Firefox)
 * - msDoNotTrack:         '1'          (legacy IE/Edge)
 *
 * The string "unspecified" counts as DNT-off.
 */
export function isDoNotTrackEnabled(
  nav: unknown,
  win: unknown,
): boolean {
  // Read the DNT property defensively — TS doesn't know `unknown` has it,
  // and at runtime the property may be missing or non-string. Coerce.
  const n =
    typeof nav === 'object' && nav !== null && 'doNotTrack' in nav
      ? (nav as { doNotTrack: unknown }).doNotTrack
      : undefined;
  const w =
    typeof win === 'object' && win !== null && 'doNotTrack' in win
      ? (win as { doNotTrack: unknown }).doNotTrack
      : undefined;
  const raw = (n ?? w ?? null) as unknown;
  if (raw === null || raw === undefined) return false;
  return raw === '1' || raw === 'yes';
}

/**
 * Read consent from a storage-like object. Returns null on miss / parse error.
 */
export function readConsent(storage: { getItem(k: string): string | null }): ConsentDecision | null {
  try {
    return deserializeConsent(storage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Write consent to a storage-like object. Swallows quota / disabled-storage errors.
 * Returns true on success.
 */
export function writeConsent(
  storage: { setItem(k: string, v: string): void },
  decision: ConsentDecision,
): boolean {
  try {
    storage.setItem(CONSENT_STORAGE_KEY, serializeConsent(decision));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove the stored decision. Used by the "Cookie settings" link.
 */
export function clearConsent(storage: { removeItem(k: string): void }): void {
  try {
    storage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
