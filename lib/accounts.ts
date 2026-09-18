import { monthRange, monthsBetween, todayInTimeZone, type IsoDate } from "@/lib/date";
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

/* --------------------------------------------- checking against the bank -- */

/**
 * Where an account stands on being checked against its statement.
 *
 * The product asks for this once a month, at the start of the month, because
 * that is when banks publish a statement and when the user has one to upload.
 * So "done" means done *since this month began* — not "done within thirty
 * days", which would drift a little later every month until the reminder and
 * the statement stopped lining up.
 */
export type ReconcileState = {
  /** Not yet checked against the bank since this month started. */
  due: boolean;
  /** Whole months since the last check; null if it has never been checked. */
  monthsBehind: number | null;
};

/**
 * `timeZone` is not decoration: last_reconciled_at is an instant, and an
 * account checked at 1am on the first of the month in Tehran was checked in
 * the previous month in UTC. Comparing the instant in the user's own zone is
 * what stops the reminder reappearing the moment it is answered.
 */
export function reconcileState(
  account: Pick<AccountRow, "last_reconciled_at" | "opening_balance_on">,
  today: IsoDate,
  timeZone: string,
): ReconcileState {
  const monthStart = monthRange(timeZone, today).from;

  if (!account.last_reconciled_at) {
    // Never checked. How overdue that is counts from the day the account was
    // opened — an account added this morning is not behind on anything.
    return {
      due: account.opening_balance_on < monthStart,
      monthsBehind: null,
    };
  }

  const checkedOn = todayInTimeZone(timeZone, new Date(account.last_reconciled_at));

  return {
    due: checkedOn < monthStart,
    monthsBehind: wholeMonthsBetween(checkedOn, today),
  };
}

/** Calendar months apart, not thirty-day blocks. Never negative. */
function wholeMonthsBetween(from: IsoDate, to: IsoDate): number {
  return Math.max(0, monthsBetween(from, to));
}

/** The open accounts the user is being asked to go and update. */
export function accountsDue<T extends AccountRow>(
  accounts: readonly T[],
  today: IsoDate,
  timeZone: string,
): T[] {
  return accounts.filter(
    (account) => account.is_active && reconcileState(account, today, timeZone).due,
  );
}
