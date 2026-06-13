"use client";

/**
 * useOnboardingTrigger — auto-start logic for the tour.
 *
 * - Anonymous first visit to / or /tools: do NOT auto-start. Just
 *   expose a "hasCompleted" flag so the landing page can show its
 *   "Take the tour" button.
 * - Signed-in first visit to / or /tools: auto-start the tour if it
 *   has not been completed/dismissed.
 *
 * "First visit" is defined as "no localStorage flag set yet" — once
 * the user completes or skips the tour, this hook is a no-op.
 *
 * The hook also exposes a `replay` action so the footer link can
 * restart the tour even after completion.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { usePathname } from "next/navigation";

const COMPLETED_KEY = "getpdfpro.onboarding.completed.v1";
const DISMISSED_KEY = "getpdfpro.onboarding.dismissed.v1";

function isDone(): boolean {
  if (typeof window === "undefined") return true; // treat SSR as "done" — never auto-start on server
  try {
    return (
      window.localStorage.getItem(COMPLETED_KEY) === "1" ||
      window.localStorage.getItem(DISMISSED_KEY) === "1"
    );
  } catch {
    return true;
  }
}

const TRIGGER_PATHS = new Set<string>(["/", "/tools"]);

export function useOnboardingTrigger() {
  const auth = useAuth();
  const { active, start, reset } = useOnboarding();
  const pathname = usePathname() ?? "/";
  // We track the "should I auto-start" decision in state so we can do
  // it exactly once per page load. Re-renders for unrelated reasons
  // don't re-evaluate.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    // Wait for auth to settle. If Supabase isn't configured, auth.loading
    // is false immediately and `auth.user` is null (anonymous).
    if (auth.loading) return;
    if (!TRIGGER_PATHS.has(pathname)) {
      setArmed(false);
      return;
    }
    if (isDone() || active) {
      setArmed(false);
      return;
    }
    if (auth.user) {
      // Signed-in: auto-start the tour once on this page.
      start();
      setArmed(false);
    } else {
      // Anonymous: just arm the "Take the tour" button on /.
      setArmed(true);
    }
  }, [auth.loading, auth.user, pathname, active, start]);

  const replay = () => {
    reset();
    start();
  };

  return { armed, replay };
}
