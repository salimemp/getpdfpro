"use client";

/**
 * PasswordInput — the canonical password field for GetPDFPro.
 *
 * Features (signup mode):
 *   - Strength meter (4 levels: weak / fair / strong / excellent)
 *   - Live rule indicators (8+ chars, letter, number, special)
 *   - HaveIBeenPwned breach check (debounced 600ms, only when strong)
 *   - Visibility toggle (eye icon)
 *   - Blocks submit when rules don't pass or password is breached
 *
 * Login mode (mode="login") shows only the input + visibility toggle;
 * we don't enforce new-password rules when signing in to an existing
 * account (the password was already accepted at signup).
 *
 * Design references: Slack's signup form, 1Password's strength bar,
 * GitHub's "password is in a public breach" warning.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Check, X, Loader2, ShieldAlert } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

// ─── Rule definitions ─────────────────────────────────────────
// Visible as a checklist under the input. Each rule has a stable id
// so consumers (and tests) can target specific ones.

export type PasswordRuleId = "length" | "letter" | "number" | "special";

export const PASSWORD_RULES: { id: PasswordRuleId; label: string; test: (p: string) => boolean }[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p) => p.length >= 8,
  },
  {
    id: "letter",
    label: "At least 1 letter",
    test: (p) => /[A-Za-z]/.test(p),
  },
  {
    id: "number",
    label: "At least 1 number",
    test: (p) => /\d/.test(p),
  },
  {
    id: "special",
    label: "At least 1 special character",
    test: (p) => /[!@#$%^&*()_+\-=\[\]{}|;:'"`\\,.<>?/~]/.test(p),
  },
];

// ─── Strength meter ────────────────────────────────────────────
// 0 rules = red, 1-2 = orange, 3 = yellow, 4 = green.

type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

function scorePassword(p: string): {
  score: number;
  level: StrengthLevel;
  pct: number;
  color: string;
  label: string;
} {
  if (!p) {
    // Empty placeholder state — all gray segments, neutral label
    return { score: 0, level: "empty", pct: 0, color: "bg-slate-200 dark:bg-slate-800", label: "Type to start" };
  }
  const score = PASSWORD_RULES.filter((r) => r.test(p)).length;
  switch (score) {
    case 1:
      return { score, level: "weak", pct: 25, color: "bg-red-500", label: "Weak" };
    case 2:
      return { score, level: "fair", pct: 50, color: "bg-orange-500", label: "Fair" };
    case 3:
      return { score, level: "good", pct: 75, color: "bg-yellow-500", label: "Good" };
    case 4:
      return { score, level: "strong", pct: 100, color: "bg-emerald-500", label: "Strong" };
    default:
      return { score: 0, level: "empty", pct: 0, color: "bg-red-500", label: "Too weak" };
  }
}

// ─── Breach check ─────────────────────────────────────────────
// Debounced server-side HIBP check. Only runs when the password
// already passes the local strength rules — saves a round-trip
// for obviously-weak inputs that we'll reject anyway.

type BreachStatus = "idle" | "checking" | "safe" | "breached" | "error";

async function checkBreached(password: string): Promise<boolean> {
  const res = await fetch(`${apiBaseUrl}/api/v1/auth/check-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    // Network error or 4xx — don't block the user. Treat as "unknown".
    throw new Error(`breach check failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    is_strong: boolean;
    is_breached: boolean;
    message?: string | null;
  };
  return data.is_breached;
}

// ─── Component ─────────────────────────────────────────────────

export interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** "login" suppresses strength meter + breach check + rule gating. */
  mode: "login" | "signup";
  /** Native input autoComplete hint. Defaults sensibly per mode. */
  autoComplete?: string;
  required?: boolean;
  /** Disables the input + clears any in-flight breach check. */
  disabled?: boolean;
  /** test id passthrough for E2E tests. */
  "data-testid"?: string;
  /** Aria-describedby of an external error to wire under the input. */
  "aria-describedby"?: string;
  /**
   * Notifies the parent whenever the HIBP breach status changes.
   * Only fires in signup mode. Lets the parent block submit when the
   * password is known-breached without needing to peek into the DOM.
   */
  onBreachStatusChange?: (status: BreachStatus) => void;
}

