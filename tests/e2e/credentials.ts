import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The two fixture accounts every e2e spec signs in as, and the one password
 * they share.
 *
 * The password used to be a literal string here, copied into fifteen spec
 * files: `process.env.E2E_PASSWORD ?? "test-pass-12345"`. That is exactly
 * where a hardcoded secret is most dangerous — not because anyone meant to
 * commit it, but because a fallback default is invisible right up until the
 * repository it lives in stops being private. It cannot be fixed by editing
 * one file; it has to not exist in the source at all, which is what this
 * module is for.
 *
 * Emails keep their defaults. They name which fixture account a test wants —
 * alpha or beta — not a secret, and there is nothing to protect by hiding
 * strings that already appear throughout this repo's own commit messages.
 */

export const ALPHA_EMAIL = process.env.E2E_EMAIL ?? "alpha@testmail.dev";
export const BETA_EMAIL = process.env.E2E_ONBOARDING_EMAIL ?? "beta@testmail.dev";

/**
 * Playwright, unlike the Next.js dev server, does not load `.env.local` on
 * its own — a value set only there is invisible to `process.env` here unless
 * something reads the file itself. Shared with `isolation.spec.ts` and
 * `recurring.spec.ts`, which needed the same fallback for their own Supabase
 * credentials; one reader rather than three copies of the same eleven lines.
 */
export function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const line = file.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim() || undefined;
  } catch {
    return undefined;
  }
}

function requiredPassword(): string {
  const value = readEnv("E2E_PASSWORD");
  if (value) return value;
  throw new Error(
    "E2E_PASSWORD is not set. Add it to .env.local (see .env.example) — " +
      "it is never hardcoded here on purpose, because this repository is public.",
  );
}

/** Shared by both fixture accounts; rotate it in Supabase if it ever leaks. */
export const PASSWORD = requiredPassword();
