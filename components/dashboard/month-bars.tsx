"use client";

import { MonthColumns } from "@/components/charts/lazy";
import { formatMonthFa } from "@/lib/date";
import { toMajor, type CurrencyCode } from "@/lib/money";
import type { MonthPoint } from "@/lib/queries/transactions";
import { CHART_RAMP } from "@/lib/chart-colors";

const INCOME_FILL = CHART_RAMP[0];
const EXPENSE_FILL = CHART_RAMP[4];
const EXPENSE_STROKE = CHART_RAMP[3];

export function MonthBars({
  series,
  currency,
}: {
  series: MonthPoint[];
  currency: CurrencyCode;
}) {
  const data = series.map((point) => ({
    label: formatMonthFa(point.month).split(" ")[0],
    income: toMajor(point.income, currency),
    expense: toMajor(point.expense, currency),
  }));

  return (
    <section className="rounded-card border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">۶ ماه اخیر</h2>
        <div className="flex items-center gap-3 text-micro text-ink-muted">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-[2px]" style={{ background: INCOME_FILL }} />
            درآمد
          </span>
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-[2px] border"
              style={{ background: EXPENSE_FILL, borderColor: EXPENSE_STROKE }}
            />
            هزینه
          </span>
        </div>
      </div>

      {/* The drawing arrives behind a lazy boundary; the heading and legend
          above it do not. See components/charts/lazy.tsx. */}
      <div className="h-[110px]">
        <MonthColumns
          data={data}
          incomeFill={INCOME_FILL}
          expenseFill={EXPENSE_FILL}
          expenseStroke={EXPENSE_STROKE}
        />
      </div>
    </section>
  );
}
