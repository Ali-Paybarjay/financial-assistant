import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TransactionRow } from "@/lib/supabase/database.types";

/**
 * Every read of transactions goes through this module. Soft-deleted rows are
 * excluded here and nowhere else, so no caller can forget the filter and
 * silently show deleted money.
 */

export type TransactionFilters = {
  from?: string;
  to?: string;
  categoryIds?: string[];
  /** Matches either leg: a transfer belongs to both accounts it names. */
  accountIds?: string[];
  type?: "expense" | "income" | "transfer";
  query?: string;
  unconfirmedOnly?: boolean;
  limit?: number;
};

export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  const supabase = await createClient();

  let request = supabase
    .from("transactions")
    .select("*")
    .is("deleted_at", null)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.from) request = request.gte("occurred_on", filters.from);
  if (filters.to) request = request.lte("occurred_on", filters.to);
  if (filters.type) request = request.eq("type", filters.type);
  if (filters.unconfirmedOnly) request = request.eq("is_confirmed", false);
  if (filters.categoryIds?.length) request = request.in("category_id", filters.categoryIds);
  if (filters.accountIds?.length) {
    // A transfer names two accounts and shows up under both, so filtering by
    // account has to look at the arriving leg as well as the leaving one.
    const list = `(${filters.accountIds.join(",")})`;
    request = request.or(`account_id.in.${list},to_account_id.in.${list}`);
  }
  if (filters.query) {
    const escaped = filters.query.replace(/[%,]/g, " ").trim();
    if (escaped) {
      request = request.or(`merchant.ilike.%${escaped}%,note.ilike.%${escaped}%`);
    }
  }
  if (filters.limit) request = request.limit(filters.limit);

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export type MonthTotals = {
  income: number;
  expense: number;
  unconfirmedCount: number;
  byCategory: Map<string | null, number>;
};

/**
 * Money moving between the user's own accounts is not income and not a spend.
 * Counting it as either is the one way this feature could quietly ruin the
 * number the whole product is judged on, so the exclusion lives here — in the
 * two functions every total is built from — rather than at each call site.
 */
function isSpendOrEarn(row: TransactionRow): boolean {
  return row.type === "expense" || row.type === "income";
}

export type MonthPoint = {
  month: string;
  income: number;
  expense: number;
  /**
   * Rows the user actually recorded, as opposed to ones the app generated
   * from a fixed bill. A month whose only entries are generated is a month
   * nobody kept books in, and «what a typical month leaves over» must not be
   * read from it — see observedSurplus.
   */
  logged: number;
};

/**
 * Income and expense per month across a window, in one query. Grouping happens
 * here rather than in six round trips.
 */
export async function monthlySeries(
  from: string,
  to: string,
): Promise<Map<string, MonthPoint>> {
  const rows = await listTransactions({ from, to });
  const series = new Map<string, MonthPoint>();

  for (const row of rows) {
    if (!isSpendOrEarn(row)) continue;
    const key = `${row.occurred_on.slice(0, 7)}-01`;
    const point = series.get(key) ?? { month: key, income: 0, expense: 0, logged: 0 };
    if (row.type === "income") point.income += row.amount;
    else point.expense += row.amount;
    if (row.source !== "recurring") point.logged += 1;
    series.set(key, point);
  }

  return series;
}

/** One pass over the month, so the KPI cards and the donut cannot disagree. */
export async function monthTotals(from: string, to: string): Promise<MonthTotals> {
  const rows = await listTransactions({ from, to });

  const totals: MonthTotals = {
    income: 0,
    expense: 0,
    unconfirmedCount: 0,
    byCategory: new Map(),
  };

  for (const row of rows) {
    if (!isSpendOrEarn(row)) continue;
    if (row.type === "income") {
      totals.income += row.amount;
      continue;
    }
    totals.expense += row.amount;
    if (!row.is_confirmed) totals.unconfirmedCount += 1;
    totals.byCategory.set(
      row.category_id,
      (totals.byCategory.get(row.category_id) ?? 0) + row.amount,
    );
  }

  return totals;
}
