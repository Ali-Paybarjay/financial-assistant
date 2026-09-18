import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { GoalProgressRow, GoalRow } from "@/lib/supabase/database.types";
import type { GoalWithProgress } from "@/lib/goals";
import type { IsoDate } from "@/lib/date";
import type { Minor } from "@/lib/money";

/**
 * Every read of goals goes through here, and what a goal holds always comes
 * from `goal_progress()` — never from a column, never from arithmetic done in
 * a page. The same rule accounts live under, for the same reason: two places
 * that both compute a total will eventually disagree, and the one the user
 * happens to be looking at will be the wrong one.
 */

export type { GoalWithProgress };

/** In priority order, which is also the order the plan hands money out in. */
export async function listGoalsWithProgress(): Promise<GoalWithProgress[]> {
  const supabase = await createClient();

  const [{ data: goals, error }, { data: progress }] = await Promise.all([
    supabase.from("goals").select("*").order("priority").order("created_at"),
    supabase.rpc("goal_progress"),
  ]);

  if (error) throw error;

  const byGoal = new Map<string, GoalProgressRow>(
    ((progress ?? []) as GoalProgressRow[]).map((row) => [row.goal_id, row]),
  );

  return (goals ?? []).map((goal: GoalRow) => {
    const derived = byGoal.get(goal.id);
    return {
      ...goal,
      // A goal the function did not return has no rows against it yet, so it
      // holds exactly what was already set aside when it was created.
      saved: derived?.saved ?? goal.opening_saved,
      funded: derived?.funded ?? 0,
      spent: derived?.spent ?? 0,
    };
  });
}

/**
 * How much has already been moved into savings for each goal this month.
 *
 * The plan's instruction is monthly, so the question it has to answer is
 * monthly too: «this month's 600» is done or it is not, regardless of what was
 * set aside in March. Without this the page would keep asking for money that
 * has already been moved.
 */
export async function fundedInMonth(
  from: IsoDate,
  to: IsoDate,
): Promise<Map<string, Minor>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("goal_id, amount")
    .eq("type", "transfer")
    .not("goal_id", "is", null)
    .is("deleted_at", null)
    .gte("occurred_on", from)
    .lte("occurred_on", to);

  if (error) throw error;

  const byGoal = new Map<string, Minor>();
  for (const row of data ?? []) {
    if (!row.goal_id) continue;
    byGoal.set(row.goal_id, (byGoal.get(row.goal_id) ?? 0) + row.amount);
  }
  return byGoal;
}
