import Link from "next/link";
import { FileText } from "lucide-react";

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
          <Link href="/vs/ilovepdf" className="hover:text-slate-900 dark:hover:text-white">
            vs iLovePDF
          </Link>
          <Link href="/blog" className="hover:text-slate-900 dark:hover:text-white">
            Blog
          </Link>
        </nav>
        <Link
          href="/login"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Sign in
        </Link>
      </div>
    </header>
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
