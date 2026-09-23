import "server-only";

import { createClient } from "@/lib/supabase/server";
import { monthRange, shiftMonth, type IsoDate } from "@/lib/date";
import { suggestBudget } from "@/lib/envelopes";
import type { EnvelopeRow } from "@/lib/envelopes";
import type { CurrencyCode, Minor } from "@/lib/money";
import type { CategoryBudgetRow, EnvelopeStatusRow } from "@/lib/supabase/database.types";

/**
 * Every read of an envelope goes through here, and every figure in it comes
 * from `envelope_status()` — never from a column, and never from arithmetic
 * done in a page. Rule 6.
 */

export type { EnvelopeRow };

/** What each envelope is worth in the month containing `month`. */
export async function listEnvelopes(month: IsoDate): Promise<EnvelopeRow[]> {
  const supabase = await createClient();
  // The month key already names the month, so the timezone argument never
  // gets consulted — monthRange only reaches for it when there is no anchor.
  // Whoever chose the month did so in the user's timezone upstream.
  const { from, to } = monthRange("UTC", month);

  const { data, error } = await supabase.rpc("envelope_status", {
    p_month_start: from,
    p_month_end: to,
  });

  if (error) throw error;
  return (data ?? []) as EnvelopeStatusRow[];
}

/** The ceilings in force from `month` onwards, for the settings editor. */
export async function listBudgets(month: IsoDate): Promise<CategoryBudgetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("category_budgets")
    .select("*")
    .lte("effective_from", month)
    .order("effective_from", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** How many months of history `suggestBudget` looks back over. */
const SUGGEST_MONTHS = 3;

/**
 * A ceiling to propose for each category, from what was actually spent in the
 * months before this one.
 *
 * The running month is excluded on purpose: on the 3rd it would propose a
 * ceiling a tenth of what the user needs. Same reasoning as the surplus
 * window in lib/cashflow.ts, and the same three-month span.
 *
 * Categories with under two months of history are absent from the map rather
 * than present with a null — there is nothing to propose for them, and the
 * board invites the user to decide instead.
 */
export async function suggestedBudgets(
  month: IsoDate,
  currency: CurrencyCode,
): Promise<Map<string, Minor>> {
  const supabase = await createClient();
  const windowStart = shiftMonth(month, -SUGGEST_MONTHS);

  const { data, error } = await supabase
    .from("transactions")
    .select("category_id, amount, occurred_on")
    .eq("type", "expense")
    .is("deleted_at", null)
    .gte("occurred_on", windowStart)
    .lt("occurred_on", month);

  if (error) throw error;

  // category -> month -> total. The months are bucketed here rather than in
  // SQL because `suggestBudget` wants one figure per month per category and
  // the window is at most three months of one person's spending.
  const byCategory = new Map<string, Map<string, Minor>>();
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    const monthKey = row.occurred_on.slice(0, 7);
    const months = byCategory.get(row.category_id) ?? new Map<string, Minor>();
    months.set(monthKey, (months.get(monthKey) ?? 0) + row.amount);
    byCategory.set(row.category_id, months);
  }

  const suggestions = new Map<string, Minor>();
  for (const [categoryId, months] of byCategory) {
    const suggestion = suggestBudget([...months.values()], currency);
    if (suggestion !== null) suggestions.set(categoryId, suggestion);
  }
  return suggestions;
}
