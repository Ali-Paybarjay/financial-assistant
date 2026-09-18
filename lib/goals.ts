import { monthsBetween, shiftMonth, type IsoDate } from "@/lib/date";
import type { Minor } from "@/lib/money";
import type { GoalRow } from "@/lib/supabase/database.types";

/**
 * Turning a goal into a plan: what it costs per month, whether the money is
 * there, and when it actually arrives if it isn't.
 *
 * A goal without this is a progress bar — it records a wish and never tells
 * anyone what to do about it. Everything here is the arithmetic behind the one
 * sentence the goals page has always promised: «ماهی چقدر باید بگذاری کنار».
 *
 * Pure, and pinned by tests/unit/goals.spec.ts. The reads live in the page.
 */

/**
 * A goal once the ledger has been read, the way AccountWithBalance is an
 * account once its rows have been. `saved` is the only number anything should
 * measure progress against; `opening_saved` on its own is just where it
 * started.
 */
export type GoalWithProgress = GoalRow & {
  /** opening_saved + funded − spent. Negative when it was overspent. */
  saved: Minor;
  /** Moved into savings for it. */
  funded: Minor;
  /** Spent on it — real expenses, on the day they happened. */
  spent: Minor;
};

export type GoalStanding =
  /** Already saved. Nothing to plan. */
  | "done"
  /** The date has passed and the money is not there. */
  | "overdue"
  /** Dated, and the surplus covers what the date costs. */
  | "on_track"
  /** Dated, and it does not. */
  | "short"
  /** Undated, and money is going into it. The arrival month is a projection. */
  | "undated"
  /** Nothing is going into it: an earlier goal is taking everything. */
  | "queued"
  /** Not an active goal, so it makes no claim on the month. */
  | "paused";

export type GoalPlan = {
  goal: GoalWithProgress;
  /** Still to be found. Never negative — an overshoot is not a debt. */
  remaining: Minor;
  /** 0–100, capped. */
  progress: number;
  /** Contribution months before the target date. Null when there is no date. */
  monthsLeft: number | null;
  /** What hitting the date costs every month. Null when there is no date. */
  required: Minor | null;
  /** What the month's surplus actually leaves for it. */
  allocated: Minor;
  /** Months to get there at `allocated`. Null when nothing is going in. */
  monthsToArrive: number | null;
  /** The month it is reached at `allocated`, as a YYYY-MM-01 key. */
  arrivesOn: IsoDate | null;
  standing: GoalStanding;
};

export type SavingsPlan = {
  goals: GoalPlan[];
  /** What the month's surplus has to cover, adding up the dated goals. */
  required: Minor;
  /** What it actually covers. This is the number to set aside. */
  allocated: Minor;
  /** `required` − `allocated`, floored at zero. */
  shortfall: Minor;
  /** Left over after every goal has taken its share. */
  unassigned: Minor;
};

export type SavingsCheck = {
  /** Sitting in savings with no goal claiming it. */
  unassigned: Minor;
  /** Claimed by goals but not actually sitting in savings. */
  unbacked: Minor;
};

/**
 * Whether the savings accounts and the goals tell the same story.
 *
 * The goals page is otherwise entirely about flow — what to move each month —
 * and says nothing about the stock. Two numbers that should match and are
 * never compared is how a user ends up with money set aside for nothing, or
 * with goals that quietly claim more than the account holds. At most one side
 * of this is non-zero; they are two readings of one difference, kept apart
 * because the sentence to write about each is different.
 */
export function checkSavings(savingsTotal: Minor, goalsHeld: Minor): SavingsCheck {
  const difference = savingsTotal - goalsHeld;
  return {
    unassigned: Math.max(0, difference),
    unbacked: Math.max(0, -difference),
  };
}

function progressOf(goal: GoalWithProgress): number {
  if (goal.target_amount <= 0) return 0;
  // Floored as well as capped: a goal that has been overspent is at zero, not
  // at a negative width the progress bar would render as nothing anyway.
  const percent = Math.round((goal.saved / goal.target_amount) * 100);
  return Math.min(100, Math.max(0, percent));
}

/**
 * Contribution months between now and the deadline.
 *
 * The running month is not one of them. Money for this month is mostly already
 * committed by the time anyone opens a goals page, so counting it would spread
 * the target over a month that isn't really there and land the user short. The
 * error runs the safe way: ask for slightly more, arrive slightly early.
 */
export function contributionMonths(today: IsoDate, targetDate: IsoDate): number {
  return Math.max(0, monthsBetween(today, targetDate));
}

