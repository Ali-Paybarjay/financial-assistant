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
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Vendored reference material from the design phase, not project source.
      // Both folders carry the design tool's own bundled runtime, which is
      // built output rather than anything written here.
      "design_handoff_financial_assistant/**",
      "design_handoff_v2/**",
    ],
  },
];

export default eslintConfig;
