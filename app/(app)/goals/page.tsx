import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthlySeries } from "@/lib/queries/transactions";
import { monthRange, todayInTimeZone } from "@/lib/date";
import { monthlySurplus, surplusWindowStart } from "@/lib/cashflow";
import { planSavings } from "@/lib/goals";
import { GoalsView } from "./goals-view";

export default async function GoalsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const today = todayInTimeZone(viewer.timeZone);
  const current = monthRange(viewer.timeZone, today);

  const [{ data: goals }, { data: sources }, { data: recurring }, { data: baselines }, series] =
    await Promise.all([
      supabase.from("goals").select("*").order("priority").order("created_at"),
      supabase.from("income_sources").select("*"),
      supabase.from("recurring_expenses").select("*"),
      supabase.from("variable_expense_baselines").select("*"),
      // Whole months only, so the running month cannot pass for a finished one.
      monthlySeries(surplusWindowStart(current.month), current.to),
    ]);

  const surplus = monthlySurplus({
    series: [...series.values()],
    currentMonth: current.month,
    sources: sources ?? [],
    recurring: recurring ?? [],
    baselines: baselines ?? [],
  });

  // The goals arrive in priority order, and that is the order the surplus is
  // handed out in — what the page shows and what the plan assumes are the
  // same list.
  const plan = planSavings(goals ?? [], surplus.amount, today);

  return <GoalsView currency={viewer.currency} plan={plan} surplus={surplus} />;
}
