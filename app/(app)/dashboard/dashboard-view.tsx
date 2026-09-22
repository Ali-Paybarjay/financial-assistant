"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { PageHeader, PageSheet, Rows, Section } from "@/components/page";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { MonthRunway } from "@/components/dashboard/month-runway";
import { CategoryDonut, type CategorySlice } from "@/components/dashboard/category-donut";
import { MonthBars } from "@/components/dashboard/month-bars";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { AccountBalances } from "@/components/dashboard/account-balances";
import { ReconcileBanner } from "@/components/accounts/reconcile-banner";
import { TransactionRowItem } from "@/components/transactions/transaction-row";
import { EntryLauncher } from "@/components/entry/entry-sheet";
import { MissedBanner, MissedReview } from "./missed-review";
import { faNumber, faPercent } from "@/lib/format";
import { formatMonthFa, shiftMonth } from "@/lib/date";
import { requiredMonthly, type GoalWithProgress } from "@/lib/goals";
import type { CurrencyCode } from "@/lib/money";
import type { MonthPoint } from "@/lib/queries/transactions";
import type { AccountWithBalance } from "@/lib/accounts";
import type {
  CategoryRow,
  MissedRecurringRow,
  TransactionRow,
} from "@/lib/supabase/database.types";

/** How many goals the dashboard section lists before it stops being a summary. */
const CARD_GOALS = 4;

