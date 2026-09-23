import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { listGoalsWithProgress } from "@/lib/queries/goals";
import { accountsDue, totalBalance } from "@/lib/accounts";
import {
  listTransactions,
  monthlySeries,
  monthTotals,
} from "@/lib/queries/transactions";
import { ensureRecurringPosted, listMissedRecurring } from "@/lib/queries/recurring";
import { listEnvelopes, suggestedBudgets } from "@/lib/queries/envelopes";
import {
  dismissedInsightKeys,
  oldestUnconfirmed,
  weeklySpend,
} from "@/lib/queries/insights";
import { buildInsights } from "@/lib/insights";
import { monthlySurplus, projectedMonthEnd } from "@/lib/cashflow";
import { daysLeftInMonth, monthRange, shiftMonth, todayInTimeZone } from "@/lib/date";
import { DashboardView } from "./dashboard-view";

const SERIES_MONTHS = 6;

/** What to ask a brand-new account about, having no history to rank. */
const INVITE_SLUGS = ["groceries", "dining", "transport"];

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
    totals,
    previousTotals,
    series,
    recent,
    allGoals,
    envelopes,
    suggestions,
    week,
    oldestUnconfirmedAt,
    dismissedKeys,
  ] =
    await Promise.all([
      listCategories(),
      listAccountsWithBalances(),
      monthTotals(range.from, range.to),
      monthTotals(previous.from, previous.to),
      monthlySeries(seriesStart, range.to),
      listTransactions({ from: range.from, to: range.to, limit: 10 }),
      // Progress comes from the ledger, so the card cannot quietly disagree
      // with the goals page about how far along something is.
      listGoalsWithProgress(),
      // Every envelope figure comes from SQL beside the ledger. Rule 6.
      listEnvelopes(range.month),
      suggestedBudgets(range.month, viewer.currency),
      // The three the board does not already have. The pointer at the stream
      // has to name a real number — «چند نکته برایت دارم» is not worth a tap.
      weeklySpend(today),
      oldestUnconfirmed(),
      dismissedInsightKeys(),
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

  const daysLeft = daysLeftInMonth(viewer.timeZone, today);
  const daysInMonth = Number(range.to.split("-")[2]);
  // Only meaningful for the month being lived in. A month already over has no
  // rate left to carry forward, and drawing one would be inventing a future
  // for a past — so the card shows the balance alone.
  const isCurrentMonth = range.month === current.month;
  const daysGone = isCurrentMonth ? daysInMonth - daysLeft : daysInMonth;
  const forecast = isCurrentMonth
    ? projectedMonthEnd({
        income: totals.income,
        expense: totals.expense,
        daysGone,
        daysInMonth,
      })
    : null;

  const insights = buildInsights({
    today,
    month: { start: range.from, end: range.to, daysGone, daysLeft },
    totals: {
      income: totals.income,
      expense: totals.expense,
      unconfirmedCount: totals.unconfirmedCount,
      oldestUnconfirmedAt,
    },
    previousWeek: week.previous,
    currentWeek: week.current,
    envelopes,
    goals,
    accountsDue: accountsDue(accounts, today, viewer.timeZone),
    missedRecurring: missed.length,
    dismissedKeys,
    monthlySurplus: monthlySurplus({
      series: seriesPoints,
      currentMonth: range.month,
      sources: [],
      recurring: [],
      baselines: [],
    }).amount,
  });

  /**
   * Someone who has set no ceiling at all gets the board explained once,
   * with the three categories the question is most obviously about.
   *
   * Those are the three they actually spent most on this month where there is
   * any spending, and the three the design names otherwise — a brand-new
   * account has no history to rank, and «خوراک، رستوران، حمل‌ونقل» is a better
   * opening question than an empty list.
   */
  const hasAnyBudget = envelopes.some((row) => row.budget_minor !== null);
  const inviteKey = `budget_invite:${range.month.slice(0, 7)}`;
  const spentCandidates = envelopes.filter((row) => row.spent_minor > 0).slice(0, 3);
  const fallbackCandidates = INVITE_SLUGS.flatMap((slug) => {
    const category = categories.find((entry) => entry.slug === slug);
    if (!category) return [];
    return [
      {
        category_id: category.id,
        name_fa: category.name_fa,
        budget_minor: null,
        spent_minor: 0,
        remaining_minor: null,
        unconfirmed_minor: 0,
        baseline_minor: null,
      },
    ];
  });
  const invite =
    hasAnyBudget || dismissedKeys.has(inviteKey) || !isCurrentMonth
      ? null
      : {
          candidates:
            spentCandidates.length > 0 ? spentCandidates : fallbackCandidates,
          key: inviteKey,
        };

  // What the picker can offer: every expense category that is not already a
  // card. Includes the user's own, so a packet they invented last month is
  // offerable again if they took it off.
  const onBoard = new Set(envelopes.map((row) => row.category_id));
  const availableCategories = categories.filter(
    (category) =>
      category.kind === "expense" &&
      !onBoard.has(category.id) &&
      // «دنگ و دونگ» is the mirror category a trigger writes into when a trip
      // expense is paid from the user's own account. Nobody decides to spend
      // into it, so a ceiling on it would be a budget for other people's
      // arithmetic — and rule 11 keeps the two sides out of each other's
      // screens. It is still a real category in the ledger.
      category.slug !== "dong",
  );

  // A tap on an envelope opens the ledger filtered to it, and the ledger
  // filters by slug rather than by id.
  const slugById = Object.fromEntries(
    categories.map((category) => [category.id, category.slug]),
  );

  return (
    <DashboardView
      currency={viewer.currency}
      name={viewer.profile.full_name ?? ""}
      today={today}
      month={range.month}
      isCurrentMonth={isCurrentMonth}
      missed={missed}
      daysLeft={daysLeft}
      daysGone={daysGone}
      envelopes={envelopes}
      suggestions={Object.fromEntries(suggestions)}
      slugById={slugById}
      invite={invite}
      availableCategories={availableCategories}
      forecast={forecast}
      insights={insights}
      totals={{
        income: totals.income,
        expense: totals.expense,
        unconfirmedCount: totals.unconfirmedCount,
      }}
      previousTotals={{ income: previousTotals.income, expense: previousTotals.expense }}
      series={seriesPoints}
      recent={recent}
      goals={goals}
      categories={categories}
      accounts={accounts}
      accountsTotal={totalBalance(accounts)}
      accountsDue={accountsDue(accounts, today, viewer.timeZone)}
    />
  );
}
