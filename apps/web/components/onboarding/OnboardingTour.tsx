"use client";

/**
 * OnboardingTour — page-level mount point for the onboarding flow.
 *
 * - For anonymous users on `/`: shows a "Take the tour" button in the
 *   hero and arms the trigger so the button is visible.
 * - For signed-in users on `/` or `/tools`: auto-starts the tour the
 *   first time they visit.
 *
 * Server-rendered pages just import this client component once.
 */

import { ArrowRight } from "lucide-react";
import { useOnboarding } from "./OnboardingProvider";
import { useOnboardingTrigger } from "@/hooks/useOnboardingTrigger";

export function OnboardingTour({ variant = "full" }: { variant?: "full" | "silent" }) {
  const { start, hasCompleted, active } = useOnboarding();
  const { armed } = useOnboardingTrigger();

  // `silent` means: just arm/auto-start, don't draw a hero button. Used
  // on pages that should not show a CTA but should still react to the
  // trigger hook (e.g. /tools for the auto-start branch).
  if (variant === "silent") return null;

  // Show the button when:
  //   - the tour is not currently running
  //   - the user has not completed it (or the trigger flagged it)
  //   - the user is anonymous (armed) OR they completed but want a
  //     replay — in the latter case hasCompleted is true and we still
  //     want a small "Replay tour" link. We render it only for armed
  //     anonymous users to keep the hero uncluttered; signed-in users
  //     are auto-started instead.
  const showButton = !active && armed;
  if (!showButton) return null;

  return (
    <div className="mt-4 flex items-center justify-center">
      <button
        type="button"
        onClick={start}
        data-onboarding-trigger="hero-tour"
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/70 px-4 py-1.5 text-sm font-medium text-slate-700 backdrop-blur transition hover:border-brand-300 hover:bg-white hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:text-brand-300"
      >
        Take the tour
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
