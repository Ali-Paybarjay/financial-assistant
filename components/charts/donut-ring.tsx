"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export type RingSlice = { key: string; amount: number; fill: string };

/**
 * The ring, and nothing else.
 *
 * Three screens draw the same donut — spending by category on the ledger,
 * spending by tag on a trip's report — and each one used to import recharts
 * directly. Recharts is the largest thing in this app's client bundle by a
 * distance, and none of these charts is the reason anybody opened the page: the
 * ledger's donut sits below the rows, and the trip's below the settlement plan.
 *
 * So the recharts import lives here, alone, behind the lazy boundary in
 * ./lazy.tsx — the labels, the legend, the accessible table and the numbers
 * beside it all stay in the component that owns them and render immediately.
 * What arrives late is the drawing.
 */
export function DonutRing({
  slices,
  /** «var(--surface)» separates touching slices on a card; «none» for a fill. */
  stroke = "none",
  strokeWidth,
}: {
  slices: RingSlice[];
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={slices}
          dataKey="amount"
          innerRadius={36}
          outerRadius={59}
          paddingAngle={1.6}
          stroke={stroke}
          strokeWidth={strokeWidth}
          isAnimationActive={false}
        >
          {slices.map((slice) => (
            <Cell key={slice.key} fill={slice.fill} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
