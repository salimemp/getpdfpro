"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth";

/**
 * Per-user daily quota, client-side. Three tiers:
 *   - anonymous:  1 task per day, keyed by a stable per-browser UUID
 *   - free:       50 tasks per day, keyed by Supabase user ID
 *   - pro/beta:   1000 tasks per day (synced from Supabase user metadata)
 *
 * Storage: localStorage. Schema:
 *   key:   getpdfpro:quota:<userKey>:<YYYY-MM-DD>
 *   value: number (task count for that day)
 *
 * When the user signs in, the anonymous counter is migrated to the
 * signed-in counter for the same day (so they don't lose credit).
 *
 * Why client-side: the server doesn't know who the anonymous user is,
 * and we want a fast UI without round-tripping to the API for every
 * tool use. Server-side enforcement is a follow-up once we have the
 * Supabase project and can mint per-user signed request tokens.
 */

const ANON_LIMIT = 1;
const FREE_LIMIT = 50;
const PRO_LIMIT = 1000;

const STORAGE_PREFIX = "getpdfpro:quota:";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function storageKey(userKey: string) {
  return `${STORAGE_PREFIX}${userKey}:${todayKey()}`;
}

function getAnonymousUserKey(): string {
  if (typeof window === "undefined") return "anon";
  const KEY = "getpdfpro:anon_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    // crypto.randomUUID is available in all modern browsers
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `anon-${crypto.randomUUID()}`
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

function readCount(userKey: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(storageKey(userKey));
  return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
}

function writeCount(userKey: string, count: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userKey), String(count));
}

/**
 * One-time migration: when a user signs in for the first time on a
 * given day, fold their anonymous count into their signed-in count so
 * they don't get a free reset.
 */
function migrateAnonToUser(anonKey: string, userKey: string) {
  if (typeof window === "undefined") return;
  const migratedFlag = `${STORAGE_PREFIX}migrated:${userKey}:${todayKey()}`;
  if (localStorage.getItem(migratedFlag) === "1") return;
  const anonCount = readCount(anonKey);
  const userCount = readCount(userKey);
  writeCount(userKey, anonCount + userCount);
  localStorage.setItem(migratedFlag, "1");
}

type Tier = "anon" | "free" | "pro";

type QuotaState = {
  /** Unique key for the current user (anon-uuid or supabase user id). */
  userKey: string;
  /** Tasks used today. */
  used: number;
  /** Daily limit. */
  limit: number;
  /** Current plan tier. */
  tier: Tier;
  /** Whether the user can run a tool right now. */
  canRun: boolean;
  /** Remaining tasks today. */
  remaining: number;
  /** Increment the counter after a successful tool run. */
  consume: () => void;
  /** Reset (for testing). */
  reset: () => void;
};

/**
 * Read the user's plan tier from Supabase user metadata.
 * The Stripe webhook (or a beta-claim flow) writes to
 * auth.users.user_metadata.plan = 'pro' | 'free'.
 * Until that's wired, defaults to 'free' for any signed-in user.
 */
function getUserTier(user: { user_metadata?: Record<string, unknown> } | null | undefined): Tier {
  if (!user) return "anon";
  const plan = (user.user_metadata?.plan as string | undefined) ?? "free";
  if (plan === "pro" || plan === "beta") return "pro";
  return "free";
}

export function useQuota(): QuotaState {
  const auth = useAuth();
  // Depend on a stable primitive (user id) instead of the user
  // object reference. This prevents the effect from re-running on
  // every render if the Supabase client returns a new Session object
  // (and therefore a new User object) for the same user.
  const userId = auth.user?.id ?? null;
  const [userKey, setUserKey] = useState<string>("anon");
  const [used, setUsed] = useState<number>(0);
  const [tier, setTier] = useState<Tier>("anon");
  const [hydrated, setHydrated] = useState(false);

  // Compute the user key (anon vs supabase user id) + tier + hydrate count
  useEffect(() => {
    if (typeof window === "undefined") return;

    const newTier = getUserTier(auth.user);
    setTier(newTier);

    if (auth.user) {
      const newKey = `user-${auth.user.id}`;
      const anonKey = getAnonymousUserKey();
      migrateAnonToUser(anonKey, newKey);
      setUserKey(newKey);
      setUsed(readCount(newKey));
    } else {
      const newKey = getAnonymousUserKey();
      setUserKey(newKey);
      setUsed(readCount(newKey));
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Derive the limit from the tier — no separate state needed.
  const limit =
    tier === "pro" ? PRO_LIMIT : tier === "free" ? FREE_LIMIT : ANON_LIMIT;

  const consume = useCallback(() => {
    const next = readCount(userKey) + 1;
    writeCount(userKey, next);
    setUsed(next);
  }, [userKey]);

  const reset = useCallback(() => {
    writeCount(userKey, 0);
    setUsed(0);
  }, [userKey]);

  // While hydrating, return a safe default (allow running, no used)
  // so the UI doesn't show "limit reached" briefly during load.
  if (!hydrated) {
    return {
      userKey: "anon",
      used: 0,
      limit: ANON_LIMIT,
      tier: "anon",
      canRun: true,
      remaining: ANON_LIMIT,
      consume: () => {},
      reset: () => {},
    };
  }

  const remaining = Math.max(0, limit - used);
  return {
    userKey,
    used,
    limit,
    tier,
    remaining,
    canRun: remaining > 0,
    consume,
    reset,
  };
}
