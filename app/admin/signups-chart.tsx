"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { faNumber } from "@/lib/format";
import { formatDayMonthFa } from "@/lib/date";
import { CHART_RAMP } from "@/lib/chart-colors";

/**
 * New accounts per day, guests and registered kept apart.
 *
 * Added together they are neither number: one is interest, the other is
 * adoption, and a single bar hides the case that actually matters — a spike made
 * entirely of guests, which is what an abuse run looks like from here.
 *
 * Client-only because Recharts is; the page hands it a plain array. The tooltip
 * is hand-built for the same reason as <UsageChart>'s: Recharts' default paints
 * a white card inline, invisible on `--surface` in the dark theme and invisible
 * to `pnpm check:theme` as well.
 */

const REGISTERED_FILL = CHART_RAMP[0];
const GUEST_FILL = CHART_RAMP[3];

export type SignupPoint = { day: string; guests: number; registered: number };

type TooltipPayload = {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string }[];
};

function ChartTooltip({ active, label, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-control border border-hairline bg-surface px-2.5 py-2 shadow-lift">
      <p className="mb-1 text-micro text-ink-muted">
        {typeof label === "string" ? formatDayMonthFa(label) : label}
      </p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-1.5 text-caption text-ink">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-[2px]"
            style={{ background: item.color }}
          />
          {item.name}: {faNumber(item.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

export function SignupsChart({ points }: { points: SignupPoint[] }) {
  const step = Math.max(1, Math.ceil(points.length / 5));

  return (
    <>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} barGap={2} margin={{ top: 4, bottom: 0 }}>
            {/* Oldest on the left. An SVG axis does not flip with `dir`. */}
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              interval={step - 1}
              tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
              tickFormatter={(day: string) => formatDayMonthFa(day)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--action-tint)" }} />
            <Bar
              dataKey="registered"
              name="ثبت‌نامی"
              fill={REGISTERED_FILL}
              radius={[2, 2, 0, 0]}
              maxBarSize={10}
            />
            <Bar
              dataKey="guests"
              name="مهمان"
              fill={GUEST_FILL}
              radius={[2, 2, 0, 0]}
              maxBarSize={10}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-micro text-ink-muted">
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ background: REGISTERED_FILL }}
          />
          ثبت‌نامی
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ background: GUEST_FILL }}
          />
          مهمان
        </span>
      </div>
    </>
  );
}
