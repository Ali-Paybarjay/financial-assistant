"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis } from "recharts";
import { Section } from "@/components/page";
import { formatMonthFa } from "@/lib/date";
import { toMajor, type CurrencyCode } from "@/lib/money";
import type { MonthPoint } from "@/lib/queries/transactions";

const INCOME_FILL = "#302c73";
const EXPENSE_FILL = "#b3b1dd";
const EXPENSE_STROKE = "#8886c5";

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
    <Section
      title="۶ ماه اخیر"
      action={
        <span className="flex items-center gap-3 text-micro text-ink-muted">
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
        </span>
      }
    >
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={3} margin={{ top: 4, bottom: 0 }}>
            {/* Time runs left to right even in an RTL page: the design puts the
                oldest month on the left, and an SVG axis does not flip with
                the document direction anyway. */}
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#585c74" }}
            />
            <Bar dataKey="income" fill={INCOME_FILL} radius={[3, 3, 0, 0]} maxBarSize={20} />
            <Bar dataKey="expense" radius={[3, 3, 0, 0]} maxBarSize={20}>
              {data.map((point) => (
                // A border, so the two series stay distinguishable in greyscale.
                <Cell key={point.label} fill={EXPENSE_FILL} stroke={EXPENSE_STROKE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
