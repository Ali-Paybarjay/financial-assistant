import { shiftMonth, type IsoDate } from "@/lib/date";
import { sumMinor, type Minor } from "@/lib/money";
import type { MonthPoint } from "@/lib/queries/transactions";
import type {
  IncomeSourceRow,
  RecurringExpenseRow,
  VariableExpenseBaselineRow,
} from "@/lib/supabase/database.types";

/**
 * How much money a month has spare. One module, because three screens used to
 * answer it separately: the onboarding summary, the income page, and now the
 * savings plan — and a plan built on a different «what's left» than the number
 * the user was shown at signup is a plan they have no reason to believe.
 *
 * Pure. The reads live in the pages; this only does the arithmetic.
 */

/** Monthly equivalent, so a biweekly salary and a yearly bonus are comparable. */
const PER_MONTH: Record<string, number> = {
  monthly: 1,
  biweekly: 26 / 12,
  weekly: 52 / 12,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  // A one-off is not income you can plan around. Counting a signing bonus as
  // a twelfth of itself every month would fund a goal with money that arrives
  // once and is already spent.
  one_time: 0,
};

/** What one row is worth per month. An unknown frequency is taken as monthly. */
export function perMonth(amount: Minor, frequency: string): Minor {
  return Math.round(amount * (PER_MONTH[frequency] ?? 1));
}

export function monthlyIncome(sources: readonly IncomeSourceRow[]): Minor {
  return sumMinor(
    sources
      .filter((source) => source.is_active)
      .map((source) => perMonth(source.amount, source.frequency)),
  );
}

export function monthlyFixed(expenses: readonly RecurringExpenseRow[]): Minor {
  return sumMinor(
    expenses
      .filter((expense) => expense.is_active)
      .map((expense) => perMonth(expense.amount, expense.frequency)),
  );
}

/** The five estimates from onboarding: groceries, transport, and the rest. */
export function monthlyVariable(
  baselines: readonly VariableExpenseBaselineRow[],
): Minor {
  return sumMinor(baselines.map((baseline) => baseline.monthly_estimate));
}

/**
 * Where a surplus figure came from, because the two are not equally good and
 * the user is owed the difference. «Observed» is what actually happened;
 * «declared» is what they told us at signup and have not lived through yet.
 */
export type SurplusBasis = "observed" | "declared" | "unknown";

export type MonthlySurplus = {
  /** Income minus spending in a typical month. Can be negative. */
  amount: Minor;
  basis: SurplusBasis;
  /** How many real months went into it. Zero for a declared figure. */
  months: number;
};

/** Complete months only: the running month is half a month of spending. */
const WINDOW_MONTHS = 3;

/**
 * The middle value, not the average. One holiday month with three flights in
 * it would drag an average far enough to make the whole plan wrong, and it is
 * exactly the kind of month that happens once. Two values average, because
 * there is no middle one to pick.
 */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * What a typical month leaves over, from the months that have actually been
 * recorded.
 *
 * The running month is excluded — on the 3rd it looks like a fortune and on
 * the 28th like a disaster — and so is any month the user did not actually
 * keep books in: a month they did not log is not a month they earned nothing,
 * and treating it as one would quietly halve the plan.
 *
 * «Kept books in» means at least one row they recorded themselves. Rows the
 * app generated from a fixed bill do not count, and that distinction is
 * load-bearing rather than fussy: a month holding nothing but a posted rent
 * reads as income zero against a large expense, which is not a lean month —
 * it is an unrecorded one. Confirming a long-missed bill creates exactly that
 * shape, so without this a single answered question could drag the whole plan
 * negative.
 */
export function observedSurplus(
  series: readonly MonthPoint[],
  currentMonth: IsoDate,
): MonthlySurplus | null {
  const complete = series
    .filter((point) => point.month < currentMonth)
    .filter((point) => point.logged > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-WINDOW_MONTHS);

  if (complete.length === 0) return null;

  return {
    amount: median(complete.map((point) => point.income - point.expense)),
    basis: "observed",
    months: complete.length,
  };
}

/**
 * What the user said at signup: income, minus the fixed bills, minus their own
 * estimate of the variable spending. The estimates are subtracted on purpose —
 * a plan built on income minus rent alone would promise a saving rate that
 * groceries eat before the month is out.
 */
export function declaredSurplus(input: {
  sources: readonly IncomeSourceRow[];
  recurring: readonly RecurringExpenseRow[];
  baselines: readonly VariableExpenseBaselineRow[];
}): MonthlySurplus {
  const income = monthlyIncome(input.sources);
  const spending = monthlyFixed(input.recurring) + monthlyVariable(input.baselines);

  return {
    amount: income - spending,
    basis: income > 0 ? "declared" : "unknown",
    months: 0,
  };
}

/**
 * The number the savings plan is built on: what really happened if there is
 * any history, and what the user declared until there is.
 *
 * Lived months win over declared ones even when there is only one of them.
 * The declared figure is an estimate of a month nobody has been through yet;
 * a single real month is at least a month that happened.
 */
export function monthlySurplus(input: {
  series: readonly MonthPoint[];
  currentMonth: IsoDate;
  sources: readonly IncomeSourceRow[];
  recurring: readonly RecurringExpenseRow[];
  baselines: readonly VariableExpenseBaselineRow[];
}): MonthlySurplus {
  return observedSurplus(input.series, input.currentMonth) ?? declaredSurplus(input);
}

/** The window `monthlySurplus` reads, as a month key to query transactions from. */
export function surplusWindowStart(currentMonth: IsoDate): IsoDate {
  return shiftMonth(currentMonth, -WINDOW_MONTHS);
}

/**
 * Where this month lands if the rest of it looks like the part already lived.
 *
 * The dashboard's forecast, and the figure the `pace_over` insight fires on.
 * Here rather than in either of them because this module is the one answer to
 * «how much is left at the end of the month» — a card and a sentence that
 * disagreed about it would be two features arguing in front of the user.
 *
 * Income is taken as already known rather than extrapolated. A salary arrives
 * on a day, not at a rate, so spreading it across the month would make the
 * 3rd look catastrophic and the 28th look fine, every single month. Spending
 * is the half that genuinely accumulates, so spending is the half projected.
 *
 * It is a straight-line guess and it is drawn under a dashed rule wherever it
 * appears, for the same reason every uncertain figure in this app is.
 */
export function projectedMonthEnd(input: {
  income: Minor;
  expense: Minor;
  /** Days of the month already lived, including today. */
  daysGone: number;
  daysInMonth: number;
}): Minor {
  const { income, expense, daysGone, daysInMonth } = input;
  // Before any day has passed there is no rate to carry forward, and the
  // month's own figures are the best answer available.
  if (daysGone <= 0) return income - expense;
  const projectedExpense = Math.round((expense / daysGone) * daysInMonth);
  return income - projectedExpense;
}
