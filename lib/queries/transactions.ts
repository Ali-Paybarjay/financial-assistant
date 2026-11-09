import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TransactionRow } from "@/lib/supabase/database.types";
import {
  canConvert,
  convertMinor,
  isCurrencyCode,
  type CurrencyCode,
} from "@/lib/money";

/**
 * Every read of transactions goes through this module. Soft-deleted rows are
 * excluded here and nowhere else, so no caller can forget the filter and
 * silently show deleted money.
 *
 * Two other rules hold here, and both of them are corrections.
 *
 * **Nothing adds up a page of rows.** PostgREST answers with at most
 * `db.max_rows` rows — 1000 by default — and a response that hit the ceiling is
 * simply shorter, with no error and no flag. Every total in the product used to
 * be built by selecting the month into JavaScript and summing it, so a heavy
 * month was summed over whatever fitted. `monthTotals` and `monthlySeries` now
 * group in SQL (migration 0032), the ledger page pages, and a caller that
 * genuinely needs every row calls `listAllTransactions`, which says so in its
 * name and keeps asking until the rows run out. F10.
 *
 * **Nothing adds two currencies together.** A row carries the currency it was
 * recorded in, and this app has no exchange rate. Anything it cannot convert
 * exactly — which means the currency itself or its sibling unit — is left out of
 * the figure and named in `otherCurrencies`, for the caller to say out loud.
 * F01.
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

/**
 * How many rows a page of the ledger is.
 *
 * Under PostgREST's default ceiling by an order of magnitude, so a page is a
 * page because this module decided it was, not because the platform ran out.
 */
export const PAGE_SIZE = 100;

/**
 * A ceiling on `listAllTransactions`, so a runaway loop is a thrown error
 * rather than a request that never ends. Two hundred pages is twenty thousand
 * rows — several years of daily spending, and far more than any statement
 * period reconciles against.
 */
const MAX_PAGES = 200;

function build(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: TransactionFilters,
) {
  let request = supabase
    .from("transactions")
    .select("*")
    .is("deleted_at", null)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    // Tie-broken by the primary key, which the two columns above cannot do on
    // their own: two rows entered in the same millisecond have no stable order
    // between them, and an unstable order means a paged read can show one row
    // twice and another not at all.
    .order("id", { ascending: false });

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

  return request;
}

/**
 * One page of rows, newest first.
 *
 * `limit` is the caller saying how many it wants — «the ten most recent» on the
 * dashboard. Without one it returns a page, not the whole ledger: a function
 * that sometimes returns everything is a function whose callers sum it.
 */
export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const size = filters.limit ?? PAGE_SIZE;

  const { data, error } = await build(supabase, filters).range(0, size - 1);
  if (error) throw error;
  return data ?? [];
}

export type TransactionPage = {
  rows: TransactionRow[];
  page: number;
  /** Whether another page exists. Asked for one extra row, not by counting. */
  hasMore: boolean;
};

/**
 * A page of the ledger for the transactions screen.
 *
 * `hasMore` comes from fetching one row beyond the page and throwing it away,
 * which costs nothing and cannot disagree with the rows above it. An exact
 * `count` would be a second scan of the same window, and on a table being
 * written to it can disagree with the page it is meant to describe.
 */
export async function listTransactionPage(
  filters: TransactionFilters = {},
  page = 1,
): Promise<TransactionPage> {
  const supabase = await createClient();
  const current = Math.max(1, Math.floor(page));
  const from = (current - 1) * PAGE_SIZE;

  const { data, error } = await build(supabase, filters).range(from, from + PAGE_SIZE);
  if (error) throw error;

  const rows = data ?? [];
  return {
    rows: rows.slice(0, PAGE_SIZE),
    page: current,
    hasMore: rows.length > PAGE_SIZE,
  };
}

/**
 * Every matching row, by paging until they run out.
 *
 * For the two callers that cannot be wrong about the set: reconciliation, which
 * reports a row as new if it fails to find its match, and the budget suggestion,
 * which reads three months of spending. Both were single unpaginated selects,
 * so on a busy account they were deciding against a truncated ledger — and
 * reconciliation's failure mode is offering money the user has already recorded
 * as new money to import. F10.
 */
