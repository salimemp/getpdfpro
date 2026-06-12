"use client";

/**
 * Theme provider — 3-mode theme (light / dark / system).
 *
 * - In system mode, the actual applied class follows the OS
 *   preference via matchMedia('prefers-color-scheme: dark').
 * - The user's selection is stored in localStorage as 'theme' =
 *   'light' | 'dark' | 'system' (default 'system' on first visit).
 * - We set the class on <html> in a useLayoutEffect so the page
 *   never flashes the wrong theme. The html element also has
 *   suppressHydrationWarning so React doesn't complain about the
 *   server-rendered vs client-hydrated class mismatch.
 *
 * Theme is a v1 localStorage-only preference. When we add a
 * Supabase user-prefs endpoint, this hook reads from there for
 * signed-in users and falls back to localStorage.
 */

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "getpdfpro:theme";

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage may throw in private mode / disabled cookies
  }
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved: ResolvedTheme = mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  // Helpful for screenshot-style browsers + a11y tools
  root.style.colorScheme = resolved;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  cycle: () => void; // light → dark → system → light
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start with 'system' on first render (matches the
  // server-rendered HTML, which has no theme class). Then on
  // hydration we read localStorage and apply the user's choice.
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // useLayoutEffect runs before paint, so the theme class is
  // set before the first frame. This eliminates the flash-of-wrong-
  // theme that happens with useEffect.
  useLayoutEffect(() => {
    const initial = readStoredTheme();
    setModeState(initial);
    const r: ResolvedTheme = initial === "system" ? (systemPrefersDark() ? "dark" : "light") : initial;
    setResolved(r);
    applyTheme(initial);
  }, []);

  // Track system preference changes when in 'system' mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolved(r);
      applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    const r: ResolvedTheme = next === "system" ? (systemPrefersDark() ? "dark" : "light") : next;
    setResolved(r);
    applyTheme(next);
  };

  // Light → dark → system → light. Used by the icon button.
  const cycle = () => {
    const order: ThemeMode[] = ["light", "dark", "system"];
    const idx = order.indexOf(mode);
    setMode(order[(idx + 1) % order.length]);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, cycle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe default for components rendered outside the provider
    // (e.g. during static generation). Real provider is in
    // app/layout.tsx so this should never happen at runtime.
    return {
      mode: "system",
      resolved: "light",
      setMode: () => {},
      cycle: () => {},
    };
  }
  return ctx;
}
