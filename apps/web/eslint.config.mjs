// Minimal ESLint flat config so `next lint` works in this project.
//
// History: the repo previously had no ESLint config and `next lint`
// was prompting interactively in Next 15.5+. This file gives the lint
// script a working baseline. Pre-existing lint findings (e.g. several
// `any` types in older components) are reported as warnings rather
// than errors so the build isn't blocked on tech debt that is out of
// scope for the change at hand. The pricing-sweep PRs that touch
// `app/**` and `lib/blog.ts` produce zero new findings.
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
