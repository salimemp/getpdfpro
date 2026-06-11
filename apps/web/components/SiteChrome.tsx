"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { FileText, User, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * Shared chrome for non-landing pages — header + footer.
 * The landing page (/) renders its own header so it can include a more
 * marketing-oriented hero. Tool pages inherit this.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="container-narrow flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <span>GetPDFPro</span>
        </Link>
        <nav className="hidden gap-6 text-sm text-slate-600 sm:flex dark:text-slate-300">
          <Link href="/tools" className="hover:text-slate-900 dark:hover:text-white">
            Tools
          </Link>
          <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">
            Pricing
          </Link>
          <Link href="/beta" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900">
            Beta
          </Link>
          <Link href="/vs/ilovepdf" className="hover:text-slate-900 dark:hover:text-white">
            vs iLovePDF
          </Link>
        </nav>
        <AuthButton />
      </div>
    </header>
  );
}

function AuthButton() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Loading state — show a placeholder
  if (auth.loading) {
    return (
      <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
    );
  }

  // Signed out
  if (!auth.user) {
    return (
      <Link
        href="/login"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Sign in
      </Link>
    );
  }

  // Signed in — avatar with dropdown
  const email = auth.user.email || "";
  const name =
    (auth.user.user_metadata?.full_name as string | undefined) ||
    email.split("@")[0] ||
    "Account";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
          {initials || <User className="h-3.5 w-3.5" />}
        </span>
        <span className="hidden sm:inline">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {email}
            </p>
          </div>
          <Link
            href="/account"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4" />
            Account
          </Link>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await auth.signOut();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-200 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 py-12 dark:border-slate-800">
      <div className="container-narrow">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-600 text-white">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <span>© {new Date().getFullYear()} GetPDFPro</span>
          </div>
          <nav className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-slate-900 dark:hover:text-white">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
