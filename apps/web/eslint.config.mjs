// Minimal ESLint flat config so `next lint` works in this project.
//
// History: the repo previously had no ESLint config and `next lint`
// was prompting interactively in Next 15.5+. This file gives the lint
// script a working baseline. Pre-existing lint findings (e.g. several
// `any` types in older components) are reported as warnings rather
// than errors so the build isn't blocked on tech debt that is out of
// scope for the change at hand. The pricing-sweep PRs that touch
// `app/**` and `lib/blog.ts` produce zero new findings.
//
// Warning budget
// --------------
// `next lint` is invoked with `--max-warnings 25` (see package.json:
// `"lint": "next lint --max-warnings 25"`). CI fails when the warning
// count exceeds 25. Why 25?
//   - Current baseline is ~35 warnings (verified on main at the
//     release-readiness audit, commit dae9f9f). 25 is intentionally
//     a touch stricter than today's count so the next engineer who
//     cleans up an unused import or tightens a `useMemo` dep array
//     gets a green build, and the budget ratchets down naturally
//     as tech debt is paid off.
//   - A small headroom (a single PR is unlikely to add more than
//     a handful of warnings) keeps the budget from being
//     perpetually red while still being a real gate.
//   - When the count is consistently <25, lower the budget in
//     this file's companion comment AND in package.json.
//
// Once the warning count crosses below 25 and stays there, lower
// both numbers in lockstep.
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "tsconfig.tsbuildinfo"],
  },
  {
    // Demote rules that trip up pre-existing code in the repo to
    // warnings. They're still surfaced by `npm run lint`, just not
    // build-blocking. New code should still aim to satisfy them.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
