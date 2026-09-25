/**
 * Envelope rules — pure, tested, no database.
 *
 * Money is `bigint` cents everywhere, as `lib/money.ts` requires; these
 * functions take and return the same minor units and never format.
 */

export type EnvelopeState = "unset" | "under" | "tight" | "over";

/** A row of `envelope_status()`. */
export type Envelope = {
  categoryId: string;
  name: string;
  /** null when the category has no budget for this month. */
  budget: number | null;
  spent: number;
  /** How much of `spent` comes from rows nobody has confirmed. */
  unconfirmed: number;
};

/** ۸۵٪ or more of the budget, but not past it. */
export const TIGHT_RATIO = 0.85;

export function envelopeState(budget: number | null, spent: number): EnvelopeState {
  if (budget === null) return "unset";
  if (spent > budget) return "over";
  return spent >= budget * TIGHT_RATIO ? "tight" : "under";
}

/**
 * What the card shows as its big number: what is LEFT, not what was spent.
 * Negative means the envelope is over its budget by that much.
 */
export function remaining(budget: number | null, spent: number): number | null {
  return budget === null ? null : budget - spent;
}

/** This envelope's spend, extended to the end of the month at today's pace. */
export function projectedSpend(spent: number, daysGone: number, daysInMonth: number): number {
  if (daysGone <= 0) return spent;
  return Math.round((spent / daysGone) * daysInMonth);
}

/**
 * What is left, per day, for the rest of the month. Zero once the envelope is
 * spent — never negative, because «روزی −۳ دلار» is not an instruction.
 */
export function dailyAllowance(
  budget: number | null,
  spent: number,
  daysLeft: number,
): number | null {
  if (budget === null || daysLeft <= 0) return null;
  return Math.max(0, Math.round((budget - spent) / daysLeft));
}

/** 0–100, clamped. For the bar's width only; the text carries the real number. */
export function fillPercent(budget: number | null, spent: number): number {
  if (budget === null || budget <= 0) return 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

/**
 * A budget suggested from the user's own ledger: the MEDIAN of the last three
 * months, rounded up to the nearest 50 units.
 *
 * Median, not mean: one month with a deposit in it doubles a mean and the
 * suggestion stops being believable. Fewer than two months of data returns
 * null — the envelope stays «بی‌سقف», which is an honest answer, and a made-up
 * number is not.
 */
export function suggestBudget(monthlySpends: number[]): number | null {
  const months = monthlySpends.filter((value) => value > 0).sort((a, b) => a - b);
  if (months.length < 2) return null;

  const middle = Math.floor(months.length / 2);
  const median =
    months.length % 2 === 1 ? months[middle] : (months[middle - 1] + months[middle]) / 2;

  // 5_000 cents = 50 units of the currency.
  return Math.ceil(median / 5_000) * 5_000;
}

/** Envelope order on the board: real budgets first, «بی‌سقف» last. */
export function sortEnvelopes(rows: Envelope[]): Envelope[] {
  return [...rows].sort((a, b) => {
    const aUnset = a.budget === null;
    const bUnset = b.budget === null;
    if (aUnset !== bUnset) return aUnset ? 1 : -1;
    return b.spent - a.spent;
  });
}
