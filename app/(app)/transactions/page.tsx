import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listAccounts } from "@/lib/queries/accounts";
import { listGoalsWithProgress } from "@/lib/queries/goals";
import { listTransactionPage, monthTotals } from "@/lib/queries/transactions";
import { listEnvelopes, suggestedBudgets } from "@/lib/queries/envelopes";
import {
  daysLeftInMonth,
  monthKeyFromParam,
  monthRange,
  todayInTimeZone,
} from "@/lib/date";
import { TransactionsView } from "./transactions-view";

/**
 * A page number out of a query string.
 *
 * Anything that is not a whole number at or above 1 is page 1, which is the
 * same posture `monthKeyFromParam` takes in lib/date.ts: a hand-edited URL is
 * answered with the sensible page, not with an error screen. F13.
 */
function pageNumber(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    category?: string;
    account?: string;
    type?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const viewer = await requireViewer();

  const today = todayInTimeZone(viewer.timeZone);
  // Same parser the dashboard uses: a month that is not a date is this month,
  // not a stack trace. F13.
  const range = monthRange(
    viewer.timeZone,
    monthKeyFromParam(params.month, viewer.timeZone),
  );
  const type =
    params.type === "income" || params.type === "expense" || params.type === "transfer"
      ? params.type
      : undefined;

  const [categories, accounts, goals] = await Promise.all([
    listCategories(),
    listAccounts(),
    listGoalsWithProgress(),
  ]);
  const categoryId = params.category
    ? categories.find((entry) => entry.slug === params.category)?.id
    : undefined;

  // An id that is not the viewer's own would return nothing anyway under RLS;
  // checking it here is what keeps the chip from naming a filter that is not on.
  const accountId = accounts.find((entry) => entry.id === params.account)?.id;

  const [totals, envelopes, suggestions] = await Promise.all([
    monthTotals(range.from, range.to, viewer.currency),
    listEnvelopes(range.month),
    suggestedBudgets(range.month, viewer.currency),
  ]);

  // Paged, so a heavy month is a page the user can walk through rather than a
  // list that silently stops at whatever the API was willing to return. The
  // totals above it come from SQL and cover the whole month regardless. F10.
  const page = pageNumber(params.page);
  const ledger = await listTransactionPage(
    {
      from: range.from,
      to: range.to,
      type,
      query: params.q,
      categoryIds: categoryId ? [categoryId] : undefined,
      accountIds: accountId ? [accountId] : undefined,
    },
    page,
  );

  const byCategory = [...totals.byCategory.entries()]
    .map(([id, amount]) => ({
      id,
      name: categories.find((entry) => entry.id === id)?.name_fa ?? "بدون دسته",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  // The month being viewed may not be the month being lived in, and a past
  // month has no days left to spread anything over.
  const current = monthRange(viewer.timeZone, today);
  const daysInMonth = Number(range.to.split("-")[2]);
  const daysLeft =
    range.month === current.month ? daysLeftInMonth(viewer.timeZone, today) : 0;

  return (
    <TransactionsView
      currency={viewer.currency}
      today={today}
      month={range.month}
      transactions={ledger.rows}
      page={ledger.page}
      hasMore={ledger.hasMore}
      categories={categories}
      accounts={accounts}
      goals={goals}
      activeFilters={{
        category: params.category,
        account: accountId,
        type,
        query: params.q,
      }}
      byCategory={byCategory}
      envelope={envelopes.find((row) => row.category_id === categoryId) ?? null}
      envelopeSuggestion={(categoryId && suggestions.get(categoryId)) || null}
      daysGone={daysInMonth - daysLeft}
      daysLeft={daysLeft}
      otherCurrencies={totals.otherCurrencies}
    />
  );
}
