import { describe, expect, it } from "vitest";
import {
  byFeature,
  byStatus,
  failureRate,
  seconds,
  usageByDay,
  usageTotals,
} from "@/lib/admin/reports";
import { isFailure, statusTone } from "@/lib/admin/status";
import type { AdminAiDayRow } from "@/lib/supabase/database.types";

function row(overrides: Partial<AdminAiDayRow>): AdminAiDayRow {
  return {
    day: "2026-09-25",
    feature: "parse_text",
    status: "ok",
    model: "anthropic/claude-sonnet-5",
    calls: 1,
    cost_cents: 0,
    input_tokens: 0,
    output_tokens: 0,
    ...overrides,
  };
}

describe("usageTotals", () => {
  it("is zero for an empty window", () => {
    expect(usageTotals([])).toEqual({
      calls: 0,
      costCents: 0,
      inputTokens: 0,
      outputTokens: 0,
      failed: 0,
      rejected: 0,
    });
  });

  it("sums calls, cost and tokens across buckets", () => {
    const totals = usageTotals([
      row({ calls: 10, cost_cents: 4, input_tokens: 100, output_tokens: 20 }),
      row({ feature: "parse_receipt", calls: 3, cost_cents: 9, input_tokens: 900, output_tokens: 40 }),
    ]);

    expect(totals.calls).toBe(13);
    expect(totals.costCents).toBe(13);
    expect(totals.inputTokens).toBe(1000);
    expect(totals.outputTokens).toBe(60);
  });

  it("counts the four failure statuses as failures and nothing else", () => {
    const totals = usageTotals([
      row({ status: "ok", calls: 90 }),
      row({ status: "timeout", calls: 3 }),
      row({ status: "provider", calls: 2 }),
      row({ status: "malformed", calls: 1 }),
      row({ status: "rate_limit", calls: 4 }),
      row({ status: "rejected", calls: 20 }),
    ]);

    expect(totals.failed).toBe(10);
    expect(totals.rejected).toBe(20);
    expect(totals.calls).toBe(120);
  });
});

describe("failureRate", () => {
  it("leaves rejections out of both halves", () => {
    // `rejected` is the ceiling doing its job, not an outage. Counting it would
    // make a healthy day with one busy guest look like a bad one.
    const totals = usageTotals([
      row({ status: "ok", calls: 90 }),
      row({ status: "timeout", calls: 10 }),
      row({ status: "rejected", calls: 900 }),
    ]);

    expect(failureRate(totals)).toBe(10);
  });

  it("is null when nothing was attempted", () => {
    expect(failureRate(usageTotals([]))).toBeNull();
    expect(failureRate(usageTotals([row({ status: "rejected", calls: 5 })]))).toBeNull();
  });

  it("keeps one decimal", () => {
    const totals = usageTotals([
      row({ status: "ok", calls: 997 }),
      row({ status: "timeout", calls: 3 }),
    ]);
    expect(failureRate(totals)).toBe(0.3);
  });
});

describe("usageByDay", () => {
  const days = ["2026-09-23", "2026-09-24", "2026-09-25"];

  it("keeps a point for every day in the axis, including the empty ones", () => {
    // A chart built only from days that have rows spaces them evenly and turns
    // a quiet week into a busy one.
    const points = usageByDay([row({ day: "2026-09-25", calls: 4 })], days);

    expect(points.map((point) => point.day)).toEqual(days);
    expect(points[0]).toEqual({ day: "2026-09-23", ok: 0, rejected: 0, failed: 0, costCents: 0 });
    expect(points[2].ok).toBe(4);
  });

  it("splits a day's calls into ok, rejected and failed", () => {
    const points = usageByDay(
      [
        row({ day: "2026-09-24", status: "ok", calls: 8, cost_cents: 3 }),
        row({ day: "2026-09-24", status: "rejected", calls: 2 }),
        row({ day: "2026-09-24", status: "timeout", calls: 1, cost_cents: 1 }),
      ],
      days,
    );

    expect(points[1]).toEqual({
      day: "2026-09-24",
      ok: 8,
      rejected: 2,
      failed: 1,
      costCents: 4,
    });
  });

  it("drops a row outside the axis rather than inventing a bar for it", () => {
    const points = usageByDay([row({ day: "2026-01-01", calls: 99 })], days);
    expect(points.every((point) => point.ok === 0)).toBe(true);
    expect(points).toHaveLength(3);
  });
});

describe("grouping", () => {
  const rows = [
    row({ feature: "parse_text", calls: 50 }),
    row({ feature: "parse_statement", calls: 5, cost_cents: 600 }),
    row({ feature: "parse_receipt", calls: 20, cost_cents: 500 }),
  ];

  it("orders buckets by call count, biggest first", () => {
    expect(byFeature(rows).map((bucket) => bucket.key)).toEqual([
      "parse_text",
      "parse_receipt",
      "parse_statement",
    ]);
  });

  it("keeps each bucket's own totals", () => {
    const statement = byFeature(rows).find((bucket) => bucket.key === "parse_statement");
    expect(statement?.totals.costCents).toBe(600);
    expect(statement?.totals.calls).toBe(5);
  });

  it("groups by status too", () => {
    const buckets = byStatus([
      row({ status: "ok", calls: 3 }),
      row({ status: "ok", feature: "parse_receipt", calls: 2 }),
      row({ status: "timeout", calls: 1 }),
    ]);

    expect(buckets[0]).toEqual({ key: "ok", totals: expect.objectContaining({ calls: 5 }) });
  });
});

describe("seconds", () => {
  it("turns milliseconds into one decimal of a second", () => {
    expect(seconds(4326)).toBe(4.3);
    expect(seconds(31_200)).toBe(31.2);
    expect(seconds(0)).toBe(0);
  });

  it("passes null through — «no measurement» is not zero", () => {
    expect(seconds(null)).toBeNull();
  });
});

describe("status vocabulary", () => {
  it("treats rejected as provisional, not as a failure", () => {
    expect(isFailure("rejected")).toBe(false);
    expect(statusTone("rejected")).toBe("wait");
  });

  it("agrees with the four statuses admin_overview counts in SQL", () => {
    for (const status of ["timeout", "rate_limit", "provider", "malformed"]) {
      expect(isFailure(status)).toBe(true);
    }
  });

  it("gives a status it has never seen a harmless tone", () => {
    expect(statusTone("something_new")).toBe("mute");
    expect(statusTone(null)).toBe("mute");
  });
});
