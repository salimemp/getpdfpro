import type { BlogSection } from "@/lib/blog";

/**
 * Render a single blog section to JSX.
 *
 * Sections are typed (h2/h3/p/ul/ol/code/callout/table) so the data
 * layer stays clean and the layout is consistent. No freeform markdown.
 */
export function BlogSectionView({ section }: { section: BlogSection }) {
  switch (section.type) {
    case "h2":
      return (
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {section.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-8 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {section.text}
        </h3>
      );
    case "p":
      return (
        <p className="mt-4 leading-7 text-slate-700 dark:text-slate-300">
          {section.text}
        </p>
      );
    case "ul":
      return (
        <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
          {section.items.map((item, i) => (
            <li key={i} className="leading-7">
              {item}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-slate-700 dark:text-slate-300">
          {section.items.map((item, i) => (
            <li key={i} className="leading-7">
              {item}
            </li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100 dark:bg-slate-800">
          <code className={section.lang ? `language-${section.lang}` : undefined}>
            {section.code}
          </code>
        </pre>
      );
    case "callout": {
      const toneStyles =
        section.tone === "warning"
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          : section.tone === "tip"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200";
      return (
        <aside
          className={`mt-6 rounded-lg border-l-4 px-4 py-3 text-sm leading-6 ${toneStyles}`}
          role="note"
        >
          {section.text}
        </aside>
      );
    }
    case "table":
      return (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700 dark:text-slate-300">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                {section.headers.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-4 py-2 font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-slate-200 last:border-b-0 dark:border-slate-700"
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
