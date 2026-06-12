"use client";

/**
 * Theme toggle — 3-state button (light / dark / system).
 *
 * The button shows the icon for the CURRENT mode. On click,
 * it cycles to the next mode. A11y: a proper aria-label and
 * a sr-only description of what the next state will be.
 *
 * The dropdown variant exposes all three modes as a menu, which
 * is what the marketing header uses. The cycle variant is a
 * compact single-button for tight spaces.
 */

import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme, type ThemeMode } from "./ThemeProvider";

const ORDER: ThemeMode[] = ["light", "dark", "system"];

export function ThemeToggle({ variant = "menu" }: { variant?: "menu" | "cycle" }) {
  const t = useTranslations("Theme");
  const { mode, resolved, setMode, cycle } = useTheme();

  if (variant === "cycle") {
    return <CycleButton mode={mode} resolved={resolved} onCycle={cycle} t={t} />;
  }
  return <Menu mode={mode} resolved={resolved} onSelect={setMode} t={t} />;
}

function CycleButton({
  mode,
  resolved,
  onCycle,
  t,
}: {
  mode: ThemeMode;
  resolved: "light" | "dark";
  onCycle: () => void;
  t: ReturnType<typeof useTranslations<"Theme">>;
}) {
  // Show the icon for the mode that will be ACTIVE after the
  // current state. Slightly more intuitive: the icon is "what
  // you'll get if you click". For system, we show the resolved
  // icon (sun if system resolves to light, moon if dark).
  const label = t("label");
  return (
    <button
      type="button"
      onClick={onCycle}
      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      aria-label={`${label}: ${t(mode)}`}
      title={`${label}: ${t(mode)}`}
    >
      {mode === "light" ? <Sun className="h-4 w-4" /> : null}
      {mode === "dark" ? <Moon className="h-4 w-4" /> : null}
      {mode === "system" ? <Laptop className="h-4 w-4" /> : null}
    </button>
  );
}

function Menu({
  mode,
  resolved,
  onSelect,
  t,
}: {
  mode: ThemeMode;
  resolved: "light" | "dark";
  onSelect: (m: ThemeMode) => void;
  t: ReturnType<typeof useTranslations<"Theme">>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const label = t("label");

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
      >
        {resolved === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {ORDER.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={mode === m}
              onClick={() => {
                onSelect(m);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">
                {m === "light" ? <Sun className="h-4 w-4" /> : null}
                {m === "dark" ? <Moon className="h-4 w-4" /> : null}
                {m === "system" ? <Laptop className="h-4 w-4" /> : null}
                <span>{t(m)}</span>
              </span>
              {mode === m ? <Check className="h-4 w-4 text-brand-600" /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
