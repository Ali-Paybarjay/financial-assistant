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
    ignores: [
      "node_modules/**",
      // Any Next build directory, including the NEXT_DIST_DIR a parallel
      // dev server or build is given so it does not fight the default one.
      ".next*/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Vendored reference material from the design phase, not project source.
      // Both folders carry the design tool's own bundled runtime, which is
      // built output rather than anything written here.
      "design_handoff_financial_assistant/**",
      "design_handoff_v2/**",
      "design_handoff_v3/**",
      // Review evidence: the scripts that reproduced the findings in
      // audits/*/REPORT.md, kept so a fix can be checked against the thing it
      // fixes. They are throwaway harnesses written against the module graph
      // with CommonJS requires, not product source, and linting them as if
      // they were is how a real finding gets buried under eight style errors.
      "audits/**",
      // Playwright's own output, written by a run rather than by anyone.
      "test-results/**",
    ],
  },
];

export default eslintConfig;
