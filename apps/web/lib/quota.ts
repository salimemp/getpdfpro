"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth";

/**
 * Per-user daily quota, client-side. Two tiers:
 *   - anonymous:  1 task per day, keyed by a stable per-browser UUID
 *   - signed-in:  50 tasks per day, keyed by Supabase user ID
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
const SIGNED_IN_LIMIT = 50;

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

type QuotaState = {
  /** Unique key for the current user (anon-uuid or supabase user id). */
  userKey: string;
  /** Tasks used today. */
  used: number;
  /** Daily limit. */
  limit: number;
  /** Whether the user can run a tool right now. */
  canRun: boolean;
  /** Remaining tasks today. */
  remaining: number;
  /** Increment the counter after a successful tool run. */
  consume: () => void;
  /** Reset (for testing). */
  reset: () => void;
};

export function useQuota(): QuotaState {
  const auth = useAuth();
  const [userKey, setUserKey] = useState<string>("anon");
  const [used, setUsed] = useState<number>(0);
  const [limit, setLimit] = useState<number>(ANON_LIMIT);
  const [hydrated, setHydrated] = useState(false);

  // Compute the user key (anon vs supabase user id) + hydrate count
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isSignedIn = !!auth.user;
    const newLimit = isSignedIn ? SIGNED_IN_LIMIT : ANON_LIMIT;
    setLimit(newLimit);

    if (isSignedIn && auth.user) {
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
  }, [auth.user]);

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
    remaining,
    canRun: remaining > 0,
    consume,
    reset,
  };
}
