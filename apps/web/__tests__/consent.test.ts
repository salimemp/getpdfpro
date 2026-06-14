/**
 * Unit tests for the consent data + helpers.
 *
 * Pure logic — no DOM, no React. The storage adapter is a plain in-memory
 * object, matching the Storage interface used at the call site.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  ACCEPT_ALL,
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT,
  REJECT_NON_ESSENTIAL,
  clearConsent,
  deserializeConsent,
  hasDecided,
  isDoNotTrackEnabled,
  readConsent,
  serializeConsent,
  withTimestamp,
  writeConsent,
} from '@/lib/consent';

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    key(i: number) {
      return Array.from(map.keys())[i] ?? null;
    },
    removeItem(k: string) {
      map.delete(k);
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
  };
}

describe('serializeConsent / deserializeConsent', () => {
  it('round-trips a decision', () => {
    const decision = {
      essential: true as const,
      analytics: true,
      marketing: false,
      decidedAt: '2026-06-13T11:30:00.000Z',
    };
    const raw = serializeConsent(decision);
    const parsed = deserializeConsent(raw);
    expect(parsed).toEqual(decision);
  });

  it('produces a stable key order', () => {
    const raw = serializeConsent({
      essential: true,
      analytics: false,
      marketing: true,
      decidedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(raw).toBe(
      '{"essential":true,"analytics":false,"marketing":true,"decidedAt":"2026-01-01T00:00:00.000Z"}',
    );
  });

  it('returns null for malformed JSON', () => {
    expect(deserializeConsent('not json')).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(deserializeConsent('"hello"')).toBeNull();
    expect(deserializeConsent('null')).toBeNull();
    expect(deserializeConsent('42')).toBeNull();
  });

  it('returns null when essential is not true', () => {
    expect(
      deserializeConsent(
        JSON.stringify({ essential: false, analytics: false, marketing: false, decidedAt: 'x' }),
      ),
    ).toBeNull();
  });

  it('returns null when types are wrong', () => {
    expect(
      deserializeConsent(
        JSON.stringify({ essential: true, analytics: 'yes', marketing: false, decidedAt: 'x' }),
      ),
    ).toBeNull();
    expect(
      deserializeConsent(
        JSON.stringify({ essential: true, analytics: false, marketing: 1, decidedAt: 'x' }),
      ),
    ).toBeNull();
    expect(
      deserializeConsent(
        JSON.stringify({ essential: true, analytics: false, marketing: false, decidedAt: 123 }),
      ),
    ).toBeNull();
  });

  it('handles empty / nullish input', () => {
    expect(deserializeConsent(null)).toBeNull();
    expect(deserializeConsent(undefined)).toBeNull();
    expect(deserializeConsent('')).toBeNull();
  });
});

describe('withTimestamp', () => {
  it('stamps the current time as ISO-8601', () => {
    const fixed = new Date('2026-06-13T11:30:00.000Z');
    const result = withTimestamp(REJECT_NON_ESSENTIAL, fixed);
    expect(result.decidedAt).toBe('2026-06-13T11:30:00.000Z');
    expect(result.analytics).toBe(false);
    expect(result.marketing).toBe(false);
    expect(result.essential).toBe(true);
  });

  it('uses the current time when no date is given', () => {
    const before = new Date().toISOString();
    const result = withTimestamp(ACCEPT_ALL);
    const after = new Date().toISOString();
    expect(result.decidedAt >= before).toBe(true);
    expect(result.decidedAt <= after).toBe(true);
  });
});

describe('hasDecided', () => {
  it('returns false for null', () => {
    expect(hasDecided(null)).toBe(false);
  });

  it('returns false for a decision with no timestamp', () => {
    expect(hasDecided(DEFAULT_CONSENT)).toBe(false);
  });

  it('returns true for a real decision', () => {
    expect(hasDecided(withTimestamp(ACCEPT_ALL))).toBe(true);
  });
});

describe('isDoNotTrackEnabled', () => {
  it('returns false when no DNT signals are present', () => {
    expect(isDoNotTrackEnabled(undefined, undefined)).toBe(false);
    expect(isDoNotTrackEnabled({}, {})).toBe(false);
    expect(isDoNotTrackEnabled({ doNotTrack: 'unspecified' }, undefined)).toBe(false);
    expect(isDoNotTrackEnabled({ doNotTrack: null }, { doNotTrack: null })).toBe(false);
  });

  it('returns true when navigator.doNotTrack is "1"', () => {
    expect(isDoNotTrackEnabled({ doNotTrack: '1' }, undefined)).toBe(true);
  });

  it('returns true when window.doNotTrack is "1"', () => {
    expect(isDoNotTrackEnabled(undefined, { doNotTrack: '1' })).toBe(true);
  });

  it('returns true for "yes" (some Firefox builds)', () => {
    expect(isDoNotTrackEnabled({ doNotTrack: 'yes' }, undefined)).toBe(true);
  });

  it('prefers navigator.doNotTrack when both are set', () => {
    expect(
      isDoNotTrackEnabled({ doNotTrack: '1' }, { doNotTrack: '0' }),
    ).toBe(true);
  });
});

describe('readConsent / writeConsent / clearConsent', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = makeMemoryStorage();
  });

  it('writes to the canonical key and reads it back', () => {
    const decision = withTimestamp(ACCEPT_ALL, new Date('2026-06-13T00:00:00.000Z'));
    expect(writeConsent(storage, decision)).toBe(true);
    expect(storage.getItem(CONSENT_STORAGE_KEY)).not.toBeNull();
    expect(readConsent(storage)).toEqual(decision);
  });

  it('returns null when nothing is stored', () => {
    expect(readConsent(storage)).toBeNull();
  });

  it('clears the decision', () => {
    writeConsent(storage, withTimestamp(REJECT_NON_ESSENTIAL));
    expect(readConsent(storage)).not.toBeNull();
    clearConsent(storage);
    expect(readConsent(storage)).toBeNull();
  });

  it('swallows storage errors from writeConsent', () => {
    const failingStorage = {
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    };
    expect(writeConsent(failingStorage, withTimestamp(ACCEPT_ALL))).toBe(false);
  });

  it('swallows read errors and returns null', () => {
    const failingStorage = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    };
    expect(readConsent(failingStorage)).toBeNull();
  });

  it('swallows removeItem errors', () => {
    const failingStorage = {
      removeItem: vi.fn(() => {
        throw new Error('boom');
      }),
    };
    expect(() => clearConsent(failingStorage)).not.toThrow();
  });
});

describe('preset constants', () => {
  it('ACCEPT_ALL enables analytics and marketing', () => {
    expect(ACCEPT_ALL.analytics).toBe(true);
    expect(ACCEPT_ALL.marketing).toBe(true);
    expect(ACCEPT_ALL.essential).toBe(true);
  });

  it('REJECT_NON_ESSENTIAL disables analytics and marketing', () => {
    expect(REJECT_NON_ESSENTIAL.analytics).toBe(false);
    expect(REJECT_NON_ESSENTIAL.marketing).toBe(false);
    expect(REJECT_NON_ESSENTIAL.essential).toBe(true);
  });
});
