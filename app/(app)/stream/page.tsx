import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { listGoalsWithProgress } from "@/lib/queries/goals";
import { listEnvelopes } from "@/lib/queries/envelopes";
import { listMissedRecurring } from "@/lib/queries/recurring";
import { monthlySeries, monthTotals } from "@/lib/queries/transactions";
import {
  dismissedInsightKeys,
  oldestUnconfirmed,
  streamActivity,
  weeklySpend,
} from "@/lib/queries/insights";
import { accountsDue } from "@/lib/accounts";
import { buildInsights } from "@/lib/insights";
import { monthlySurplus, surplusWindowStart } from "@/lib/cashflow";
import { daysLeftInMonth, monthRange, todayInTimeZone } from "@/lib/date";
import { StreamView } from "./stream-view";

/**
 * «جریان» — what the app has to say, and what it is still unsure about.
 *
 * Every sentence on this page is arithmetic done in lib/insights.ts. Nothing
 * here calls a model: there is no request to OpenRouter on this route at all,
 * which is what makes a tab the user opens several times a day free to run.
 */
export default async function StreamPage() {
  const viewer = await requireViewer();

  const today = todayInTimeZone(viewer.timeZone);
  const range = monthRange(viewer.timeZone, today);
  const daysLeft = daysLeftInMonth(viewer.timeZone, today);
  const daysInMonth = Number(range.to.split("-")[2]);

  const [
    categories,
    accounts,
    goals,
    envelopes,
    totals,
    week,
    oldestUnconfirmedAt,
    dismissedKeys,
    activity,
    missed,
    series,
  ] = await Promise.all([
    listCategories(),
    listAccountsWithBalances(),
    listGoalsWithProgress(),
    listEnvelopes(range.month),
    monthTotals(range.from, range.to),
    weeklySpend(today),
    oldestUnconfirmed(),
    dismissedInsightKeys(),
    streamActivity(today),
    listMissedRecurring(today),
    monthlySeries(surplusWindowStart(range.month), range.to),
  ]);

  // The same surplus the savings plan is built on, so «this goal no longer
  // fits» here and the goals page cannot disagree about what a month leaves.
  const surplus = monthlySurplus({
    series: [...series.values()],
    currentMonth: range.month,
    sources: [],
    recurring: [],
    baselines: [],
  });

  const insights = buildInsights({
    today,
    month: {
      start: range.from,
      end: range.to,
      daysGone: daysInMonth - daysLeft,
      daysLeft,
    },
    totals: {
      income: totals.income,
      expense: totals.expense,
      unconfirmedCount: totals.unconfirmedCount,
      oldestUnconfirmedAt,
    },
    previousWeek: week.previous,
    currentWeek: week.current,
    envelopes,
    goals: goals.filter((goal) => goal.status === "active"),
    accountsDue: accountsDue(accounts, today, viewer.timeZone),
    missedRecurring: missed.length,
    dismissedKeys,
    monthlySurplus: surplus.amount,
  });

  return (
    <StreamView
      currency={viewer.currency}
      today={today}
      insights={insights}
      activity={activity}
      categories={categories}
      unconfirmedCount={totals.unconfirmedCount}
    />
  );
}
