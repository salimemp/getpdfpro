"use client";

/**
 * OnboardingProvider + TutorialOverlay
 *
 * A 5-step product tour for first-time visitors. Walks the declarative
 * step list in `./steps.ts`, spotlighting one element at a time and
 * rendering a popover with next/back/skip controls.
 *
 * State lives in this provider. Persistence is localStorage under a
 * versioned key so we can change the flow without trampling past users.
 *
 * SSR safety: the provider reads localStorage in a useEffect (never on
 * the server). The context value is always non-null.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X, Check } from "lucide-react";
import { STEPS, type Step } from "./steps";

const COMPLETED_KEY = "getpdfpro.onboarding.completed.v1";
const DISMISSED_KEY = "getpdfpro.onboarding.dismissed.v1";

type OnboardingState = {
  active: boolean;
  stepIndex: number;
  step: Step | null;
  hasCompleted: boolean;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
  reset: () => void;
};

const Ctx = createContext<OnboardingState | null>(null);

export function useOnboarding(): OnboardingState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOnboarding must be used within <OnboardingProvider>");
  return ctx;
}

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [hasCompleted, setHasCompleted] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Hydrate from localStorage on mount + cross-tab `storage` events.
  useEffect(() => {
    const sync = () => {
      const done = readFlag(COMPLETED_KEY) || readFlag(DISMISSED_KEY);
      setHasCompleted(done);
      if (done) setActive(false);
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const step = active ? STEPS[stepIndex] ?? null : null;
  const isLast = stepIndex >= STEPS.length - 1;

  const finish = useCallback((key: string) => {
    writeFlag(key);
    setHasCompleted(true);
    setActive(false);
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);
  const next = useCallback(() => {
    if (isLast) {
      finish(COMPLETED_KEY);
      return;
    }
    setStepIndex((i) => i + 1);
  }, [isLast, finish]);
  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const skip = useCallback(() => finish(DISMISSED_KEY), [finish]);
  const complete = useCallback(() => finish(COMPLETED_KEY), [finish]);
  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(COMPLETED_KEY);
      window.localStorage.removeItem(DISMISSED_KEY);
    } catch {
      /* ignore */
    }
    setHasCompleted(false);
  }, []);

  // Navigate to the step's path if we landed on the wrong page.
  useEffect(() => {
    if (step && step.path !== pathname) router.push(step.path);
  }, [step, pathname, router]);

  const value = useMemo<OnboardingState>(
    () => ({ active, stepIndex, step, hasCompleted, start, next, back, skip, complete, reset }),
    [active, stepIndex, step, hasCompleted, start, next, back, skip, complete, reset]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {step ? <TutorialOverlay step={step} index={stepIndex} last={isLast} /> : null}
    </Ctx.Provider>
  );
}

// --- Overlay ----------------------------------------------------------------

type OverlayProps = { step: Step; index: number; last: boolean };

function TutorialOverlay({ step, index, last }: OverlayProps) {
  const { next, back, skip, complete } = useOnboarding();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hasTarget = Boolean(step.targetSelector);
  const centered = step.placement === "center" || !hasTarget;

  // Track the target's bounding rect so the spotlight and popover
  // reposition on scroll/resize. Resets to null when the target is gone
  // (e.g. between page transitions).
  useLayoutEffect(() => {
    if (!hasTarget || !step.targetSelector) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(step.targetSelector!);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [hasTarget, step.targetSelector, step.path]);

  // Esc to dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  // Compute popover position inline. Using inline style + transform
  // keeps the popover visually anchored to the spotlight, even when
  // the target rect changes between renders.
  const popoverStyle = useMemo<React.CSSProperties>(() => {
    if (centered || !rect) {
      return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    }
    const cy = rect.top + rect.height / 2;
    const cx = rect.left + rect.width / 2;
    switch (step.placement) {
      case "top":
        return { left: rect.left, top: rect.top - 12, transform: "translateY(-100%)" };
      case "bottom":
        return { left: rect.left, top: rect.bottom + 12 };
      case "left":
        return { left: rect.left - 12, top: cy, transform: "translate(-100%, -50%)" };
      case "right":
        return { left: rect.right + 12, top: cy, transform: "translateY(-50%)" };
      default:
        return { left: cx, top: cy, transform: "translate(-50%, -50%)" };
    }
  }, [centered, rect, step.placement]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={`onb-${step.id}`} className="fixed inset-0 z-[100]">
      {/* Scrim — clicking it skips the tour (intent: close, not advance). */}
      <div className="absolute inset-0 bg-slate-950/50" onClick={skip} aria-hidden="true" />

      {/* Spotlight cutout: transparent box with a giant box-shadow draws a
          "hole" in the scrim. Sits 6px outside the target so the ring
          (visible at the outline) is clearly the target, not the cutout. */}
      {!centered && rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-white/80"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.5)",
          }}
        />
      ) : null}

      <div
        ref={popoverRef}
        style={popoverStyle}
        className="absolute max-w-sm rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={`onb-${step.id}`} className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {step.title}
          </h2>
          <button
            type="button"
            onClick={skip}
            aria-label="Skip tour"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.body}</p>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {index + 1} / {STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={last ? complete : next}
              className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {last ? (
                <>
                  Done
                  <Check className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
