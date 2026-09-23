"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CaretLeft,
  CaretRight,
  ChatTeardropText,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { MonthBars } from "@/components/dashboard/month-bars";
import { EnvelopeBoard } from "./envelope-board";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { AccountBalances } from "@/components/dashboard/account-balances";
import { ReconcileBanner } from "@/components/accounts/reconcile-banner";
import { TransactionRowItem } from "@/components/transactions/transaction-row";
import { MissedBanner, MissedReview } from "./missed-review";
import { faNumber, faPercent } from "@/lib/format";
import { formatMonthFa, shiftMonth } from "@/lib/date";
import { requiredMonthly, type GoalWithProgress } from "@/lib/goals";
import type { EnvelopeRow } from "@/lib/envelopes";
import type { CurrencyCode, Minor } from "@/lib/money";
import type { MonthPoint } from "@/lib/queries/transactions";
import type { AccountWithBalance } from "@/lib/accounts";
import type {
  CategoryRow,
  MissedRecurringRow,
  TransactionRow,
} from "@/lib/supabase/database.types";

/** How many goals the dashboard card lists before it stops being a summary. */
const CARD_GOALS = 4;

export function DashboardView({
  currency,
  name,
  today,
  month,
  isCurrentMonth,
  missed,
  daysLeft,
  daysGone,
  envelopes,
  suggestions,
  slugById,
  invite,
  availableCategories,
  forecast,
  insightCount,
  totals,
  previousTotals,
  series,
  recent,
  goals,
  categories,
  accounts,
  accountsTotal,
  accountsDue,
}: {
  currency: CurrencyCode;
  name: string;
  today: string;
  month: string;
  isCurrentMonth: boolean;
  /** Fixed bills of past months that were never generated, oldest first. */
  missed: MissedRecurringRow[];
  daysLeft: number;
  /** Days of the month already lived, including today. */
  daysGone: number;
  envelopes: EnvelopeRow[];
  /** categoryId -> a ceiling worth proposing, where there is history for one. */
  suggestions: Record<string, Minor>;
  slugById: Record<string, string>;
  /** Offered only while no ceiling exists anywhere, and not once waved away. */
  invite: { candidates: EnvelopeRow[]; key: string } | null;
  /** Expense categories not on the board, for the «+ پاکت» picker. */
  availableCategories: CategoryRow[];
  /** Where the month lands at the current rate. null for a month already over. */
  forecast: Minor | null;
  /** How many things the stream has to say, for the one-line pointer to it. */
  insightCount: number;
  totals: { income: number; expense: number; unconfirmedCount: number };
  previousTotals: { income: number; expense: number };
  series: MonthPoint[];
  recent: TransactionRow[];
  goals: GoalWithProgress[];
  categories: CategoryRow[];
  accounts: AccountWithBalance[];
  accountsTotal: number;
  /** Open accounts not yet checked against the bank this month. */
  accountsDue: AccountWithBalance[];
}) {
  const router = useRouter();
  const [missedOpen, setMissedOpen] = useState(false);

  const balance = totals.income - totals.expense;
  const perDay = daysLeft > 0 ? Math.round(balance / daysLeft) : balance;
  const isEmpty = recent.length === 0;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  // Every goal, not just the open ones: a row that funded a goal you have
  // since closed should still say which goal that was.
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const openGoals = goals.filter((goal) => goal.status === "active");

  /**
   * Put the cursor in the composer, which lives in the shell rather than on
   * this page. By id because that is the one thing the two share — a context
   * carrying a ref would mean every page paying for a provider so that the
   * empty state can move focus once.
   */
  function focusComposer() {
    document.getElementById("composer-text")?.focus();
  }

  function goToMonth(delta: number) {
    router.push(`/dashboard?month=${shiftMonth(month, delta)}`);
  }

  const monthSelector = (
    <div className="flex h-9 items-center gap-1 rounded-full border border-hairline bg-paper px-1">
      {/* Caret-right steps back in an RTL reading order. */}
      <button
        type="button"
        aria-label="ماه قبل"
        onClick={() => goToMonth(-1)}
        className="flex size-7 items-center justify-center rounded-full text-ink-muted hover:text-lapis"
      >
        <CaretRight size={14} />
      </button>
      <span className="px-1 text-caption font-semibold text-ink">
        {formatMonthFa(month)}
      </span>
      <button
        type="button"
        aria-label="ماه بعد"
        disabled={isCurrentMonth}
        onClick={() => goToMonth(1)}
        className="flex size-7 items-center justify-center rounded-full text-ink-muted hover:text-lapis disabled:text-hairline-strong disabled:hover:text-hairline-strong"
      >
        <CaretLeft size={14} />
      </button>
    </div>
  );

  return (
    // Financial figures gain nothing from stretching, so the content stops at
    // 1120px and centres. One breakpoint, not three.
    <div className="mx-auto w-full max-w-[560px] min-[960px]:max-w-[1120px] min-[960px]:px-7 min-[960px]:py-6">
      {/* The page's name, kept in the accessibility tree at every width. It
          used to live inside a row that was `hidden` below 960px — which
          meant that on a phone, the screen the whole app opens on had no
          heading at all for anyone navigating by them. The button that used
          to sit beside it is gone: recording a purchase is the composer's
          job now, on every page rather than this one. */}
      <h1 className="sr-only text-title font-semibold text-ink min-[960px]:not-sr-only min-[960px]:pb-4">
        پاکت‌ها
      </h1>

      {/* One of the two doors to the ledger, now that it has left the tab
          bar. The other is a tap on any envelope. */}
      <form
        action="/transactions"
        className="flex items-center gap-2 px-4 pt-3 min-[960px]:px-0 min-[960px]:pt-0 min-[960px]:pb-3"
      >
        <label htmlFor="dashboard-search" className="sr-only">
          جست‌وجو در تراکنش‌ها
        </label>
        <span className="flex h-11 flex-1 items-center gap-2 rounded-control bg-paper px-3">
          <MagnifyingGlass size={17} className="shrink-0 text-ink-faint" />
          <input
            id="dashboard-search"
            name="q"
            type="search"
            placeholder="جست‌وجو در تراکنش‌ها"
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint"
          />
        </span>
      </form>

      <div className="flex flex-col gap-3 px-4 pt-3 min-[960px]:px-0">
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-full bg-lapis-tint text-[15px] font-semibold text-lapis min-[960px]:hidden">
            {name.trim().charAt(0) || "؟"}
          </span>
          {monthSelector}
        </div>

        {isEmpty ? (
          <section className="rounded-card bg-ink p-4 text-white">
            <p className="text-label text-white/70">ماندهٔ {formatMonthFa(month)}</p>
            <Money
              minor={balance}
              currency={currency}
              size="hero"
              className="mt-1 block text-positive-on-ink"
            />
            <p className="mt-1 text-caption text-white/70">
              هنوز هیچ هزینه‌ای ثبت نشده — این عدد همان درآمدی است که در ثبت‌نام گفتی.
            </p>
          </section>
        ) : (
          <BalanceCard
            balance={balance}
            forecast={forecast}
            currency={currency}
            daysGone={daysGone}
            daysLeft={daysLeft}
            perDayAllowed={daysLeft > 0 ? Math.max(perDay, 0) : null}
            perDaySpent={daysGone > 0 ? Math.round(totals.expense / daysGone) : null}
            monthLabel={formatMonthFa(month)}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 min-[960px]:mt-3 min-[960px]:p-0">
        {/* Above everything, because it says the figures below it are
            incomplete — and it is a button, because the app cannot settle
            these on its own but can act on the answers. */}
        <MissedBanner count={missed.length} onOpen={() => setMissedOpen(true)} />

        {isEmpty ? (
          <>
            <EmptyDashboard onStart={focusComposer} />
            {/* An empty month is exactly when a user goes looking for the
                pages that are not in the tab bar, so these outlive it. */}
            <ReconcileBanner due={accountsDue} />
            <AccountBalances
              accounts={accounts}
              total={accountsTotal}
              currency={currency}
            />
          </>
        ) : (
          <>
            <EnvelopeBoard
              envelopes={envelopes}
              suggestions={suggestions}
              slugById={slugById}
              currency={currency}
              daysLeft={daysLeft}
              invite={invite}
              available={availableCategories}
            />

            {/* The yellow banner this replaces said there was something to
                deal with but not what, and sent every kind of unfinished
                business to the same page. The stream is where they live now,
                so the board only has to point. */}
            {insightCount > 0 && (
              <Link
                href="/stream"
                className="flex items-center gap-2 rounded-control bg-lapis-tint px-3 py-2.5"
              >
                <ChatTeardropText size={17} className="shrink-0 text-lapis" />
                <span className="flex-1 text-caption font-medium text-ink">
                  {streamHint(insightCount, totals.unconfirmedCount)}
                </span>
                <CaretLeft size={14} className="shrink-0 text-lapis" />
              </Link>
            )}

            <MonthBars series={series} currency={currency} />

            <KpiCards
              totals={totals}
              previous={previousTotals}
              currency={currency}
              hasUnconfirmed={totals.unconfirmedCount > 0}
            />

            <div className="flex flex-col gap-3 min-[960px]:grid min-[960px]:grid-cols-[1fr_1.25fr] min-[960px]:items-start">
              {openGoals.length > 0 && (
                <section className="rounded-card border border-hairline bg-surface p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h2 className="text-[15px] font-semibold text-ink">هدف‌ها</h2>
                    <Link href="/goals" className="text-caption font-medium text-lapis">
                      برنامه
                    </Link>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {/* The card shows the first few; the whole list is here so
                        the entry sheet can offer every goal a purchase might
                        belong to. */}
                    {openGoals.slice(0, CARD_GOALS).map((goal) => {
                      const progress = Math.min(
                        100,
                        Math.round((goal.saved / goal.target_amount) * 100),
                      );
                      // What the date costs per month. Whether it fits the
                      // month is the goals page's job — this card has no
                      // surplus to weigh it against, and a number is still
                      // worth more here than a bar on its own.
                      const required = requiredMonthly(goal, today);
                      return (
                        <li key={goal.id} className="flex flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[14px] text-ink">
                              {goal.title}
                            </span>
                            <span className="flex shrink-0 items-baseline gap-1 text-caption text-ink-muted">
                              <Money minor={goal.saved} currency={currency} />/
                              <Money minor={goal.target_amount} currency={currency} />
                            </span>
                          </div>
                          <div
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${goal.title} — ${faPercent(progress)}`}
                            className="h-2 overflow-hidden rounded-full bg-lapis-tint"
                          >
                            <div
                              className="h-full rounded-full bg-lapis"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {required !== null && (
                            <p className="text-caption text-ink-muted">
                              ماهی <Money minor={required} currency={currency} /> تا به
                              تاریخش برسی
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* Above the balances, because it is the reason they might be
                  wrong. */}
              <ReconcileBanner due={accountsDue} />

              <AccountBalances
                accounts={accounts}
                total={accountsTotal}
                currency={currency}
              />

              <section className="overflow-hidden rounded-card border border-hairline bg-surface">
                <div className="flex items-center justify-between p-4 pb-2">
                  <h2 className="text-[15px] font-semibold text-ink">تراکنش‌های اخیر</h2>
                  <Link
                    href="/transactions"
                    className="text-caption font-medium text-lapis"
                  >
                    همه
                  </Link>
                </div>
                {recent.map((row) => (
                  <TransactionRowItem
                    key={row.id}
                    transaction={row}
                    category={
                      row.category_id ? categoryById.get(row.category_id) : undefined
                    }
                    accountTitle={
                      row.account_id ? accountById.get(row.account_id)?.title : undefined
                    }
                    toAccountTitle={
                      row.to_account_id
                        ? accountById.get(row.to_account_id)?.title
                        : undefined
                    }
                    goalTitle={
                      row.goal_id ? goalById.get(row.goal_id)?.title : undefined
                    }
                    currency={currency}
                    onSelect={() => router.push("/transactions")}
                  />
                ))}
              </section>
            </div>

            {/* Last on the page, and deliberately: this is a feature beside
                the month the rest of the dashboard is about, not part of it. */}
          </>
        )}
      </div>

      <MissedReview
        missed={missed}
        currency={currency}
        open={missedOpen}
        onOpenChange={setMissedOpen}
      />

    </div>
  );
}

/**
 * The one line the board gives the stream.
 *
 * Counts, not adjectives: «۲ بینش تازه و ۱ حدس تأییدنشده» tells the user
 * whether it is worth the tap, and «چند نکته برایت دارم» does not.
 */
function streamHint(insightCount: number, unconfirmedCount: number): string {
  const parts: string[] = [];
  if (insightCount > 0) parts.push(`${faNumber(insightCount)} بینش تازه`);
  if (unconfirmedCount > 0) {
    parts.push(`${faNumber(unconfirmedCount)} حدس تأییدنشده`);
  }
  return `${parts.join(" و ")} در جریان هست.`;
}
