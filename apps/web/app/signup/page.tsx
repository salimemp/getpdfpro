import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a free GetPDFPro account.",
  alternates: { canonical: "/signup" },
  robots: { index: false, follow: false },
};

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
              <Suspense fallback={null}>
                <AuthForm mode="signup" />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
