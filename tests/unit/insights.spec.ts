import { describe, expect, it } from "vitest";
import { buildInsights, weekKey, type Insight } from "@/lib/insights";
import type { EnvelopeRow } from "@/lib/envelopes";
import type { GoalWithProgress } from "@/lib/goals";
import type { AccountRow } from "@/lib/supabase/database.types";

const TODAY = "2026-09-18";

/** A month with 17 days gone and 12 left, which is where TODAY sits. */
function base(over: Partial<Parameters<typeof buildInsights>[0]> = {}) {
  return {
    today: TODAY,
    month: { start: "2026-09-01", end: "2026-09-30", daysGone: 18, daysLeft: 12 },
    totals: {
      income: 0,
      expense: 0,
      unconfirmedCount: 0,
      oldestUnconfirmedAt: null,
    },
    previousWeek: 0,
    currentWeek: 0,
    envelopes: [] as EnvelopeRow[],
    goals: [] as GoalWithProgress[],
    accountsDue: [] as AccountRow[],
    missedRecurring: 0,
    dismissedKeys: new Set<string>(),
    monthlySurplus: 0,
    ...over,
  };
}

function envelope(over: Partial<EnvelopeRow> = {}): EnvelopeRow {
  return {
    category_id: "cat-1",
    name_fa: "خوراک",
    cost_kind: "variable",
    budget_minor: 100_000,
    spent_minor: 0,
    remaining_minor: 100_000,
    unconfirmed_minor: 0,
    baseline_minor: null,
    ...over,
  };
}

function goal(over: Partial<GoalWithProgress> = {}): GoalWithProgress {
  return {
    id: "goal-1",
    user_id: "user-1",
    title: "سفر تابستان",
    type: "travel",
    target_amount: 120_000,
    opening_saved: 0,
    target_date: "2026-12-01",
    priority: 0,
    status: "active",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    saved: 0,
    funded: 0,
    spent: 0,
    ...over,
  };
}

function account(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: "acct-1",
    user_id: "user-1",
    title: "چکینگ TD",
    kind: "checking",
    currency: "CAD",
    opening_balance: 0,
    opening_balance_on: "2026-09-01",
    institution: null,
    reference: null,
    is_default: true,
    is_active: true,
    sort_order: 0,
    last_reconciled_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  } as AccountRow;
}

const rules = (insights: Insight[]) => insights.map((insight) => insight.rule);

describe("buildInsights", () => {
  it("says nothing about an empty ledger", () => {
    // «Everything looks fine» is not an insight. It is a sentence written to
    // fill a screen, and it teaches people to stop reading the ones that
    // matter.
    expect(buildInsights(base())).toEqual([]);
  });

  it("ranks what can be acted on above what is merely true", () => {
    const insights = buildInsights(
      base({
        missedRecurring: 1,
        totals: {
          income: 500_000,
          expense: 100_000,
          unconfirmedCount: 2,
          oldestUnconfirmedAt: "2026-09-10T00:00:00Z",
        },
        previousWeek: 10_000,
        currentWeek: 20_000,
      }),
    );

    // Until the missing bill and the unconfirmed guesses are settled, the
    // month's totals are provisional — so a sentence about this week's
    // spending cannot outrank the warning that it is not all in yet.
    expect(rules(insights).slice(0, 2)).toEqual([
      "recurring_missed",
      "unconfirmed_backlog",
    ]);
  });
});

describe("recurring_missed", () => {
  it("fires as soon as one bill is missing", () => {
    expect(rules(buildInsights(base({ missedRecurring: 1 })))).toContain(
      "recurring_missed",
    );
    expect(rules(buildInsights(base({ missedRecurring: 0 })))).not.toContain(
      "recurring_missed",
    );
  });

  it("goes away when dismissed", () => {
    const insights = buildInsights(
      base({
        missedRecurring: 1,
        dismissedKeys: new Set(["recurring_missed:2026-09"]),
      }),
    );
    expect(rules(insights)).not.toContain("recurring_missed");
  });
});

