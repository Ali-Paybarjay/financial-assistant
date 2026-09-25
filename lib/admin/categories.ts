/**
 * The system category slugs the code names as string literals.
 *
 * Renaming one of these is a rename in Persian and perfectly safe; deleting one
 * is a crash. They are referenced by name from:
 *
 *   * lib/onboarding/config.ts — the recurring bill suggestions («housing»,
 *     «utilities», «transport») and the five variable baselines
 *   * app/(app)/dashboard/page.tsx — the three the budget invitation opens with
 *   * lib/import/normalise.ts — the fallbacks a statement row lands in when the
 *     model cannot place it («misc», «other-income»)
 *   * lib/ai/prompts.ts — «dong» and «dong-refund», kept out of what the model
 *     is allowed to choose
 *   * migration 0017 — the trigger that mirrors a trip expense into the personal
 *     ledger looks «dong» up by slug
 *
 * A plain module rather than part of lib/admin/actions.ts: that file is
 * "use server", and such a file may only export async functions — exporting this
 * array from it fails the build with «a "use server" file can only export async
 * functions, found object».
 */
export const PROTECTED_SLUGS = [
  "groceries",
  "dining",
  "transport",
  "housing",
  "utilities",
  "entertainment",
  "clothing",
  "salary",
  "misc",
  "other-income",
  "dong",
  "dong-refund",
] as const;

export function isProtectedSlug(slug: string): boolean {
  return (PROTECTED_SLUGS as readonly string[]).includes(slug);
}
