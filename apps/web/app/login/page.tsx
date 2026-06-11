import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your GetPDFPro account.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <div className="container-narrow flex justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="text-center text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
              Sign in to continue using GetPDFPro.
            </p>
            <div className="mt-8">
              <Suspense fallback={null}>
                <AuthForm mode="login" />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
