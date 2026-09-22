import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listTransactions } from "@/lib/queries/transactions";
import { addDays, type IsoDate } from "@/lib/date";
import type { Minor } from "@/lib/money";
import type { TransactionRow } from "@/lib/supabase/database.types";

/**
 * The reads behind the stream. `lib/insights.ts` does the deciding and takes
 * everything as arguments; this is the half that goes to the database.
 */

/** Keys the user has waved away. Returned as a set, which is what the rules want. */
export async function dismissedInsightKeys(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insight_dismissals")
    .select("insight_key");

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.insight_key));
}

export type WeekSpend = { current: Minor; previous: Minor };

/**
 * What was spent in the last seven days, and in the seven before that.
 *
 * Rolling weeks rather than calendar ones: the comparison is «the week you
 * have just lived against the one before it», and on a Tuesday a calendar
 * week would be comparing two days against seven.
 */
export async function weeklySpend(today: IsoDate): Promise<WeekSpend> {
  const rows = await listTransactions({
    from: addDays(today, -13),
    to: today,
    type: "expense",
  });

  const boundary = addDays(today, -6);
  let current = 0;
  let previous = 0;
  for (const row of rows) {
    if (row.occurred_on >= boundary) current += row.amount;
    else previous += row.amount;
  }
  return { current, previous };
}

/**
 * When the oldest unconfirmed guess was recorded, or null if there is none.
 *
 * `occurred_on` rather than `created_at`: what makes a guess stale is how
 * long it has been sitting unanswered, and a receipt photographed today for a
 * purchase made last week has been waiting a few hours, not a week.
 */
export async function oldestUnconfirmed(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("created_at")
    .eq("is_confirmed", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.created_at ?? null;
}

/** How many days of recent activity the stream shows beneath the insights. */
const STREAM_DAYS = 7;

/** The recent rows the stream turns into messages. */
export async function streamActivity(today: IsoDate): Promise<TransactionRow[]> {
  return listTransactions({ from: addDays(today, -STREAM_DAYS), to: today });
}
