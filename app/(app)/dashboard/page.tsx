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
import { ensureRecurringPosted, listMissedRecurring } from "@/lib/queries/recurring";
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

  // The whole active list, not the four the card shows: the entry sheet needs
  // to offer every goal a purchase could belong to, and the card is free to
  // decide its own limit.
  const goals = allGoals.filter((goal) => goal.status === "active");

  /**
   * Fixed bills are only ever generated for the month the user is in, so a
   * month they did not open the app in never got its rent.
   *
   * Shown whichever month is being viewed, not only on an affected one: the
   * user has no reason to go browsing into the past, and a gap nobody
   * navigates to is a gap nobody fixes.
   */
  const missed = await listMissedRecurring(today);

  const seriesPoints = Array.from({ length: SERIES_MONTHS }, (_, index) => {
    const month = shiftMonth(seriesStart, index);
    return series.get(month) ?? { month, income: 0, expense: 0, logged: 0 };
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
      missed={missed}
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
