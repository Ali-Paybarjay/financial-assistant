"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { faNumber } from "@/lib/format";
import { formatDayMonthFa } from "@/lib/date";
import { CHART_RAMP } from "@/lib/chart-colors";

/**
 * Model calls per day, stacked by outcome.
 *
 * `ok` and `rejected` and `failed` rather than one bar: the three answer
 * different questions, and the point of the chart is that the *mix* is what
 * changes on a bad day. A day made entirely of rejections is a ceiling being
 * hit repeatedly, which looks identical to a busy day in a single-series chart.
 *
 * Client-only, because Recharts is. The page stays a server component and hands
 * it a plain array — nothing here fetches.
 *
 * The tooltip is hand-built. Recharts' default one paints a white card with
 * inline styles, which is invisible against `--surface` in the dark theme and
 * which `pnpm check:theme` cannot see because the colour never appears in this
 * repo. Same reason every fill below comes from CHART_RAMP.
 */

const OK_FILL = CHART_RAMP[0];
const REJECTED_FILL = CHART_RAMP[3];
const FAILED_FILL = "var(--negative)";

export type UsagePoint = {
  day: string;
  ok: number;
  rejected: number;
  failed: number;
};

type TooltipPayload = {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string }[];
};

function ChartTooltip({ active, label, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, item) => sum + (item.value ?? 0), 0);

  return (
    <div className="rounded-control border border-hairline bg-surface px-2.5 py-2 shadow-lift">
      <p className="mb-1 text-micro text-ink-muted">
        {typeof label === "string" ? formatDayMonthFa(label) : label}
      </p>
      {payload
        .filter((item) => (item.value ?? 0) > 0)
        .map((item) => (
          <p key={item.name} className="flex items-center gap-1.5 text-caption text-ink">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: item.color }}
            />
            {item.name}: {faNumber(item.value ?? 0)}
          </p>
        ))}
      <p className="mt-1 border-t border-hairline pt-1 text-micro text-ink-muted">
        همه: {faNumber(total)}
      </p>
    </div>
  );
}

export function UsageChart({ points }: { points: UsagePoint[] }) {
  // Only every nth label, or thirty dates overlap into a grey smear.
  const step = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          {/* Time runs left to right even in an RTL page: the design puts the
              oldest day on the left, and an SVG axis does not flip with the
              document direction anyway. Same call as <MonthBars>. */}
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            interval={step - 1}
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
            tickFormatter={(day: string) => formatDayMonthFa(day)}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={34}
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
            tickFormatter={(value: number) => faNumber(value)}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "var(--action-tint)" }}
          />
          <Bar dataKey="ok" name="سالم" stackId="calls" fill={OK_FILL} maxBarSize={18} />
          <Bar
            dataKey="rejected"
            name="سقف"
            stackId="calls"
            fill={REJECTED_FILL}
            maxBarSize={18}
          />
          <Bar
            dataKey="failed"
            name="خطا"
            stackId="calls"
            fill={FAILED_FILL}
            radius={[2, 2, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The key. Outside the chart, because Recharts' own <Legend> injects colours. */
export function UsageLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-micro text-ink-muted">
      <Key color={OK_FILL} label="سالم" />
      <Key color={REJECTED_FILL} label="سقف یا خاموش" />
      <Key color={FAILED_FILL} label="خطا" />
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden
        className="size-2 rounded-[2px]"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
