"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { useAuth } from "@/lib/auth";
import { Loader2, User, LogOut, Sparkles, FileText } from "lucide-react";
import { useQuota } from "@/lib/quota";

export default function AccountPage() {
  const router = useRouter();
  const auth = useAuth();
  const quota = useQuota();

  // If not signed in, send to /login
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.replace("/login?next=/account");
    }
  }, [auth.loading, auth.user, router]);

  if (auth.loading || !auth.user) {
    return (
      <>
        <SiteHeader />
        <main className="container-narrow flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </main>
        <SiteFooter />
      </>
    );
  }

  const email = auth.user.email || "";
  const name =
    (auth.user.user_metadata?.full_name as string | undefined) ||
    email.split("@")[0] ||
    "there";
  const createdAt = auth.user.created_at
    ? new Date(auth.user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <>
      <SiteHeader />
      <main>
        <div className="container-narrow py-12">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome, {name}.
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Your account, plan, and recent activity.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {/* Account card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <User className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">Account</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {email}
                  </p>
                </div>
              </div>
              {createdAt && (
                <p className="mt-3 text-xs text-slate-500">
                  Member since {createdAt}
                </p>
              )}
              <button
                type="button"
                onClick={async () => {
                  await auth.signOut();
                  router.push("/");
                }}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>

            {/* Plan card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">
                    Plan: {quota.tier === "pro" ? "Pro" : "Free"}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {quota.limit.toLocaleString()} tasks per day
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Used today
                  </span>
                  <span className="font-medium">
                    {quota.used} / {quota.limit}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-brand-600 transition-all"
                    style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Resets daily. Pro gives 1,000 tasks/day + 4 GB files + AI.
                </p>
              </div>
              {quota.tier !== "pro" ? (
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Upgrade to Pro — from $4.49/mo
                </Link>
              ) : (
                <p className="mt-4 text-xs text-green-700 dark:text-green-300">
                  ✨ You&apos;re on Pro. Thanks for supporting us.
                </p>
              )}
            </div>
          </div>

          {/* Recent tools */}
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Jump back in</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Link
                href="/tools/merge"
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="mt-3 font-medium">Merge PDF</p>
                <p className="mt-1 text-xs text-slate-500">
                  Combine PDFs in any order
                </p>
              </Link>
              <Link
                href="/tools/split"
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="mt-3 font-medium">Split PDF</p>
                <p className="mt-1 text-xs text-slate-500">
                  Extract pages or split by ranges
                </p>
              </Link>
              <Link
                href="/tools/compress"
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="mt-3 font-medium">Compress PDF</p>
                <p className="mt-1 text-xs text-slate-500">
                  Shrink with smart quality preservation
                </p>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
