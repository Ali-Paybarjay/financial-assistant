import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthlySeries } from "@/lib/queries/transactions";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { fundedInMonth, listGoalsWithProgress } from "@/lib/queries/goals";
import { preferredAccountId } from "@/lib/accounts";
import { monthRange, todayInTimeZone } from "@/lib/date";
import { monthlySurplus, surplusWindowStart } from "@/lib/cashflow";
import { planSavings } from "@/lib/goals";
import { GoalsView } from "./goals-view";

export default async function GoalsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const today = todayInTimeZone(viewer.timeZone);
  const current = monthRange(viewer.timeZone, today);

  const [goals, accounts, funded, { data: sources }, { data: recurring }, { data: baselines }, series] =
    await Promise.all([
      listGoalsWithProgress(),
      listAccountsWithBalances(),
      fundedInMonth(current.from, current.to),
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
  const plan = planSavings(goals, surplus.amount, today);

  const open = accounts.filter((account) => account.is_active);
  const savingsAccounts = open.filter((account) => account.kind === "savings");

  // The stock, against which the plan's flow can be checked: what the savings
  // accounts hold, and what the open goals say they are holding.
  const savingsTotal = savingsAccounts.reduce(
    (total, account) => total + account.balance,
    0,
  );
  const goalsHeld = goals
    .filter((goal) => goal.status === "active")
    .reduce((total, goal) => total + Math.max(0, goal.saved), 0);

  return (
    <GoalsView
      currency={viewer.currency}
      plan={plan}
      surplus={surplus}
      today={today}
      fundedThisMonth={Object.fromEntries(funded)}
      accounts={open}
      savingsAccounts={savingsAccounts}
      savingsTotal={savingsTotal}
      goalsHeld={goalsHeld}
      // Money is set aside *out of* the account it would otherwise be spent
      // from, so the source defaults to the everyday one, never to savings.
      defaultFromAccountId={preferredAccountId(
        open.filter((account) => account.kind !== "savings"),
      )}
    />
  );
}
