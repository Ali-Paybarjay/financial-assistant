import { epochDay, type IsoDate } from "@/lib/date";
import type { Minor } from "@/lib/money";
import type {
  StatementDirection,
  TransactionType,
} from "@/lib/supabase/database.types";

/**
 * Deciding which rows of a bank statement are already in the ledger.
 *
 * This is arithmetic, not judgement, so it is done here and never asked of a
 * model. A model asked "is this a duplicate?" gives a different answer on a
 * second run over the same file, and the one thing this feature must never do
 * is count the same money twice on Tuesday and not on Wednesday.
 *
 * Re-uploading a statement that was already imported needs no special case:
 * the rows it added are in the ledger now, so the same rule that recognises
 * anything else recognises them.
 */

export type ReconcilableLine = {
  rowIndex: number;
  occurredOn: IsoDate;
  direction: StatementDirection;
  amount: Minor;
};

/** A transaction already in the ledger, as far as matching is concerned. */
export type LedgerEntry = {
  id: string;
  type: TransactionType;
  amount: Minor;
  occurredOn: IsoDate;
  /** Null where the money moved without touching a tracked account. */
  accountId?: string | null;
};

export type LineMatch = { transactionId: string; dayGap: number };

export type ReconcileResult = {
  rowIndex: number;
  match: LineMatch | null;
};

/**
 * How far a statement's date may sit from the ledger's and still be the same
 * money. A card purchase made on Friday posts to the account on Monday, so
 * three days is the shortest window that survives a weekend.
 */
export const MATCH_WINDOW_DAYS = 3;

export function directionToType(direction: StatementDirection): TransactionType {
  return direction === "in" ? "income" : "expense";
}

export function typeToDirection(type: TransactionType): StatementDirection {
  return type === "income" ? "in" : "out";
}

type Candidate = { id: string; day: number };

/**
 * Match statement lines against the ledger.
 *
 * Amount and direction must agree exactly; only the date is allowed to drift,
 * by at most `windowDays`. Descriptions are deliberately ignored: a bank
 * writes "POS-472913 HYPERSTAR", the user wrote «خرید», and requiring those to
 * agree would report money that is already recorded as new — which is how a
 * ledger ends up double-counting.
 *
 * Matching is one-to-one. Three identical coffees on the statement against one
 * in the ledger leaves two unmatched, which is the right answer.
 *
 * Passes run from an exact date outwards, so a line that agrees to the day
 * cannot lose its transaction to an earlier line that was three days off.
 */
export function reconcile(
  lines: readonly ReconcilableLine[],
  ledger: readonly LedgerEntry[],
  windowDays: number = MATCH_WINDOW_DAYS,
): ReconcileResult[] {
  const buckets = new Map<string, Candidate[]>();

  for (const entry of ledger) {
    const key = bucketKey(entry.type, entry.amount);
    const bucket = buckets.get(key) ?? [];
    bucket.push({ id: entry.id, day: epochDay(entry.occurredOn) });
    buckets.set(key, bucket);
  }

  // Earliest first, so an equal-distance tie resolves the same way every run.
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.day - b.day || (a.id < b.id ? -1 : 1));
  }

  const consumed = new Set<string>();
  const matches = new Map<number, LineMatch>();

  const pending = [...lines].sort((a, b) => a.rowIndex - b.rowIndex);

  for (let gap = 0; gap <= windowDays; gap += 1) {
    for (const line of pending) {
      if (matches.has(line.rowIndex)) continue;

      const bucket = buckets.get(bucketKey(directionToType(line.direction), line.amount));
      if (!bucket) continue;

      const lineDay = epochDay(line.occurredOn);
      const candidate = bucket.find(
        (entry) => !consumed.has(entry.id) && Math.abs(entry.day - lineDay) === gap,
      );

      if (candidate) {
        consumed.add(candidate.id);
        matches.set(line.rowIndex, { transactionId: candidate.id, dayGap: gap });
      }
    }
  }

  return lines.map((line) => ({
    rowIndex: line.rowIndex,
    match: matches.get(line.rowIndex) ?? null,
  }));
}

function bucketKey(type: TransactionType, amount: Minor): string {
  return `${type}:${amount}`;
}

/**
 * Narrow the ledger to what a statement of one account could possibly be
 * about.
 *
 * A transaction posted to a *different* account is not this statement's row,
 * however well the amount and date line up — two cards paying the same
 * subscription on the same day is the ordinary case, not a freak one, and
 * matching across them would report one of the two as already recorded and
 * quietly lose it.
 *
 * A transaction with no account stays in: it is money the user logged before
 * they had accounts, or logged without saying where from, and it is exactly
 * the row the statement is most likely to be the other half of.
 *
 * An import with no account of its own matches against everything, which is
 * what every import made before this feature existed did.
 */
export function ledgerForAccount(
  ledger: readonly LedgerEntry[],
  accountId: string | null,
): LedgerEntry[] {
  if (!accountId) return [...ledger];
  return ledger.filter((entry) => !entry.accountId || entry.accountId === accountId);
}

export type ReconcileSummary = {
  total: number;
  matched: number;
  fresh: number;
  /** Sums over the unmatched rows only — what importing would actually add. */
  freshIncome: Minor;
  freshExpense: Minor;
};

export function summarise(
  lines: readonly ReconcilableLine[],
  results: readonly ReconcileResult[],
): ReconcileSummary {
  const matchedRows = new Set(
    results.filter((result) => result.match).map((result) => result.rowIndex),
  );

  const summary: ReconcileSummary = {
    total: lines.length,
    matched: matchedRows.size,
    fresh: lines.length - matchedRows.size,
    freshIncome: 0,
    freshExpense: 0,
  };

  for (const line of lines) {
    if (matchedRows.has(line.rowIndex)) continue;
    if (line.direction === "in") summary.freshIncome += line.amount;
    else summary.freshExpense += line.amount;
  }

  return summary;
}
