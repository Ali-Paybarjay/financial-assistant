import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { listGoalsWithProgress } from "@/lib/queries/goals";
import { listOpenDongGroups } from "@/lib/queries/dong";
import { accountsDue, preferredAccountId, totalBalance } from "@/lib/accounts";
import {
  listTransactions,
  monthlySeries,
  monthTotals,
} from "@/lib/queries/transactions";
import { ensureRecurringPosted } from "@/lib/queries/recurring";
import { daysLeftInMonth, monthRange, shiftMonth, todayInTimeZone } from "@/lib/date";
import { DashboardView } from "./dashboard-view";

const SERIES_MONTHS = 6;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: requestedMonth } = await searchParams;
  const viewer = await requireViewer();

  const today = todayInTimeZone(viewer.timeZone);
  const current = monthRange(viewer.timeZone, today);
  const range = monthRange(viewer.timeZone, requestedMonth ?? today);

  // Idempotent in the database, so calling it on every load is safe. Only the
  // current month is generated; back-filling skipped months is out of scope.
  if (range.month === current.month) {
    await ensureRecurringPosted(current.month);
  }

  const previous = monthRange(viewer.timeZone, shiftMonth(range.month, -1));
  const seriesStart = shiftMonth(range.month, -(SERIES_MONTHS - 1));

  const [
    categories,
    accounts,
    dongGroups,
    totals,
    previousTotals,
    series,
    recent,
    allGoals,
  ] =
    await Promise.all([
      listCategories(),
      listAccountsWithBalances(),
      listOpenDongGroups(),
      monthTotals(range.from, range.to),
      monthTotals(previous.from, previous.to),
      monthlySeries(seriesStart, range.to),
      listTransactions({ from: range.from, to: range.to, limit: 10 }),
      // Progress comes from the ledger, so the card cannot quietly disagree
      // with the goals page about how far along something is.
      listGoalsWithProgress(),
    ]);

  const goals = allGoals.filter((goal) => goal.status === "active").slice(0, 4);

  const seriesPoints = Array.from({ length: SERIES_MONTHS }, (_, index) => {
    const month = shiftMonth(seriesStart, index);
    return series.get(month) ?? { month, income: 0, expense: 0 };
  });

  const byCategory = [...totals.byCategory.entries()]
    .map(([categoryId, amount]) => ({
      id: categoryId,
      name:
        categories.find((category) => category.id === categoryId)?.name_fa ?? "بدون دسته",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <DashboardView
      currency={viewer.currency}
      name={viewer.profile.full_name ?? ""}
      today={today}
      month={range.month}
      isCurrentMonth={range.month === current.month}
      daysLeft={daysLeftInMonth(viewer.timeZone, today)}
      totals={{
        income: totals.income,
        expense: totals.expense,
        unconfirmedCount: totals.unconfirmedCount,
      }}
      previousTotals={{ income: previousTotals.income, expense: previousTotals.expense }}
      byCategory={byCategory}
      series={seriesPoints}
      recent={recent}
      goals={goals}
      categories={categories}
      accounts={accounts}
      accountsTotal={totalBalance(accounts)}
      accountsDue={accountsDue(accounts, today, viewer.timeZone)}
      dongGroups={dongGroups}
      defaultAccountId={preferredAccountId(accounts)}
    />
  );
}
