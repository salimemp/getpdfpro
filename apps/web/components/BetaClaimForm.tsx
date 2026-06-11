"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, Sparkles, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export function BetaClaimForm() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState(auth.user?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <p className="font-medium">Supabase isn&apos;t configured yet.</p>
        <p className="mt-1 text-amber-800 dark:text-amber-200">
          Once you finish the Supabase setup (see the C4 runbook), the
          beta form will work. Until then, drop me a line at{" "}
          <a
            className="font-medium underline"
            href="mailto:salim@getpdfpro.com"
          >
            salim@getpdfpro.com
          </a>{" "}
          and I&apos;ll add you to the beta manually.
        </p>
      </div>
    );
  }

  const onClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Enter your email first.");
      return;
    }

    setIsPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Auth not configured.");
        return;
      }

      // 1. Make sure the user has an account (sign them up or
      //    sign them in via magic link).
      // For simplicity: send a magic link so they don't need to
      // set a password. The link goes to /account, and on the
      // way there the claim logic kicks in.
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/account?beta=1`,
        },
      });
      if (otpErr) throw otpErr;

      setSuccess(
        "Check your email for a magic link. Click it to claim your beta spot."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsPending(false);
    }
  };

  // If already signed in, the claim is a single click
  if (auth.user) {
    return <AlreadySignedInClaim />;
  }

  return (
    <form onSubmit={onClaim} className="space-y-4">
      <div>
        <label
          htmlFor="beta-email"
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Your email
        </label>
        <div className="relative mt-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="beta-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          We&apos;ll email you a magic link to sign in. No password needed.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending magic link…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Claim my beta spot
          </>
        )}
      </button>
    </form>
  );
}

function AlreadySignedInClaim() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onClaim = async () => {
    setError(null);
    setSuccess(null);
    setIsPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Auth not configured.");
        return;
      }
      // Call the RPC that atomically claims a beta spot for this
      // user. The function returns 'claimed' (success), 'taken'
      // (all 100 spots used), or 'already_claimed' (this user
      // already has a spot).
      const { data, error: rpcErr } = await supabase.rpc("claim_beta_spot", {
        // No params for now; user is read from auth.uid() inside the function.
      });
      if (rpcErr) throw rpcErr;

      const result = data as string | null;
      if (result === "claimed") {
        // Refresh the auth session so user_metadata.plan = 'pro' takes effect
        await supabase.auth.refreshSession();
        setSuccess("Welcome to the beta! You're now Pro for 6 months.");
        // Give the user a moment to read the success, then send to /account
        setTimeout(() => router.push("/account"), 1500);
      } else if (result === "already_claimed") {
        setSuccess("You've already claimed your beta spot. Enjoy Pro!");
        setTimeout(() => router.push("/account"), 1500);
      } else if (result === "taken") {
        setError(
          "All 100 beta spots have been claimed. But the free tier is still generous — 50 tasks/day!"
        );
      } else {
        setError(`Unexpected response: ${String(result)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        You&apos;re signed in. One click to claim your beta spot.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onClaim}
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Claiming…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Claim my beta spot
          </>
        )}
      </button>
    </div>
  );
}
