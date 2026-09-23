"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowCounterClockwise,
  Funnel,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { BottomSheet } from "@/components/bottom-sheet";
import { TransactionRowItem } from "@/components/transactions/transaction-row";
import { CategoryDonut, type CategorySlice } from "@/components/dashboard/category-donut";
import { EnvelopeHeader } from "./envelope-header";
import { EditTransactionSheet } from "./edit-sheet";
import { faNumber } from "@/lib/format";
import { formatDayMonthFa, shiftMonth, formatMonthFa } from "@/lib/date";
import type { EnvelopeRow } from "@/lib/envelopes";
import type { CurrencyCode, Minor } from "@/lib/money";
import type {
  AccountRow,
  CategoryRow,
  GoalRow,
  TransactionRow,
} from "@/lib/supabase/database.types";
import { restoreTransaction } from "./actions";

const UNDO_WINDOW_MS = 5000;

type ActiveFilters = {
  category?: string;
  account?: string;
  type?: "expense" | "income" | "transfer";
  query?: string;
};

export function TransactionsView({
  currency,
  today,
  month,
  transactions,
  categories,
  accounts,
  goals,
  activeFilters,
  byCategory,
  envelope,
  envelopeSuggestion,
  daysGone,
  daysLeft,
}: {
  currency: CurrencyCode;
  today: string;
  month: string;
  transactions: TransactionRow[];
  categories: CategoryRow[];
  accounts: AccountRow[];
  goals: GoalRow[];
  activeFilters: ActiveFilters;
  /** The month's spending split by category. Moved here from the dashboard. */
  byCategory: CategorySlice[];
  /** The envelope for the filtered category, when exactly one is filtered to. */
  envelope: EnvelopeRow | null;
  /** A ceiling worth proposing for it, where there is history for one. */
  envelopeSuggestion: Minor | null;
  daysGone: number;
  daysLeft: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  // Every goal, not just the open ones: a row that funded a goal you have
  // since closed should still say which goal that was.
  const goalById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  function setParam(key: string, value?: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/transactions?${next.toString()}`);
  }

  function armUndo(id: string, title: string) {
    clearTimeout(undoTimer.current);
    setPendingDelete({ id, title });
    undoTimer.current = setTimeout(() => setPendingDelete(null), UNDO_WINDOW_MS);
  }

  const visible = transactions.filter((row) => row.id !== pendingDelete?.id);

  // Transfers are left out on purpose: the same money would count as a loss
  // here and a gain nowhere, and "جمع" is meant to read as what this filter is
  // worth, not as an artefact of moving money between one's own pockets.
  const filteredTotal = visible.reduce(
    (total, row) =>
      row.type === "transfer"
        ? total
        : total + (row.type === "income" ? row.amount : -row.amount),
    0,
  );
  const transferCount = visible.filter((row) => row.type === "transfer").length;

  const groups = useMemo(() => {
    const byDay = new Map<string, TransactionRow[]>();
    for (const row of visible) {
      const bucket = byDay.get(row.occurred_on) ?? [];
      bucket.push(row);
      byDay.set(row.occurred_on, bucket);
    }
    return [...byDay.entries()];
  }, [visible]);

  const chips = [
    activeFilters.category && {
      key: "category",
      label:
        categories.find((entry) => entry.slug === activeFilters.category)?.name_fa ??
        activeFilters.category,
    },
    activeFilters.account && {
      key: "account",
      label: accountById.get(activeFilters.account)?.title ?? "یک حساب",
    },
    activeFilters.type && {
      key: "type",
      label:
        activeFilters.type === "income"
          ? "فقط درآمد"
          : activeFilters.type === "transfer"
            ? "فقط انتقال"
            : "فقط هزینه",
    },
    activeFilters.query && { key: "q", label: `«${activeFilters.query}»` },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-4">
      <header className="flex items-center justify-between">
        <h1 className="text-title font-semibold text-ink">تراکنش‌ها</h1>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="جست‌وجو"
            onClick={() => setSearchOpen(true)}
          >
            <MagnifyingGlass size={20} />
          </Button>
          <Button
            variant={chips.length > 0 ? "outline" : "ghost"}
            size="icon"
            aria-label="فیلتر"
            onClick={() => setFiltersOpen(true)}
          >
            <Funnel size={20} />
          </Button>
        </div>
      </header>

      <div className="mt-3 flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParam("month", shiftMonth(month, -1))}
        >
          ماه قبل
        </Button>
        <span className="flex-1 text-center text-caption font-semibold text-ink">
          {formatMonthFa(month)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={month >= today.slice(0, 8) + "01"}
          onClick={() => setParam("month", shiftMonth(month, 1))}
        >
          ماه بعد
        </Button>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setParam(chip.key, undefined)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-lapis px-3 text-caption font-medium text-white"
            >
              {chip.label}
              <X size={12} />
            </button>
          ))}
        </div>
      )}

      {/* Without the filtered sum, a filter is a toy: the user cannot see what
          the narrowed set is worth. */}
      <div className="mt-3 flex items-baseline justify-between text-caption text-ink-muted">
        <span>
          {faNumber(visible.length)} نتیجه
          {/* Said out loud, because a sum that silently ignores rows the user
              can see on the same screen is a sum they cannot check. */}
          {transferCount > 0 &&
            ` (${faNumber(transferCount)} انتقال در جمع نیست)`}
        </span>
        <span data-testid="filtered-total" className="flex items-baseline gap-1.5">
          جمع
          <Money minor={filteredTotal} currency={currency} size="row" tone="auto" signed />
        </span>
      </div>

      {/* The ceiling this category is measured against, above the rows that
          made it. Only when the filter names one category — a header saying
          «over by $34» above a mixed list would be describing something the
          list does not add up to. */}
      {envelope && (
        <EnvelopeHeader
          envelope={envelope}
          observedMedian={envelopeSuggestion}
          currency={currency}
          daysGone={daysGone}
          daysLeft={daysLeft}
          rowCount={visible.length}
        />
      )}

      {/* The donut moved here from the dashboard, unchanged. It answers «what
          did I spend it on», which is a question about the ledger; the
          dashboard now answers «how much is left», which is not. Hidden when
          a category filter is on, where a single-slice donut says nothing. */}
      {!activeFilters.category && byCategory.length > 0 && (
        <div className="mt-4">
          <CategoryDonut slices={byCategory} currency={currency} />
        </div>
      )}

      {groups.length === 0 ? (
        <p className="mt-6 rounded-card border border-hairline bg-surface p-6 text-center text-body text-ink-muted">
          {chips.length > 0
            ? "در این بازه چیزی ثبت نشده. بازه را عوض کن یا فیلتر را بردار."
            : "این ماه هنوز چیزی ثبت نکرده‌ای."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {groups.map(([day, rows]) => (
            <section key={day}>
              <h2 className="mb-1.5 text-caption font-semibold text-ink-muted">
                {day === today ? "امروز" : formatDayMonthFa(day)}
              </h2>
              <div className="overflow-hidden rounded-card border border-hairline bg-surface">
                {rows.map((row) => (
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
                    onSelect={() => setEditing(row)}
                  />
                ))}
                {pendingDelete && rows.some((row) => row.id === pendingDelete.id) && (
                  <UndoRow
                    title={pendingDelete.title}
                    onUndo={() => {
                      clearTimeout(undoTimer.current);
                      const id = pendingDelete.id;
                      setPendingDelete(null);
                      startTransition(async () => {
                        await restoreTransaction(id);
                        router.refresh();
                      });
                    }}
                  />
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {pendingDelete && !groups.some(([, rows]) => rows.some((r) => r.id === pendingDelete.id)) && (
        <div className="mt-3 overflow-hidden rounded-card border border-hairline bg-surface">
          <UndoRow
            title={pendingDelete.title}
            onUndo={() => {
              clearTimeout(undoTimer.current);
              const id = pendingDelete.id;
              setPendingDelete(null);
              startTransition(async () => {
                await restoreTransaction(id);
                router.refresh();
              });
            }}
          />
        </div>
      )}

      <p className="mt-4 text-center text-caption text-ink-muted">
        روی هر ردیف بزن تا ویرایشش کنی.
      </p>

      <EditTransactionSheet
        transaction={editing}
        currency={currency}
        categories={categories}
        accounts={accounts}
        goals={goals}
        onClose={() => setEditing(null)}
        onDeleted={(id, title) => {
          setEditing(null);
          armUndo(id, title);
        }}
      />

      <BottomSheet open={filtersOpen} onOpenChange={setFiltersOpen} title="فیلتر">
        <div className="flex flex-col gap-4">
          <NativeSelect
            aria-label="دسته"
            value={activeFilters.category ?? ""}
            onChange={(event) => {
              setParam("category", event.target.value || undefined);
              setFiltersOpen(false);
            }}
          >
            <option value="">همه‌ی دسته‌ها</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name_fa}
              </option>
            ))}
          </NativeSelect>

          {accounts.length > 0 && (
            <NativeSelect
              aria-label="حساب"
              value={activeFilters.account ?? ""}
              onChange={(event) => {
                setParam("account", event.target.value || undefined);
                setFiltersOpen(false);
              }}
            >
              <option value="">همه‌ی حساب‌ها</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.title}
                </option>
              ))}
            </NativeSelect>
          )}

          <NativeSelect
            aria-label="نوع"
            value={activeFilters.type ?? ""}
            onChange={(event) => {
              setParam("type", event.target.value || undefined);
              setFiltersOpen(false);
            }}
          >
            <option value="">هزینه و درآمد</option>
            <option value="expense">فقط هزینه</option>
            <option value="income">فقط درآمد</option>
            <option value="transfer">فقط انتقال</option>
          </NativeSelect>
        </div>
      </BottomSheet>

      <BottomSheet open={searchOpen} onOpenChange={setSearchOpen} title="جست‌وجو">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("q");
            setParam("q", typeof value === "string" && value ? value : undefined);
            setSearchOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <Input
            name="q"
            defaultValue={activeFilters.query ?? ""}
            placeholder="نام فروشنده یا توضیح"
            autoFocus
          />
          <Button type="submit" size="lg">
            بگرد
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}

/** Inline, in the same card the row was in — not a corner toast the thumb
 *  cannot reach in five seconds. */
function UndoRow({ title, onUndo }: { title: string; onUndo: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-paper p-3">
      <span className="truncate text-caption text-ink-muted">«{title}» حذف شد.</span>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-hairline-strong bg-surface px-3 text-caption font-medium text-lapis"
      >
        <ArrowCounterClockwise size={14} />
        برگردان
      </button>
    </div>
  );
}
