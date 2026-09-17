import "server-only";

import { createClient } from "@/lib/supabase/server";

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
