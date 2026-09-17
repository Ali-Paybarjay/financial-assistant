"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CategoryDonut, type CategorySlice } from "@/components/dashboard/category-donut";
import { MonthBars } from "@/components/dashboard/month-bars";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { AccountBalances } from "@/components/dashboard/account-balances";
import { ReconcileBanner } from "@/components/accounts/reconcile-banner";
import { TransactionRowItem } from "@/components/transactions/transaction-row";
import { EntryLauncher } from "@/components/entry/entry-sheet";
import { faNumber, faPercent } from "@/lib/format";
import { formatMonthFa, shiftMonth } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import type { MonthPoint } from "@/lib/queries/transactions";
import type { AccountWithBalance } from "@/lib/accounts";
import type {
  CategoryRow,
  GoalRow,
  TransactionRow,
} from "@/lib/supabase/database.types";

export function DashboardView({
  currency,
  name,
  today,
  month,
  isCurrentMonth,
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
  daysLeft: number;
  totals: { income: number; expense: number; unconfirmedCount: number };
  previousTotals: { income: number; expense: number };
  byCategory: CategorySlice[];
  series: MonthPoint[];
  recent: TransactionRow[];
  goals: GoalRow[];
  categories: CategoryRow[];
  accounts: AccountWithBalance[];
  accountsTotal: number;
  /** Open accounts not yet checked against the bank this month. */
  accountsDue: AccountWithBalance[];
  defaultAccountId: string | null;
}) {
  const router = useRouter();
  const [entryOpen, setEntryOpen] = useState(false);

  const balance = totals.income - totals.expense;
  const perDay = daysLeft > 0 ? Math.round(balance / daysLeft) : balance;
  const isEmpty = recent.length === 0;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const accountById = new Map(accounts.map((account) => [account.id, account]));

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
      {/* A floating button on a desktop hides something that has room, so the
          primary action moves into the header there. */}
      <div className="hidden items-center justify-between pb-4 min-[960px]:flex">
        <h1 className="text-title font-semibold text-ink">داشبورد</h1>
        <button
          type="button"
          onClick={() => setEntryOpen(true)}
          className="flex h-11 items-center gap-2 rounded-control bg-lapis px-4 text-[14px] font-semibold text-white transition-colors hover:bg-lapis/90 active:bg-lapis-pressed"
        >
          <Plus size={18} weight="bold" />
          ثبت هزینه
        </button>
      </div>

      <div className="min-[960px]:grid min-[960px]:grid-cols-[1.35fr_1fr_1fr_1fr] min-[960px]:gap-3">
        <header className="border-b border-hairline bg-surface px-4 pb-4 pt-3.5 min-[960px]:rounded-card min-[960px]:border min-[960px]:px-5 min-[960px]:py-4">
          <div className="flex items-center justify-between min-[960px]:hidden">
            <span className="flex size-9 items-center justify-center rounded-full bg-lapis-tint text-[15px] font-semibold text-lapis">
              {name.trim().charAt(0) || "؟"}
            </span>
            {monthSelector}
          </div>

          <div className="hidden min-[960px]:block">{monthSelector}</div>

          <p className="mt-3 text-label text-ink-muted">مانده‌ی این ماه</p>
          {isEmpty ? (
            <>
              <Money minor={balance} currency={currency} size="hero" />
              <p className="mt-1 text-caption text-ink-muted">
                هنوز هیچ هزینه‌ای ثبت نشده — این عدد همان درآمدی است که در ثبت‌نام گفتی.
              </p>
            </>
          ) : (
            <>
              <Money minor={balance} currency={currency} size="hero" tone="auto" signed />
              <p className="mt-1 flex items-center gap-2 text-caption text-ink-muted">
                <span>{faNumber(daysLeft)} روز تا پایان ماه</span>
                <span aria-hidden className="h-3 w-px bg-hairline" />
                <span className="flex items-center gap-1">
                  روزی
                  <Money minor={Math.max(perDay, 0)} currency={currency} />
                </span>
              </p>
            </>
          )}
        </header>

        {!isEmpty && (
          <div className="contents">
            <div className="px-4 pt-3 min-[960px]:col-span-3 min-[960px]:p-0">
              <KpiCards
                totals={totals}
                previous={previousTotals}
                currency={currency}
                hasUnconfirmed={totals.unconfirmedCount > 0}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 min-[960px]:mt-3 min-[960px]:p-0">
        {isEmpty ? (
          <EmptyDashboard onStart={() => setEntryOpen(true)} />
        ) : (
          <>
            {totals.unconfirmedCount > 0 && (
              <Link
                href="/transactions"
                className="flex items-center gap-2 rounded-control border border-guess-border bg-guess-tint px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="h-0.5 w-4 shrink-0 border-t-2 border-dashed border-guess"
                />
                <span className="flex-1 text-caption font-medium text-guess-text">
                  {faNumber(totals.unconfirmedCount)} تراکنش تأییدنشده در این جمع هست.
                </span>
                <span className="text-caption font-semibold text-lapis">بررسی</span>
              </Link>
            )}

            <div className="flex flex-col gap-3 min-[960px]:grid min-[960px]:grid-cols-[1fr_1.25fr]">
              {byCategory.length > 0 && (
                <CategoryDonut slices={byCategory} currency={currency} />
              )}
              <MonthBars series={series} currency={currency} />
            </div>

            <div className="flex flex-col gap-3 min-[960px]:grid min-[960px]:grid-cols-[1fr_1.25fr] min-[960px]:items-start">
              {goals.length > 0 && (
                <section className="rounded-card border border-hairline bg-surface p-4">
                  <h2 className="mb-3 text-[15px] font-semibold text-ink">هدف‌ها</h2>
                  <ul className="flex flex-col gap-3">
                    {goals.map((goal) => {
                      const progress = Math.min(
                        100,
                        Math.round((goal.saved_amount / goal.target_amount) * 100),
                      );
                      return (
                        <li key={goal.id} className="flex flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[14px] text-ink">
                              {goal.title}
                            </span>
                            <span className="flex shrink-0 items-baseline gap-1 text-caption text-ink-muted">
                              <Money minor={goal.saved_amount} currency={currency} />/
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
                    currency={currency}
                    onSelect={() => router.push("/transactions")}
                  />
                ))}
              </section>
            </div>
          </>
        )}
      </div>

      <EntryLauncher
        currency={currency}
        categories={categories}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        today={today}
        open={entryOpen}
        onOpenChange={setEntryOpen}
      />
    </div>
  );
}
