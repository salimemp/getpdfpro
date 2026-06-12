/**
 * "Skip to main content" link — a WCAG 2.1 AA accessibility best
 * practice. Renders a link that's invisible by default but becomes
 * visible on focus. Lets keyboard / screen-reader users jump past
 * the navigation chrome straight to the page content.
 *
 * Usage: place <SkipNav /> at the top of <body>, and give your main
 * content a stable id (we use `id="main"` everywhere — see the
 * /tools/* pages and /vs/* pages).
 */
export function SkipNav({ targetId = "main" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="
        sr-only focus:not-sr-only
        fixed top-2 left-2 z-50
        rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-lg
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
      "
    >
      Skip to main content
    </a>
  );
}