/**
 * What hitting this goal's date costs every month. Null when it has no date,
 * is already reached, or is not being worked on — none of those name a rate.
 *
 * Rounded up: rounding down leaves the target short by a unit for every month
 * that passes, which is exactly the kind of miss that makes a plan worthless.
 */
export function requiredMonthly(goal: GoalWithProgress, today: IsoDate): Minor | null {
  const remaining = Math.max(0, goal.target_amount - goal.saved);
  if (remaining === 0 || goal.status !== "active" || !goal.target_date) return null;

  // Past the date, or inside the month it falls in: there is no month left to
  // spread it over, so the whole of it is owed now.
  if (goal.target_date < today) return remaining;
  return Math.ceil(remaining / Math.max(1, contributionMonths(today, goal.target_date)));
}

/** One goal, before any money has been handed out. */
function baseline(goal: GoalWithProgress, today: IsoDate): GoalPlan {
  const remaining = Math.max(0, goal.target_amount - goal.saved);
  const shared = {
    goal,
    remaining,
    progress: progressOf(goal),
    allocated: 0,
    monthsToArrive: null,
    arrivesOn: null,
  };

  // Closed by hand counts as done even with money still to go: the user is
  // the authority on whether they are finished with a goal, not the target
  // they typed into it months ago.
  if (remaining === 0 || goal.status === "achieved") {
    return { ...shared, monthsLeft: null, required: null, standing: "done" };
  }

  if (goal.status !== "active") {
    return { ...shared, monthsLeft: null, required: null, standing: "paused" };
  }

  if (!goal.target_date) {
    return { ...shared, monthsLeft: null, required: null, standing: "queued" };
  }

  if (goal.target_date < today) {
    // The date is behind us. What is left is owed now, not spread over months
    // that no longer exist.
    return {
      ...shared,
      monthsLeft: 0,
      required: requiredMonthly(goal, today),
      standing: "overdue",
    };
  }

  return {
    ...shared,
    monthsLeft: contributionMonths(today, goal.target_date),
    required: requiredMonthly(goal, today),
    standing: "short",
  };
}

/**
 * Hand out one month's surplus, then say what each goal that got some means
 * for its date.
 *
 * Two passes, because a deadline and a priority are different kinds of claim:
 *
 *  1. A date asks for a specific amount every month or it is missed, so dated
 *     goals draw first — in the order they are given, which is the priority
 *     order the page already displays them in. A goal that cannot be fully
 *     covered takes what is left and reports itself short rather than
 *     silently borrowing from the goal behind it.
 *  2. An undated goal asks for no particular rate, so it cannot compete for a
 *     share. Whatever survives pass one goes to the first of them, all of it.
 *     Splitting it evenly across every undated goal would be the arithmetic
 *     that looks fairest and the advice that works worst: it finishes nothing,
 *     and «fill the emergency fund, then start the next thing» is the whole
 *     reason goals carry a priority.
 *
 * `surplus` may be negative — that is a real month, and it means nothing is
 * allocated and every dated goal reports itself short by its full cost, which
 * is the truth.
 */
export function planSavings(
  goals: readonly GoalWithProgress[],
  surplus: Minor,
  today: IsoDate,
): SavingsPlan {
  const rows = goals.map((goal) => baseline(goal, today));
  let left = Math.max(0, surplus);

  for (const row of rows) {
    if (row.required === null) continue;
    const take = Math.min(row.required, left);
    row.allocated = take;
    left -= take;
    // A missed date stays missed even when this month can cover it. Calling
    // that «on track» would erase the one fact the user needs.
    if (take >= row.required && row.standing === "short") row.standing = "on_track";
  }

  const firstUndated = rows.find((row) => row.standing === "queued");
  if (firstUndated && left > 0) {
    firstUndated.allocated = left;
    firstUndated.standing = "undated";
    left = 0;
  }

  // `today` is already the user's own calendar date, so its month needs no
  // timezone applied a second time.
  const currentMonth = `${today.slice(0, 7)}-01`;
  for (const row of rows) {
    if (row.allocated <= 0) continue;
    row.monthsToArrive = Math.ceil(row.remaining / row.allocated);
    // Contributions start next month, so N of them land N months out.
    row.arrivesOn = shiftMonth(currentMonth, row.monthsToArrive);
  }

  const required = rows.reduce((total, row) => total + (row.required ?? 0), 0);
  const allocated = rows.reduce((total, row) => total + row.allocated, 0);

  return {
    goals: rows,
    required,
    allocated,
    shortfall: Math.max(0, required - allocated),
    unassigned: left,
  };
}
