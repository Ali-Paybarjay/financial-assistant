/**
 * The AI page's arithmetic, as pure functions.
 *
 * `admin_ai_usage_daily` returns one row per (day, feature, status, model) and
 * the page wants four different shapes of it. Doing that in SQL would mean four
 * functions over one table that have to agree with each other about what counts
 * as a failure; doing it here means one query, one definition, and tests that
 * need no database.
 *
 * Nothing in this module does I/O, and nothing in it knows about React.
 */

import { isFailure } from "./status";
import type { AdminAiDayRow } from "@/lib/supabase/database.types";

export type UsageTotals = {
  calls: number;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  /** The four statuses that mean the call went wrong. */
  failed: number;
  /** Refused before spending: over the ceiling, or the model switched off. */
  rejected: number;
};

const ZERO: UsageTotals = {
  calls: 0,
  costCents: 0,
  inputTokens: 0,
  outputTokens: 0,
  failed: 0,
  rejected: 0,
};

function add(into: UsageTotals, row: AdminAiDayRow): UsageTotals {
  return {
    calls: into.calls + row.calls,
    costCents: into.costCents + row.cost_cents,
    inputTokens: into.inputTokens + row.input_tokens,
    outputTokens: into.outputTokens + row.output_tokens,
    failed: into.failed + (isFailure(row.status) ? row.calls : 0),
    rejected: into.rejected + (row.status === "rejected" ? row.calls : 0),
  };
}

export function usageTotals(rows: readonly AdminAiDayRow[]): UsageTotals {
  return rows.reduce(add, ZERO);
}

/**
 * The failure rate, as a percentage of calls, to one decimal.
 *
 * `rejected` is left out of both halves. It is not a failure — it is the
 * ceiling doing its job — and counting it would make a healthy day with a busy
 * guest look like an outage.
 */
export function failureRate(totals: UsageTotals): number | null {
  const attempted = totals.calls - totals.rejected;
  if (attempted <= 0) return null;
  return Math.round((totals.failed / attempted) * 1000) / 10;
}

export type UsageBucket = { key: string; totals: UsageTotals };

/** Grouped by one field, biggest first. */
function groupBy(
  rows: readonly AdminAiDayRow[],
  field: (row: AdminAiDayRow) => string,
): UsageBucket[] {
  const buckets = new Map<string, UsageTotals>();
  for (const row of rows) {
    buckets.set(field(row), add(buckets.get(field(row)) ?? ZERO, row));
  }
  return [...buckets.entries()]
    .map(([key, totals]) => ({ key, totals }))
    .sort((a, b) => b.totals.calls - a.totals.calls);
}

export const byFeature = (rows: readonly AdminAiDayRow[]) =>
  groupBy(rows, (row) => row.feature);

export const byModel = (rows: readonly AdminAiDayRow[]) =>
  groupBy(rows, (row) => row.model);

export const byStatus = (rows: readonly AdminAiDayRow[]) =>
  groupBy(rows, (row) => row.status);

export type UsageDay = {
  day: string;
  ok: number;
  rejected: number;
  failed: number;
  costCents: number;
};

/**
 * One point per day across the whole window, including the days nothing
 * happened.
 *
 * The gaps matter: a bar chart built only from days that have rows spaces them
 * evenly and turns a quiet week into a busy one. `days` is the axis, generated
 * by the caller from the range it asked for, so the chart's width means the
 * same thing whether or not the model was used.
 */
export function usageByDay(
  rows: readonly AdminAiDayRow[],
  days: readonly string[],
): UsageDay[] {
  const seeded = new Map<string, UsageDay>(
    days.map((day) => [day, { day, ok: 0, rejected: 0, failed: 0, costCents: 0 }]),
  );

  for (const row of rows) {
    // A row outside the axis is a timezone edge, not data to drop silently —
    // but it has nowhere to go on this chart, so it is left out of it and still
    // counted by usageTotals(), which reads the same rows.
    const point = seeded.get(row.day);
    if (!point) continue;

    point.costCents += row.cost_cents;
    if (row.status === "ok") point.ok += row.calls;
    else if (row.status === "rejected") point.rejected += row.calls;
    else if (isFailure(row.status)) point.failed += row.calls;
  }

  return days.map((day) => seeded.get(day)!);
}

/** Seconds, to one decimal — milliseconds are not a number anyone reads. */
export function seconds(ms: number | null): number | null {
  if (ms === null) return null;
  return Math.round(ms / 100) / 10;
}
