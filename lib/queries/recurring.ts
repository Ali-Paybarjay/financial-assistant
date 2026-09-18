import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MissedRecurringRow } from "@/lib/supabase/database.types";
import type { IsoDate } from "@/lib/date";

/**
 * Generates this month's rows from the user's active auto-post recurring
 * expenses. Idempotent in the database, not here: a unique index on
 * (recurring_expense_id, posted_month) absorbs a second call, including two
 * that race. Safe to invoke on every dashboard load.
 */
export async function ensureRecurringPosted(month: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_recurring_for_month", {
    p_month: month,
  });

  // A failure here must not take the dashboard down with it; the user's own
  // transactions are still correct, only the generated ones are missing.
  if (error) return 0;
  return data ?? 0;
}

/**
 * The fixed bills of past months that were never generated, oldest first.
 *
 * Only the app knows a month was skipped; only the user knows whether the
 * bill was actually paid in it. So this returns questions, not facts, and
 * nothing is written until one is answered.
 *
 * The window, the due-date rule and the exclusions all live in SQL beside the
 * generator that shares them — asking about a month the generator would never
 * have produced, or producing one it never asked about, are the two ways this
 * could be wrong.
 */
export async function listMissedRecurring(
  today: IsoDate,
): Promise<MissedRecurringRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("missed_recurring_months", {
    p_before: today,
  });

  // Never take the dashboard down over a question that can wait.
  if (error) return [];
  return (data ?? []) as MissedRecurringRow[];
}
