"use client";

import { useTransition } from "react";
import { ArrowsClockwise, PencilSimple, Wallet } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/lib/money";
import {
  FREQUENCY_OPTIONS,
  MONTH_OPTIONS,
  RECURRING_FREQUENCY_LABEL,
} from "@/lib/onboarding/config";
import type {
  CategoryRow,
  IncomeSourceRow,
  RecurringExpenseRow,
} from "@/lib/supabase/database.types";
import { setRecordActive } from "./actions";

const FREQUENCY_LABEL = new Map<string, string>(
  FREQUENCY_OPTIONS.map((option) => [option.value, option.label]),
);

function ActiveToggle({
  table,
  id,
  isActive,
  label,
}: {
  table: "income_sources" | "recurring_expenses";
  id: string;
  isActive: boolean;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={label}
      disabled={isPending}
      onClick={() => startTransition(async () => void (await setRecordActive(table, id, !isActive)))}
      className={cn(
        "relative h-[22px] w-10 shrink-0 rounded-full transition-colors disabled:opacity-50",
        isActive ? "bg-action" : "bg-hairline-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-4 rounded-full bg-white transition-all",
          // start/end rather than left/right: the knob must travel toward the
          // reading direction, which flips with the document.
          isActive ? "end-[3px]" : "start-[3px]",
        )}
      />
    </button>
  );
}

function RowShell({
  icon,
  title,
  meta,
  amount,
  isActive,
  toggle,
  onEdit,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  amount: React.ReactNode;
  isActive: boolean;
  toggle: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-hairline p-3 last:border-b-0",
        !isActive && "opacity-55",
      )}
    >
      <span className="flex size-[34px] shrink-0 items-center justify-center text-ink-faint">
        {icon}
      </span>

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 flex-col items-start text-start"
      >
        <span className="flex items-center gap-1.5 truncate text-[14px] font-medium text-ink">
          {title}
          <PencilSimple size={13} className="shrink-0 text-ink-faint" />
        </span>
        <span className="truncate text-caption text-ink-muted">{meta}</span>
      </button>

      {amount}
      {toggle}
    </div>
  );
}

export function IncomeSourceRowItem({
  source,
  currency,
  onEdit,
}: {
  source: IncomeSourceRow;
  currency: CurrencyCode;
  onEdit: () => void;
}) {
  return (
    <RowShell
      icon={<Wallet size={18} />}
      title={source.title}
      meta={[
        FREQUENCY_LABEL.get(source.frequency) ?? source.frequency,
        source.is_active ? null : "غیرفعال",
      ]
        .filter(Boolean)
        .join(" · ")}
      amount={<Money minor={source.amount} currency={currency} size="row" />}
      isActive={source.is_active}
      onEdit={onEdit}
      toggle={
        <ActiveToggle
          table="income_sources"
          id={source.id}
          isActive={source.is_active}
          label={`فعال بودن ${source.title}`}
        />
      }
    />
  );
}

export function RecurringRowItem({
  expense,
  currency,
  categories,
  onEdit,
}: {
  expense: RecurringExpenseRow;
  currency: CurrencyCode;
  categories: CategoryRow[];
  onEdit: () => void;
}) {
  const category = categories.find((entry) => entry.id === expense.category_id);

  return (
    <RowShell
      icon={<ArrowsClockwise size={18} />}
      title={expense.title}
      meta={[
        // Was hardcoded to «ماهانه» back when nothing could be anything else.
        // A yearly premium listed as monthly is a twelvefold lie about what
        // the month costs.
        RECURRING_FREQUENCY_LABEL.get(expense.frequency) ?? "ماهانه",
        // A day alone does not locate a bill that is not due every month.
        expense.due_month
          ? `${MONTH_OPTIONS[expense.due_month - 1]?.label} ${faNumber(expense.due_day)}`
          : `روز ${faNumber(expense.due_day)}`,
        expense.auto_post ? "خودکار" : "دستی",
        category?.name_fa,
        expense.is_active ? null : "غیرفعال",
      ]
        .filter(Boolean)
        .join(" · ")}
      amount={<Money minor={expense.amount} currency={currency} size="row" />}
      isActive={expense.is_active}
      onEdit={onEdit}
      toggle={
        <ActiveToggle
          table="recurring_expenses"
          id={expense.id}
          isActive={expense.is_active}
          label={`فعال بودن ${expense.title}`}
        />
      }
    />
  );
}