export async function listAllTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const all: TransactionRow[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(supabase, filters).range(
      from,
      from + PAGE_SIZE - 1,
    );
    if (error) throw error;

    const rows = data ?? [];
    all.push(...rows);
    // A short page is the last page. Asking again would cost a round trip to
    // be told the same thing.
    if (rows.length < PAGE_SIZE) return all;
  }

  throw new Error(
    `listAllTransactions stopped at ${MAX_PAGES * PAGE_SIZE} rows; narrow the range`,
  );
}

export type MonthTotals = {
  income: number;
  expense: number;
  unconfirmedCount: number;
  byCategory: Map<string | null, number>;
  /**
   * Currencies present in the window that could not be added to the total.
   *
   * Every total used to be a bare sum over `amount`, with the profile's current
   * currency printed beside it — so a month holding 100 CAD and 50 USD produced
   * «۱۵٬۰۰۰ تومان», a number that is not any amount of any money. Rows in a
   * currency this app has no rate for are now left out and named here, and
   * every screen that shows a total has to say so. F01.
   */
  otherCurrencies: CurrencyCode[];
};

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
 * What one grouped row is worth in the currency a total is being built in.
 *
 * Null when this app has no honest answer: `convertMinor` only crosses between
 * a currency and its sibling unit (rial into toman), and inventing a rate for
 * anything else is how a ledger starts lying. A null is a row the caller must
 * exclude and report, never one it may add anyway.
 */
function amountIn(
  amount: number,
  rowCurrency: string,
  target: CurrencyCode,
): number | null {
  // A currency column holding something this build does not know predates the
  // code that could have written anything else, so it is the base currency by
  // construction.
  if (!isCurrencyCode(rowCurrency)) return amount;
  if (!canConvert(rowCurrency, target)) return null;
  return convertMinor(amount, rowCurrency, target);
}

/**
 * Income and expense per month across a window, grouped in SQL.
 *
 * One query, and one that returns at most (months x currencies) rows rather
 * than every transaction in the window.
 */
export async function monthlySeries(
  from: string,
  to: string,
  currency: CurrencyCode,
): Promise<Map<string, MonthPoint>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("monthly_series", {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;

  const series = new Map<string, MonthPoint>();

  for (const row of data ?? []) {
    const income = amountIn(row.income, row.currency, currency);
    const expense = amountIn(row.expense, row.currency, currency);
    // A bar cannot carry a caveat, so a currency the chart cannot show is
    // simply not in it. The dashboard says so once, above the chart.
    if (income === null || expense === null) continue;

    const key = `${row.month.slice(0, 7)}-01`;
    const point = series.get(key) ?? { month: key, income: 0, expense: 0, logged: 0 };
    point.income += income;
    point.expense += expense;
    point.logged += row.logged;
    series.set(key, point);
  }

  return series;
}

/** One grouped query, so the KPI cards and the donut cannot disagree. */
export async function monthTotals(
  from: string,
  to: string,
  currency: CurrencyCode,
): Promise<MonthTotals> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("month_totals", {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;

  const other = new Set<CurrencyCode>();
  const totals: MonthTotals = {
    income: 0,
    expense: 0,
    unconfirmedCount: 0,
    byCategory: new Map(),
    otherCurrencies: [],
  };

  for (const row of data ?? []) {
    const amount = amountIn(row.amount, row.currency, currency);
    if (amount === null) {
      other.add(row.currency as CurrencyCode);
      // Counted nowhere, including the unconfirmed tally: a row that cannot be
      // added up is not a row this month's figures are about.
      continue;
    }

    if (row.kind === "income") {
      totals.income += amount;
      continue;
    }

    totals.expense += amount;
    totals.unconfirmedCount += row.unconfirmed_count;
    totals.byCategory.set(
      row.category_id,
      (totals.byCategory.get(row.category_id) ?? 0) + amount,
    );
  }

  totals.otherCurrencies = [...other].sort();
  return totals;
}
