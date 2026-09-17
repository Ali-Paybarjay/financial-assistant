import type { AccountRow } from "@/lib/supabase/database.types";
import type { Minor } from "@/lib/money";

/**
 * What an account is, once its balance has been worked out, and the few rules
 * about accounts that are arithmetic rather than a query.
 *
 * Pure, so the client components that render balances and the tests that pin
 * these rules can both reach them; the reads themselves live in
 * lib/queries/accounts.ts behind server-only.
 */

export type AccountWithBalance = AccountRow & {
  /** opening_balance + everything posted to it on or after opening_balance_on. */
  balance: Minor;
  /** What the ledger has moved it by since that date. */
  movement: Minor;
  transactionCount: number;
  lastActivityOn: string | null;
};

/** Open accounts first, the default at the top of them, then the user's order. */
export function inDisplayOrder<T extends AccountRow>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      Number(b.is_default) - Number(a.is_default) ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at),
  );
}

/**
 * What an entry form should preselect: the account marked default, or the only
 * open one if there is exactly one. Never a guess between several, and never a
 * closed account — preselecting the wrong one is worse than preselecting none,
 * because the user has no reason to look at a field that is already filled.
 */
export function preferredAccountId(accounts: readonly AccountRow[]): string | null {
  const open = accounts.filter((account) => account.is_active);
  return (
    open.find((account) => account.is_default)?.id ??
    (open.length === 1 ? open[0].id : null)
  );
}

/** What the open accounts hold between them. A card's debt subtracts itself. */
export function totalBalance(accounts: readonly AccountWithBalance[]): Minor {
  return accounts
    .filter((account) => account.is_active)
    .reduce((total, account) => total + account.balance, 0);
}
