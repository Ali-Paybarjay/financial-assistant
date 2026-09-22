"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis } from "recharts";
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

      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 4, bottom: 0 }}>
            {/* Time runs left to right even in an RTL page: the design puts the
                oldest month on the left, and an SVG axis does not flip with
                the document direction anyway. */}
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#5c6573" }}
            />
            <Bar dataKey="income" fill={INCOME_FILL} radius={[2, 2, 0, 0]} maxBarSize={9} />
            <Bar dataKey="expense" radius={[2, 2, 0, 0]} maxBarSize={9}>
              {data.map((point) => (
                // A border, so the two series stay distinguishable in greyscale.
                <Cell key={point.label} fill={EXPENSE_FILL} stroke={EXPENSE_STROKE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