export function DashboardView({
  currency,
  name,
  today,
  month,
  isCurrentMonth,
  missed,
  daysLeft,
  totals,
  previousTotals,
  byCategory,
  series,
  recent,
  goals,
  categories,
  accounts,
  accountsTotal,
  accountsDue,
  defaultAccountId,
}: {
  currency: CurrencyCode;
  name: string;
  today: string;
  month: string;
  isCurrentMonth: boolean;
  /** Fixed bills of past months that were never generated, oldest first. */
  missed: MissedRecurringRow[];
  daysLeft: number;
  totals: { income: number; expense: number; unconfirmedCount: number };
  previousTotals: { income: number; expense: number };
  byCategory: CategorySlice[];
  series: MonthPoint[];
  recent: TransactionRow[];
  goals: GoalWithProgress[];
  categories: CategoryRow[];
  accounts: AccountWithBalance[];
  accountsTotal: number;
  /** Open accounts not yet checked against the bank this month. */
  accountsDue: AccountWithBalance[];
  /** Open groups, for the one entry point the feature has on a phone. */
  defaultAccountId: string | null;
}) {
  const router = useRouter();
  const [entryOpen, setEntryOpen] = useState(false);
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
   * The runway's two halves. A month being browsed in the past is entirely
   * behind the user, so it is drawn fully inked with nothing left to spend —
   * the alternative, running today's date against a month it does not belong
   * to, would draw a pencil tail on a month that has already ended.
   */
  const daysGone = isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth(month);
  const runwayDaysLeft = isCurrentMonth ? daysLeft : 0;

  function goToMonth(delta: number) {
    router.push(`/dashboard?month=${shiftMonth(month, delta)}`);
  }

  const monthSelector = (
    <div className="flex h-9 items-center gap-1 rounded-full bg-paper px-1">
      {/* Caret-right steps back in an RTL reading order. */}
      <button
        type="button"
        aria-label="ماه قبل"
        onClick={() => goToMonth(-1)}
        className="flex size-7 items-center justify-center rounded-full text-ink-muted hover:text-action"
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
        className="flex size-7 items-center justify-center rounded-full text-ink-muted hover:text-action disabled:text-ink-faint/50 disabled:hover:text-ink-faint/50"
      >
        <CaretLeft size={14} />
      </button>
    </div>
  );

  return (
    <PageSheet width="wide">
      <div className="px-4 pb-4 pt-4 min-[960px]:px-7 min-[960px]:pb-5 min-[960px]:pt-6">
        {/* The page's name is announced at every width but only drawn where
            there is room for it beside the button. On a phone the balance
            below says where you are more plainly than the word «داشبورد». */}
        <PageHeader title="داشبورد" visuallyHidden className="mb-4 min-[960px]:mb-5">
          {/* On a phone the heading is only announced, so this row would
              otherwise hold one control and drift; the avatar gives the
              justify-between something to push against, and puts «whose
              ledger is this» where a person looks for it. */}
          <span className="flex size-9 items-center justify-center rounded-full bg-action-tint text-caption font-semibold text-action min-[960px]:hidden">
            {name.trim().charAt(0) || "؟"}
          </span>
          <div className="flex items-center gap-3">
            {monthSelector}
            {/* A floating button on a desktop hides an action that has room. */}
            <button
              type="button"
              onClick={() => setEntryOpen(true)}
              className="hidden h-11 items-center gap-2 rounded-control bg-action px-4 text-[14px] font-semibold text-white transition-colors hover:bg-action/90 active:bg-action-pressed min-[960px]:flex"
            >
              <Plus size={18} weight="bold" />
              ثبت هزینه
            </button>
          </div>
        </PageHeader>

        {/* The balance and the month's three figures: one reading of a month
            beside three more, split by a rule rather than sealed into cards. */}
        <div className="min-[960px]:grid min-[960px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] min-[960px]:items-center min-[960px]:gap-8">
          <div>
            <p className="text-label text-ink-muted">مانده‌ی این ماه</p>

            {isEmpty ? (
              <>
                <Money minor={balance} currency={currency} size="hero" />
                <p className="mt-2 max-w-[42ch] text-caption text-ink-muted">
                  هنوز هیچ هزینه‌ای ثبت نشده — این عدد همان درآمدی است که در ثبت‌نام
                  گفتی.
                </p>
              </>
            ) : (
              <>
                <Money minor={balance} currency={currency} size="hero" tone="auto" signed />
                <MonthRunway
                  daysGone={daysGone}
                  daysLeft={runwayDaysLeft}
                  perDay={runwayDaysLeft > 0 ? Math.max(perDay, 0) : null}
                  currency={currency}
                />
              </>
            )}
          </div>

          {!isEmpty && (
            <div className="mt-5 border-t border-hairline pt-4 min-[960px]:mt-0 min-[960px]:border-s min-[960px]:border-t-0 min-[960px]:ps-8 min-[960px]:pt-0">
              <KpiCards
                totals={totals}
                previous={previousTotals}
                currency={currency}
                hasUnconfirmed={totals.unconfirmedCount > 0}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-7 px-4 pb-8 min-[960px]:px-7 min-[960px]:pb-8">
        {/* Above everything, because it says the figures above it are
            incomplete — and it is a button, because the app cannot settle
            these on its own but can act on the answers. */}
        <MissedBanner count={missed.length} onOpen={() => setMissedOpen(true)} />

        {isEmpty ? (
          <>
            <EmptyDashboard onStart={() => setEntryOpen(true)} />
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
            {totals.unconfirmedCount > 0 && (
              <Link
                href="/transactions"
                className="flex items-center gap-2.5 rounded-well bg-guess-tint px-3.5 py-3 transition-colors hover:bg-guess-tint/70"
              >
                <span aria-hidden className="h-0 w-5 shrink-0 rule-guess" />
                <span className="flex-1 text-caption font-medium text-guess-text">
                  {faNumber(totals.unconfirmedCount)} تراکنش تأییدنشده در این جمع هست.
                </span>
                <span className="text-caption font-semibold text-action">بررسی</span>
              </Link>
            )}

            <div className="flex flex-col gap-7 min-[960px]:grid min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] min-[960px]:gap-x-8 min-[960px]:gap-y-7">
              {byCategory.length > 0 && (
                <CategoryDonut slices={byCategory} currency={currency} />
              )}
              <MonthBars series={series} currency={currency} />
            </div>

            <div className="flex flex-col gap-7 min-[960px]:grid min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] min-[960px]:items-start min-[960px]:gap-x-8 min-[960px]:gap-y-7">
              {openGoals.length > 0 && (
                <Section
                  title="هدف‌ها"
                  action={
                    <Link href="/goals" className="text-caption font-medium text-action">
                      برنامه
                    </Link>
                  }
                >
                  <ul className="flex flex-col gap-3.5">
                    {/* The section shows the first few; the whole list is here
                        so the entry sheet can offer every goal a purchase
                        might belong to. */}
                    {openGoals.slice(0, CARD_GOALS).map((goal) => {
                      const progress = Math.min(
                        100,
                        Math.round((goal.saved / goal.target_amount) * 100),
                      );
                      // What the date costs per month. Whether it fits the
                      // month is the goals page's job — this summary has no
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
                          {/* A goal is the same statement as the month: what is
                              saved is inked, what is still to come is not. */}
                          <div
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${goal.title} — ${faPercent(progress)}`}
                            className="runway"
                          >
                            <span className="runway-gone" style={{ width: `${progress}%` }} />
                            {progress < 100 && <span className="runway-left" />}
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
                </Section>
              )}

              {/* Above the balances, because it is the reason they might be
                  wrong. */}
              <ReconcileBanner due={accountsDue} />

              <AccountBalances
                accounts={accounts}
                total={accountsTotal}
                currency={currency}
              />
            </div>

            <Section
              title="تراکنش‌های اخیر"
              action={
                <Link
                  href="/transactions"
                  className="text-caption font-medium text-action"
                >
                  همه
                </Link>
              }
            >
              {/* Capped on a wide screen. Across the full 1120px sheet the
                  amount ends up a hand-span from the name it belongs to, and
                  a column you have to track across is a column you misread. */}
              <Rows className="min-[960px]:max-w-[720px]">
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
              </Rows>
            </Section>
          </>
        )}
      </div>

      <MissedReview
        missed={missed}
        currency={currency}
        open={missedOpen}
        onOpenChange={setMissedOpen}
      />

      <EntryLauncher
        currency={currency}
        categories={categories}
        accounts={accounts}
        goals={openGoals}
        defaultAccountId={defaultAccountId}
        today={today}
        open={entryOpen}
        onOpenChange={setEntryOpen}
      />
    </PageSheet>
  );
}

/** Days in the month a `YYYY-MM-01` key names. */
function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}
