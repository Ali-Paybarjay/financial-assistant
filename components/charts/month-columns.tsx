"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis } from "recharts";

export type MonthColumn = { label: string; income: number; expense: number };

/**
 * Income and spending per month, as paired columns.
 *
 * Split out from <MonthBars> for one reason: this file imports recharts and that
 * one does not, so the heading, the legend and the card around them render with
 * the page while the drawing arrives behind the lazy boundary in ./lazy.tsx. The
 * chart is inside a collapsed `<details>` on the dashboard now, so on most loads
 * it is never drawn at all.
 */
export function MonthColumns({
  data,
  incomeFill,
  expenseFill,
  expenseStroke,
}: {
  data: MonthColumn[];
  incomeFill: string;
  expenseFill: string;
  expenseStroke: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={2} margin={{ top: 4, bottom: 0 }}>
        {/* Time runs left to right even in an RTL page: the design puts the
            oldest month on the left, and an SVG axis does not flip with the
            document direction anyway. */}
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
        />
        <Bar dataKey="income" fill={incomeFill} radius={[2, 2, 0, 0]} maxBarSize={9} />
        <Bar dataKey="expense" radius={[2, 2, 0, 0]} maxBarSize={9}>
          {data.map((point) => (
            // A border, so the two series stay distinguishable in greyscale.
            <Cell key={point.label} fill={expenseFill} stroke={expenseStroke} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
