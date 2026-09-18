import { describe, expect, it } from "vitest";
import {
  checkSavings,
  contributionMonths,
  planSavings,
  type GoalWithProgress,
} from "@/lib/goals";
import { declaredSurplus, monthlySurplus, observedSurplus } from "@/lib/cashflow";
import type {
  IncomeSourceRow,
  RecurringExpenseRow,
  VariableExpenseBaselineRow,
} from "@/lib/supabase/database.types";

const TODAY = "2026-09-18";

/**
 * `saved` is what the ledger says is set aside right now, which is the only
 * figure the plan measures against. `opening_saved` is just where it started.
 */
function goal(over: Partial<GoalWithProgress> = {}): GoalWithProgress {
  return {
    id: "goal-1",
    user_id: "user-1",
    title: "سفر تابستان",
    type: "travel",
    target_amount: 120_000,
    opening_saved: 0,
    target_date: null,
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

describe("contributionMonths", () => {
  it("does not count the running month", () => {
    // Opened on the 18th, the money for September is already spoken for.
    // October, November and December are what is left.
    expect(contributionMonths(TODAY, "2026-12-15")).toBe(3);
  });

  it("counts a month boundary, not thirty-day blocks", () => {
    // Two days apart, but a different month: one payday still to come.
    expect(contributionMonths("2026-09-30", "2026-10-01")).toBe(1);
  });

  it("is zero for a date inside the running month", () => {
    expect(contributionMonths(TODAY, "2026-09-30")).toBe(0);
  });
});

describe("planSavings", () => {
  it("says what the date costs per month", () => {
    const plan = planSavings(
      [goal({ target_amount: 120_000, target_date: "2026-12-31" })],
      50_000,
      TODAY,
    );

    // 120,000 over October, November and December.
    expect(plan.goals[0].monthsLeft).toBe(3);
    expect(plan.goals[0].required).toBe(40_000);
    expect(plan.goals[0].allocated).toBe(40_000);
    expect(plan.goals[0].standing).toBe("on_track");
    expect(plan.shortfall).toBe(0);
    expect(plan.unassigned).toBe(10_000);
  });

  it("counts what is already saved against the target", () => {
    const plan = planSavings(
      [goal({ target_amount: 120_000, saved: 90_000, target_date: "2026-12-31" })],
      50_000,
      TODAY,
    );

    expect(plan.goals[0].remaining).toBe(30_000);
    expect(plan.goals[0].required).toBe(10_000);
  });

  it("rounds the monthly figure up", () => {
    // 100 over 3 months is 33.33. Asking for 33 lands a unit short at the
    // deadline, which is the one outcome the whole feature exists to avoid.
    const plan = planSavings(
      [goal({ target_amount: 100, target_date: "2026-12-31" })],
      100,
      TODAY,
    );

    expect(plan.goals[0].required).toBe(34);
  });

  it("charges a deadline inside the running month in full", () => {
    const plan = planSavings(
      [goal({ target_amount: 120_000, target_date: "2026-09-30" })],
      0,
      TODAY,
    );

    expect(plan.goals[0].monthsLeft).toBe(0);
    expect(plan.goals[0].required).toBe(120_000);
  });

  it("reports the gap instead of quietly promising the date", () => {
    const plan = planSavings(
      [goal({ target_amount: 120_000, target_date: "2026-12-31" })],
      25_000,
      TODAY,
    );

    expect(plan.goals[0].standing).toBe("short");
    expect(plan.goals[0].allocated).toBe(25_000);
    expect(plan.shortfall).toBe(15_000);
    // And the date it is actually reachable by, at what the month can spare.
    expect(plan.goals[0].monthsToArrive).toBe(5);
    expect(plan.goals[0].arrivesOn).toBe("2027-02-01");
  });

  it("does not let a goal borrow from the one behind it", () => {
    const plan = planSavings(
      [
        goal({ id: "a", target_amount: 90_000, target_date: "2026-12-31" }),
        goal({ id: "b", target_amount: 90_000, target_date: "2026-12-31" }),
      ],
      40_000,
      TODAY,
    );

    // The first takes its full 30,000; the second is left with 10,000 and says
    // so, rather than the pair each appearing to be on track for 20,000.
    expect(plan.goals[0].allocated).toBe(30_000);
    expect(plan.goals[0].standing).toBe("on_track");
    expect(plan.goals[1].allocated).toBe(10_000);
    expect(plan.goals[1].standing).toBe("short");
    expect(plan.shortfall).toBe(20_000);
  });

  it("gives what is left to the first undated goal, not a slice each", () => {
    const plan = planSavings(
      [
        goal({ id: "dated", target_amount: 30_000, target_date: "2026-12-31" }),
        goal({ id: "fund", title: "صندوق اضطراری", target_amount: 200_000 }),
        goal({ id: "later", title: "خانه", target_amount: 500_000 }),
      ],
      50_000,
      TODAY,
    );

    expect(plan.goals[0].allocated).toBe(10_000);
    expect(plan.goals[1].allocated).toBe(40_000);
    expect(plan.goals[1].standing).toBe("undated");
    expect(plan.goals[1].arrivesOn).toBe("2027-02-01");
    // Third in line gets nothing, and is told that rather than shown a date
    // built on money the goal above it is already using.
    expect(plan.goals[2].allocated).toBe(0);
    expect(plan.goals[2].standing).toBe("queued");
    expect(plan.goals[2].arrivesOn).toBeNull();
    expect(plan.unassigned).toBe(0);
  });

  it("keeps a missed date missed even when the month could cover it", () => {
    const plan = planSavings(
      [goal({ target_amount: 10_000, target_date: "2026-08-01" })],
      50_000,
      TODAY,
    );

    expect(plan.goals[0].standing).toBe("overdue");
    expect(plan.goals[0].required).toBe(10_000);
  });

  it("plans nothing for a goal already reached", () => {
    const plan = planSavings(
      [goal({ target_amount: 10_000, saved: 10_000, target_date: "2026-12-31" })],
      50_000,
      TODAY,
    );

    expect(plan.goals[0].standing).toBe("done");
    expect(plan.goals[0].required).toBeNull();
    expect(plan.goals[0].progress).toBe(100);
    expect(plan.allocated).toBe(0);
  });

  it("survives a month that costs more than it earns", () => {
    const plan = planSavings(
      [goal({ target_amount: 120_000, target_date: "2026-12-31" })],
      -20_000,
      TODAY,
    );

    expect(plan.goals[0].allocated).toBe(0);
    expect(plan.goals[0].monthsToArrive).toBeNull();
    expect(plan.shortfall).toBe(40_000);
  });

  it("measures progress against what the ledger holds, not the opening figure", () => {
    // 20,000 was already set aside before the app knew, 70,000 has been moved
    // into savings since, and 30,000 of it has been spent on the goal.
    const plan = planSavings(
      [
        goal({
          target_amount: 120_000,
          opening_saved: 20_000,
          funded: 70_000,
          spent: 30_000,
          saved: 60_000,
          target_date: "2026-12-31",
        }),
      ],
      50_000,
      TODAY,
    );

    expect(plan.goals[0].remaining).toBe(60_000);
    expect(plan.goals[0].progress).toBe(50);
    expect(plan.goals[0].required).toBe(20_000);
  });

  it("does not render a goal spent past zero as negative progress", () => {
    const plan = planSavings(
      [goal({ target_amount: 120_000, funded: 10_000, spent: 25_000, saved: -15_000 })],
      0,
      TODAY,
    );

    expect(plan.goals[0].progress).toBe(0);
    // And the shortfall is the whole target again, not less than it.
    expect(plan.goals[0].remaining).toBe(135_000);
  });

  it("treats a goal closed by hand as done, money left over or not", () => {
    const plan = planSavings(
      [goal({ status: "achieved", target_amount: 120_000, target_date: "2026-12-31" })],
      50_000,
      TODAY,
    );

    expect(plan.goals[0].standing).toBe("done");
    expect(plan.required).toBe(0);
    expect(plan.unassigned).toBe(50_000);
  });

  it("leaves a paused goal out of the month's claims", () => {
    const plan = planSavings(
      [goal({ status: "paused", target_amount: 120_000, target_date: "2026-12-31" })],
      50_000,
      TODAY,
    );

    expect(plan.goals[0].standing).toBe("paused");
    expect(plan.required).toBe(0);
    expect(plan.unassigned).toBe(50_000);
  });
});

describe("checkSavings", () => {
  it("names money in savings that no goal claims", () => {
    expect(checkSavings(500_000, 300_000)).toEqual({
      unassigned: 200_000,
      unbacked: 0,
    });
  });

  it("names goals claiming more than the savings hold", () => {
    expect(checkSavings(300_000, 500_000)).toEqual({
      unassigned: 0,
      unbacked: 200_000,
    });
  });

  it("says nothing when the two agree", () => {
    expect(checkSavings(300_000, 300_000)).toEqual({ unassigned: 0, unbacked: 0 });
  });
});

/* ---------------------------------------------------------- the surplus -- */

/**
 * `logged` is how many rows the user recorded themselves. It defaults to one,
 * since most of these cases are about a month that was genuinely kept; the
 * tests that care pass it explicitly.
 */
function point(month: string, income: number, expense: number, logged = 1) {
  return { month, income, expense, logged };
}

function source(over: Partial<IncomeSourceRow> = {}): IncomeSourceRow {
  return {
    id: "inc-1",
    user_id: "user-1",
    title: "حقوق",
    type: "salary",
    amount: 500_000,
    currency: "IRT",
    frequency: "monthly",
    is_active: true,
    started_on: null,
    ended_on: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function fixed(over: Partial<RecurringExpenseRow> = {}): RecurringExpenseRow {
  return {
    id: "rec-1",
    user_id: "user-1",
    title: "اجاره",
    category_id: null,
    account_id: null,
    amount: 200_000,
    currency: "IRT",
    frequency: "monthly",
    due_day: 1,
    due_month: null,
    is_active: true,
    auto_post: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function baseline(monthly: number): VariableExpenseBaselineRow {
  return {
    id: "base-1",
    user_id: "user-1",
    category_id: "cat-1",
    monthly_estimate: monthly,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("observedSurplus", () => {
  const current = "2026-09-01";

  it("ignores the month still running", () => {
    // September is three weeks in: its spending has not all happened yet, and
    // reading it as a whole month would inflate the plan.
    const surplus = observedSurplus(
      [point("2026-08-01", 100, 60), point(current, 100, 5)],
      current,
    );

    expect(surplus).toEqual({ amount: 40, basis: "observed", months: 1 });
  });

  it("takes the middle month, not the average", () => {
    // August was a holiday. An average would price the plan off it forever.
    const surplus = observedSurplus(
      [
        point("2026-06-01", 100, 50),
        point("2026-07-01", 100, 55),
        point("2026-08-01", 100, 190),
      ],
      current,
    );

    expect(surplus?.amount).toBe(45);
  });

  it("skips a month with nothing recorded in it", () => {
    // A month the user did not log is not a month they earned nothing.
    const surplus = observedSurplus(
      [point("2026-07-01", 0, 0, 0), point("2026-08-01", 100, 60)],
      current,
    );

    expect(surplus).toEqual({ amount: 40, basis: "observed", months: 1 });
  });

  it("skips a month whose only entry is a bill the app generated", () => {
    // Confirming a long-missed rent creates exactly this shape: a large
    // expense, no income, and nothing the user actually recorded. Read as a
    // lived month it would say the user is 800 in the hole every month and
    // drag the entire plan negative — which is what it did, once.
    const surplus = observedSurplus(
      [point("2026-07-01", 0, 800, 0), point("2026-08-01", 100, 60)],
      current,
    );

    expect(surplus).toEqual({ amount: 40, basis: "observed", months: 1 });
  });

  it("falls back to the declared figure when every month is only generated", () => {
    expect(observedSurplus([point("2026-07-01", 0, 800, 0)], current)).toBeNull();
  });

  it("is null before there is any history to read", () => {
    expect(observedSurplus([point(current, 100, 5)], current)).toBeNull();
  });
});

describe("declaredSurplus", () => {
  it("subtracts the estimated variable spending, not just the bills", () => {
    const surplus = declaredSurplus({
      sources: [source({ amount: 500_000 })],
      recurring: [fixed({ amount: 200_000 })],
      baselines: [baseline(150_000)],
    });

    expect(surplus).toEqual({ amount: 150_000, basis: "declared", months: 0 });
  });

  it("converts a frequency to its monthly worth", () => {
    const surplus = declaredSurplus({
      sources: [source({ amount: 1_200_000, frequency: "yearly" })],
      recurring: [],
      baselines: [],
    });

    expect(surplus.amount).toBe(100_000);
  });

  it("does not spread a one-off across the year", () => {
    const surplus = declaredSurplus({
      sources: [source({ amount: 1_200_000, frequency: "one_time" })],
      recurring: [],
      baselines: [],
    });

    expect(surplus).toEqual({ amount: 0, basis: "unknown", months: 0 });
  });

  it("knows nothing when no income was ever declared", () => {
    const surplus = declaredSurplus({
      sources: [],
      recurring: [fixed()],
      baselines: [],
    });

    expect(surplus.basis).toBe("unknown");
  });
});

describe("monthlySurplus", () => {
  const current = "2026-09-01";
  const declared = {
    sources: [source({ amount: 500_000 })],
    recurring: [fixed({ amount: 200_000 })],
    baselines: [baseline(150_000)],
  };

  it("prefers one lived month over a declared estimate", () => {
    const surplus = monthlySurplus({
      series: [point("2026-08-01", 400_000, 380_000)],
      currentMonth: current,
      ...declared,
    });

    expect(surplus).toEqual({ amount: 20_000, basis: "observed", months: 1 });
  });

  it("falls back to what the user declared until a month has been lived", () => {
    const surplus = monthlySurplus({ series: [], currentMonth: current, ...declared });

    expect(surplus).toEqual({ amount: 150_000, basis: "declared", months: 0 });
  });
});
