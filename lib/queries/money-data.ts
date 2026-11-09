import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Whether the account has any money in it yet, in the only sense that matters
 * to the base currency: is there a stored amount whose currency was copied from
 * the profile at the time it was written?
 *
 * Every one of these tables denormalises the base currency at insert, or is an
 * amount implicitly in it. Changing `profiles.base_currency` converts none of
 * them — so once any of these rows exists, the switch is not a preference any
 * more, it is a relabelling of money the user already recorded. 100 CAD does
 * not become 100 IRT because a dropdown changed, and this is what stops the app
 * from claiming it did. That was F01.
 *
 * `variable_expense_baselines` is in the list even though its column is called
 * `monthly_estimate` rather than `amount`: it is minor units of the base
 * currency like everything else, and an estimate that silently means a
 * different currency is the same bug in a quieter place.
 */
const MONEY_TABLES = [
  "transactions",
  "accounts",
  "goals",
  "income_sources",
  "recurring_expenses",
  "variable_expense_baselines",
  "category_budgets",
  "dong_groups",
] as const;

export type MoneyDataProbe = {
  /** True when at least one stored amount exists. */
  hasAny: boolean;
  /** Tables that answered, so a failed probe cannot read as «nothing here». */
  checked: number;
  /** Tables whose count did not come back. */
  failed: string[];
};

/**
 * Memoized: the settings page asks to decide whether to disable the control,
 * and the action asks again to decide whether to refuse the write.
 */
export const probeMoneyData = cache(async function probeMoneyData(
  userId: string,
): Promise<MoneyDataProbe> {
  const supabase = await createClient();

  const results = await Promise.all(
    MONEY_TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      return { table, count, error };
    }),
  );

  const failed = results.filter((result) => result.error).map((result) => result.table);

  return {
    // A probe that failed is not a zero. `accountIsEmpty` in lib/guests.ts
    // takes the same direction for the same reason: refusing to say «empty»
    // costs a blocked dropdown, and saying it wrongly costs a mislabelled
    // ledger.
    hasAny: results.some((result) => (result.count ?? (result.error ? 1 : 0)) > 0),
    checked: results.length - failed.length,
    failed,
  };
});

/** The one question the currency control and its action both ask. */
export async function hasRecordedMoney(userId: string): Promise<boolean> {
  return (await probeMoneyData(userId)).hasAny;
}