describe("unconfirmed_backlog", () => {
  it("waits until the oldest guess is two days old", () => {
    const totals = (oldestUnconfirmedAt: string) => ({
      income: 0,
      expense: 0,
      unconfirmedCount: 1,
      oldestUnconfirmedAt,
    });

    // Yesterday is 24 hours: not yet a backlog, just a thing from yesterday.
    expect(
      rules(buildInsights(base({ totals: totals("2026-09-17T09:00:00Z") }))),
    ).not.toContain("unconfirmed_backlog");
    expect(
      rules(buildInsights(base({ totals: totals("2026-09-16T09:00:00Z") }))),
    ).toContain("unconfirmed_backlog");
  });

  it("goes away when dismissed", () => {
    const insights = buildInsights(
      base({
        totals: {
          income: 0,
          expense: 0,
          unconfirmedCount: 1,
          oldestUnconfirmedAt: "2026-09-16T09:00:00Z",
        },
        dismissedKeys: new Set([`unconfirmed_backlog:${TODAY}`]),
      }),
    );
    expect(rules(insights)).not.toContain("unconfirmed_backlog");
  });
});

describe("envelope_over", () => {
  it("fires the moment the ceiling is passed, and not while it is merely met", () => {
    const at = envelope({ spent_minor: 100_000, remaining_minor: 0 });
    const past = envelope({ spent_minor: 100_001, remaining_minor: -1 });

    expect(rules(buildInsights(base({ envelopes: [at] })))).not.toContain(
      "envelope_over",
    );
    expect(rules(buildInsights(base({ envelopes: [past] })))).toContain(
      "envelope_over",
    );
  });

  it("goes away when dismissed, per category and per month", () => {
    const insights = buildInsights(
      base({
        envelopes: [envelope({ spent_minor: 200_000, remaining_minor: -100_000 })],
        dismissedKeys: new Set(["envelope_over:cat-1:2026-09"]),
      }),
    );
    expect(rules(insights)).not.toContain("envelope_over");
  });
});

describe("envelope_tight", () => {
  it("needs a week left to be worth saying", () => {
    const tight = envelope({ spent_minor: 90_000, remaining_minor: 10_000 });

    // Six days left: «روزی چقدر» is no longer advice anyone can act on.
    expect(
      rules(
        buildInsights(
          base({
            envelopes: [tight],
            month: {
              start: "2026-09-01",
              end: "2026-09-30",
              daysGone: 24,
              daysLeft: 6,
            },
          }),
        ),
      ),
    ).not.toContain("envelope_tight");

    expect(rules(buildInsights(base({ envelopes: [tight] })))).toContain(
      "envelope_tight",
    );
  });

  it("goes away when dismissed, per category and per week", () => {
    const insights = buildInsights(
      base({
        envelopes: [envelope({ spent_minor: 90_000, remaining_minor: 10_000 })],
        dismissedKeys: new Set([`envelope_tight:cat-1:${weekKey(TODAY)}`]),
      }),
    );
    expect(rules(insights)).not.toContain("envelope_tight");
  });
});

describe("pace_over", () => {
  it("stays quiet until enough of the month has happened", () => {
    const spending = {
      income: 300_000,
      expense: 200_000,
      unconfirmedCount: 0,
      oldestUnconfirmedAt: null,
    };

    // Day four. One large shop would read as a catastrophe.
    expect(
      rules(
        buildInsights(
          base({
            totals: spending,
            month: {
              start: "2026-09-01",
              end: "2026-09-30",
              daysGone: 4,
              daysLeft: 26,
            },
          }),
        ),
      ),
    ).not.toContain("pace_over");

    expect(
      rules(
        buildInsights(
          base({
            totals: spending,
            month: {
              start: "2026-09-01",
              end: "2026-09-30",
              daysGone: 5,
              daysLeft: 25,
            },
          }),
        ),
      ),
    ).toContain("pace_over");
  });

  it("tolerates being slightly ahead rather than nagging", () => {
    // Spending exactly the day's share is not news; 15% over it is.
    const steady = {
      income: 300_000,
      expense: 150_000,
      unconfirmedCount: 0,
      oldestUnconfirmedAt: null,
    };
    expect(
      rules(
        buildInsights(
          base({
            totals: steady,
            month: {
              start: "2026-09-01",
              end: "2026-09-30",
              daysGone: 15,
              daysLeft: 15,
            },
          }),
        ),
      ),
    ).not.toContain("pace_over");
  });

  it("goes away when dismissed", () => {
    const insights = buildInsights(
      base({
        totals: {
          income: 300_000,
          expense: 200_000,
          unconfirmedCount: 0,
          oldestUnconfirmedAt: null,
        },
        dismissedKeys: new Set(["pace_over:2026-09"]),
      }),
    );
    expect(rules(insights)).not.toContain("pace_over");
  });
});