export function PasswordInput({
  id = "password",
  value,
  onChange,
  mode,
  autoComplete,
  required = true,
  disabled,
  "data-testid": testId,
  "aria-describedby": describedBy,
  onBreachStatusChange,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [breachStatus, setBreachStatus] = useState<BreachStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const strength = useMemo(() => scorePassword(value), [value]);
  const passedAllRules = strength.score === PASSWORD_RULES.length;

  // Surface breach status to the parent (used to block submit).
  // We track the last value we fired so we don't spam the callback.
  const lastFiredRef = useRef<BreachStatus>("idle");
  useEffect(() => {
    if (mode !== "signup") return;
    if (!onBreachStatusChange) return;
    if (lastFiredRef.current !== breachStatus) {
      lastFiredRef.current = breachStatus;
      onBreachStatusChange(breachStatus);
    }
  }, [breachStatus, mode, onBreachStatusChange]);

  // Debounced breach check — runs on BOTH login and signup modes.
  //
  // Gate conditions:
  //   - signup: wait for all 4 rules to pass (length / letter / number / special)
  //     so we don't waste calls on obviously-weak inputs that we'll reject
  //   - login: only wait for >= 6 chars (any real password is at least
  //     this long; below that, we're probably still typing). Existing
  //     passwords may not meet the new 8-char rule, so we can't gate on it.
  useEffect(() => {
    const minLength = mode === "signup" ? 8 : 6;
    const readyToCheck =
      value.length >= minLength &&
      (mode === "login" || passedAllRules);

    if (!readyToCheck) {
      setBreachStatus("idle");
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Cancel any in-flight check
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setBreachStatus("checking");
      checkBreached(value)
        .then((isBreached) => {
          if (!controller.signal.aborted) {
            setBreachStatus(isBreached ? "breached" : "safe");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setBreachStatus("error");
          }
        });
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, mode, passedAllRules]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // The strength meter and rule checklist only show on signup — login
  // is for existing users and showing 'Weak' on a password they can't
  // change from this screen is just noise.
  //
  // The HIBP breach check, however, ALWAYS runs. If the user is signing
  // in with a known-breached password, we surface a warning so they
  // can go to /account and change it. This applies to login too.
  const showMeter = mode === "signup";
  const showRules = mode === "signup";
  const showBreachWarning = breachStatus === "breached";

  return (
    <div className="space-y-2">
      {/* Input row */}
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={
            autoComplete ?? (mode === "login" ? "current-password" : "new-password")
          }
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={showBreachWarning ? true : undefined}
          data-testid={testId}
          minLength={mode === "signup" ? 8 : undefined}
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          data-testid={testId ? `${testId}-toggle` : undefined}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Strength meter — only on signup */}
      {showMeter && (
        <div
          className="flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => {
              const filled = strength.pct > i * 25;
              return (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    filled ? strength.color : "bg-slate-200 dark:bg-slate-800"
                  }`}
                />
              );
            })}
          </div>
          <span className="min-w-[3.5rem] text-right text-xs font-medium text-slate-600 dark:text-slate-400">
            {strength.label}
          </span>
        </div>
      )}

      {/* Rule checklist — only on signup, always visible so users see the rules upfront */}
      {showRules && (
        <ul
          className="space-y-1 text-xs"
          aria-label="Password requirements"
        >
          {PASSWORD_RULES.map((rule) => {
            const passed = rule.test(value);
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-1.5 ${
                  passed
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {passed ? (
                  <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                <span>{rule.label}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Breach warning — only on signup, when HIBP flags the password */}
      {showBreachWarning && (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">This password has been seen in data breaches.</p>
            <p className="mt-0.5 text-red-600 dark:text-red-300">
              Choose a different password — this one is on public lists used by attackers.
            </p>
          </div>
        </div>
      )}

      {/* Breach check status (subtle, only while checking or error) */}
      {mode === "signup" && breachStatus === "checking" && passedAllRules && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Checking against known breaches…
        </p>
      )}
    </div>
  );
}

/**
 * Helper used by AuthForm's submit handler to block submission when
 * the password is invalid for the current mode. Returns a user-facing
 * error message or null when the password is acceptable.
 */
export function passwordAcceptable(
  value: string,
  mode: "login" | "signup",
  breachStatus: BreachStatus,
): string | null {
  if (mode === "login") {
    // Login never enforces new-password rules on the existing value.
    return null;
  }
  // Signup — all rules must pass
  const missing = PASSWORD_RULES.filter((r) => !r.test(value));
  if (missing.length > 0) {
    return `Password needs: ${missing.map((r) => r.label.toLowerCase()).join(", ")}.`;
  }
  if (breachStatus === "breached") {
    return "This password has appeared in data breaches. Please choose a different one.";
  }
  // Don't block on "checking" — give it a beat to complete.
  return null;
}

export { type BreachStatus };
