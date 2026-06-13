/**
 * Tutorial step registry.
 *
 * Each step is declarative: an id, where it lives, what it points at,
 * and what it says. The provider (`OnboardingProvider.tsx`) walks this
 * list in order. Steps are navigation-aware — if a step's `path` does
 * not match the current URL, the provider navigates before showing it.
 *
 * Keep copy short. The popover card has limited width.
 */

export type Placement = "top" | "bottom" | "left" | "right" | "center";

export type Step = {
  /** Unique stable id. Used as React key and in the `data-onboarding-target`
   * attribute on the element being highlighted. */
  id: string;
  /** Pathname where this step should be shown. If the user is elsewhere,
   * the provider navigates here before the spotlight appears. */
  path: `/${string}` | "/";
  /** CSS selector for the element to spotlight. Omit for modal-style
   * "center" steps (welcome/finish). The selector must be unique on the
   * page; the provider picks the first match. */
  targetSelector?: string;
  /** Where the popover sits relative to the spotlight. "center" means
   * the spotlight is skipped and the popover is a centered modal. */
  placement: Placement;
  title: string;
  body: string;
};

export const STEPS: Step[] = [
  {
    id: "welcome",
    path: "/",
    placement: "center",
    title: "Welcome to GetPDFPro",
    body: "Let's take a 60-second tour. We'll show you the tools, a sample task, and where pricing lives — no signup required for the basics.",
  },
  {
    id: "tools-grid",
    path: "/tools",
    targetSelector: '[data-onboarding-target="tools-grid"]',
    placement: "top",
    title: "35+ tools, no signup required",
    body: "Merge, split, compress, convert, sign, edit — most run free without an account. Just open one and go.",
  },
  {
    id: "tool-merge",
    path: "/tools",
    targetSelector: '[data-onboarding-target="tool-merge"]',
    placement: "bottom",
    title: "Drop two PDFs, get one back",
    body: "Merge is a one-click example: drop files, get a result. Same shape for the other 30+ tools.",
  },
  {
    id: "pricing-cta",
    path: "/pricing",
    targetSelector: '[data-onboarding-target="pricing-cta"]',
    placement: "top",
    title: "Unlimited usage for $5.99/mo",
    body: "Free tier covers everyday work. Pro lifts the cap, adds 4 GB file size, AI features, and priority support — cancel any time.",
  },
  {
    id: "finish",
    path: "/",
    placement: "center",
    title: "You're set",
    body: "Hit any tool to start. You can replay this tour from the footer of any page.",
  },
];