describe("goal_at_risk", () => {
  it("fires when the monthly share no longer fits the surplus", () => {
    // 120_000 over three months is 40_000 a month.
    expect(
      rules(buildInsights(base({ goals: [goal()], monthlySurplus: 40_000 }))),
    ).not.toContain("goal_at_risk");
    expect(
      rules(buildInsights(base({ goals: [goal()], monthlySurplus: 39_999 }))),
    ).toContain("goal_at_risk");
  });

  it("goes away when dismissed, per goal and per month", () => {
    const insights = buildInsights(
      base({
        goals: [goal()],
        monthlySurplus: 0,
        dismissedKeys: new Set(["goal_at_risk:goal-1:2026-09"]),
      }),
    );
    expect(rules(insights)).not.toContain("goal_at_risk");
  });
});

describe("statement_due", () => {
  it("fires for each account still waiting on a statement", () => {
    expect(rules(buildInsights(base({ accountsDue: [account()] })))).toContain(
      "statement_due",
    );
    expect(rules(buildInsights(base({ accountsDue: [] })))).not.toContain(
      "statement_due",
    );
  });

  it("goes away when dismissed, per account and per month", () => {
    const insights = buildInsights(
      base({
        accountsDue: [account()],
        dismissedKeys: new Set(["statement_due:acct-1:2026-09"]),
      }),
    );
    expect(rules(insights)).not.toContain("statement_due");
  });
});

describe("weekly_delta", () => {
  it("needs a 15% move before it is worth a sentence", () => {
    const at = buildInsights(base({ previousWeek: 100_000, currentWeek: 114_999 }));
    const past = buildInsights(base({ previousWeek: 100_000, currentWeek: 115_000 }));

    expect(rules(at)).not.toContain("weekly_delta");
    expect(rules(past)).toContain("weekly_delta");
  });

  it("speaks for a fall as well as a rise", () => {
    const insights = buildInsights(base({ previousWeek: 100_000, currentWeek: 50_000 }));
    const delta = insights.find((insight) => insight.rule === "weekly_delta");
    expect(delta?.parts.at(-1)).toEqual({
      kind: "text",
      value: " کمتر از هفتهٔ قبل.",
    });
  });

  it("says nothing when there is no previous week to compare against", () => {
    // Dividing by a week with no spending in it is not a 100% rise; it is a
    // first week.
    expect(
      rules(buildInsights(base({ previousWeek: 0, currentWeek: 50_000 }))),
    ).not.toContain("weekly_delta");
  });

  it("goes away when dismissed, per week", () => {
    const insights = buildInsights(
      base({
        previousWeek: 100_000,
        currentWeek: 200_000,
        dismissedKeys: new Set([`weekly_delta:${weekKey(TODAY)}`]),
      }),
    );
    expect(rules(insights)).not.toContain("weekly_delta");
  });
});

describe("weekKey", () => {
  it("holds steady across a week so a dismissal lasts one", () => {
    // Monday to Sunday of the same ISO week.
    expect(weekKey("2026-09-14")).toBe(weekKey("2026-09-20"));
    expect(weekKey("2026-09-14")).not.toBe(weekKey("2026-09-21"));
  });

  it("gives a week its year from the Thursday it contains", () => {
    // 2026-12-31 is a Thursday, so its week belongs to 2026.
    expect(weekKey("2026-12-31")).toBe("2026-W53");
  });
});
