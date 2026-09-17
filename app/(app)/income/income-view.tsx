"use client";

import { useState } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  Plus,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { SegmentedControl } from "@/components/segmented-control";
import { faNumber } from "@/lib/format";
import { sumMinor, type CurrencyCode } from "@/lib/money";
import type {
  CategoryRow,
  IncomeSourceRow,
  RecurringExpenseRow,
} from "@/lib/supabase/database.types";
import { IncomeSourceRowItem, RecurringRowItem } from "./record-rows";
import { IncomeSourceSheet, RecurringSheet } from "./record-sheets";

type Tab = "income" | "recurring";

/** Monthly equivalent, so a biweekly salary and a yearly bonus are comparable. */
const PER_MONTH: Record<string, number> = {
  monthly: 1,
  biweekly: 26 / 12,
  weekly: 52 / 12,
  yearly: 1 / 12,
  one_time: 0,
};

export function IncomeView({
  initialTab,
  currency,
  sources,
  recurring,
  categories,
}: {
  initialTab: Tab;
  currency: CurrencyCode;
  sources: IncomeSourceRow[];
  recurring: RecurringExpenseRow[];
  categories: CategoryRow[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editingIncome, setEditingIncome] = useState<IncomeSourceRow | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpenseRow | null>(
    null,
  );
  const [sheet, setSheet] = useState<Tab | null>(null);

  const activeSources = sources.filter((source) => source.is_active);
  const activeRecurring = recurring.filter((expense) => expense.is_active);

  const monthlyIncome = Math.round(
    sumMinor(
      activeSources.map((source) =>
        Math.round(source.amount * (PER_MONTH[source.frequency] ?? 1)),
      ),
    ),
  );
  const monthlyRecurring = sumMinor(activeRecurring.map((expense) => expense.amount));

  const isIncome = tab === "income";
  const rows = isIncome ? sources : recurring;
  const activeCount = isIncome ? activeSources.length : activeRecurring.length;
  const total = isIncome ? monthlyIncome : monthlyRecurring;

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-4">
      <h1 className="mb-4 text-title font-semibold text-ink">درآمد و هزینه‌ی ثابت</h1>

      <SegmentedControl<Tab>
        label="نوع ردیف"
        value={tab}
        onChange={setTab}
        segments={[
          { value: "income", label: "درآمد", icon: <Wallet size={16} /> },
          {
            value: "recurring",
            label: "هزینه‌ی ثابت",
            icon: <ArrowsClockwise size={16} />,
          },
        ]}
      />

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-caption text-ink-muted">
          {faNumber(activeCount)} ردیف فعال
        </span>
        <span className="flex items-baseline gap-1.5 text-caption text-ink-muted">
          ماهی
          <Money minor={total} currency={currency} size="kpi" />
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-card border border-hairline bg-surface">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-body text-ink-muted">
            {isIncome
              ? "هنوز منبع درآمدی ثبت نکرده‌ای."
              : "هنوز هزینه‌ی ثابتی ثبت نکرده‌ای."}
          </p>
        ) : isIncome ? (
          sources.map((source) => (
            <IncomeSourceRowItem
              key={source.id}
              source={source}
              currency={currency}
              onEdit={() => {
                setEditingIncome(source);
                setSheet("income");
              }}
            />
          ))
        ) : (
          recurring.map((expense) => (
            <RecurringRowItem
              key={expense.id}
              expense={expense}
              currency={currency}
              categories={categories}
              onEdit={() => {
                setEditingRecurring(expense);
                setSheet("recurring");
              }}
            />
          ))
        )}
      </div>

      {!isIncome && (
        <p className="mt-3 flex items-start gap-2 rounded-control border border-dashed border-hairline-strong bg-paper px-3 py-2.5 text-caption text-ink-muted">
          <CheckCircle size={16} className="mt-0.5 shrink-0 text-positive" />
          ردیف‌های «خودکار» اول هر ماه یک‌بار ثبت می‌شوند — دو بار اجرا شدن، تراکنش
          تکراری نمی‌سازد.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 w-full"
        onClick={() => {
          setEditingIncome(null);
          setEditingRecurring(null);
          setSheet(tab);
        }}
      >
        <Plus size={18} />
        {isIncome ? "افزودن منبع درآمد" : "افزودن هزینه‌ی ثابت"}
      </Button>

      <IncomeSourceSheet
        open={sheet === "income"}
        onOpenChange={(open) => setSheet(open ? "income" : null)}
        currency={currency}
        source={editingIncome}
      />
      <RecurringSheet
        open={sheet === "recurring"}
        onOpenChange={(open) => setSheet(open ? "recurring" : null)}
        currency={currency}
        categories={categories}
        expense={editingRecurring}
      />
    </div>
  );
}
