"use client";

/**
 * /signup — the marketing page that hosts the <AuthForm> in signup mode.
 *
 * Wraps the existing form in a small client component so we can show a
 * one-time "Add a passkey" prompt to freshly-signed-up users. The
 * prompt is dismissible and only appears after a successful signup
 * (when the user is logged in but has no enrolled passkeys yet).
 */
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/lib/auth";
import { listFactors, registerPasskey } from "@/lib/auth-mfa";
import { Loader2, KeyRound, X, ShieldCheck } from "lucide-react";

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <div className="container-narrow flex justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="text-center text-3xl font-bold tracking-tight">
              Create your account
            </h1>
            <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
              Free forever. 50 tasks per day. No credit card.
            </p>
            <div className="mt-8">
              <AuthForm mode="signup" />
            </div>
          </div>
        </div>
        <SignupPasskeyPrompt />
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * Dismissible banner that appears after a successful signup. It
 * suggests registering a passkey but never forces the user — clicking
 * the dismiss icon (or completing the registration) hides it. We
 * store the dismissed flag in localStorage so the prompt never
 * returns for the same browser.
 */
function SignupPasskeyPrompt() {
  const auth = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const DISMISSED_KEY = "getpdfpro.signup.passkey-prompt.dismissed.v1";

  useEffect(() => {
    // Only show after the user is signed in AND has no passkeys AND
    // hasn't dismissed the banner before.
    if (auth.loading) return;
    if (!auth.user) {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") {
      setVisible(false);
      return;
    }
    startTransition(async () => {
      try {
        const factors = await listFactors();
        if (factors.webauthn.length === 0) {
          setVisible(true);
        }
      } catch {
        // Don't block on a failed factors read; the user can still
        // enroll from /settings/security later.
      }
    });
  }, [auth.loading, auth.user]);

  if (!visible) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    }
    setVisible(false);
  };

  const onAdd = () => {
    setBusy(true);
    startTransition(async () => {
      try {
        await registerPasskey("My passkey");
        dismiss();
      } catch {
        // The passkey dialog failed (user cancelled or browser
        // doesn't support it). Keep the banner visible so they can
        // try again or dismiss manually.
        setBusy(false);
      }
    });
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      data-testid="signup-passkey-prompt"
      className="container-narrow mt-8"
    >
      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950/40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-brand-900 dark:text-brand-100">
            Skip passwords next time — add a passkey.
          </p>
          <p className="mt-1 text-xs text-brand-800 dark:text-brand-200">
            Use Touch ID, Face ID, Windows Hello, or a security key to
            sign in. Takes about 5 seconds.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAdd}
              disabled={busy}
              data-testid="signup-passkey-add"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Add a passkey
            </button>
            <Link
              href="/settings/security"
              className="inline-flex items-center rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:bg-slate-900 dark:text-brand-200 dark:hover:bg-slate-800"
            >
              Maybe later
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          data-testid="signup-passkey-dismiss"
          className="rounded p-1 text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
