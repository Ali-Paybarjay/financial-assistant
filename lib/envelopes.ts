import { minorExponent, type CurrencyCode, type Minor } from "@/lib/money";

/**
 * What an envelope is worth, and what that means. Pure arithmetic on numbers
 * that were read somewhere else — no database, no dates of its own, nothing to
 * mock. Rule 5: this is a calculation, not an inference, so no model is asked.
 *
 * The status itself comes from `envelope_status()` in SQL, beside the ledger
 * it derives from. This module only judges what that query returns.
 */

/** One row of `envelope_status()`. */
export type EnvelopeRow = {
  category_id: string;
  name_fa: string;
  /** null = no ceiling set. */
  budget_minor: Minor | null;
  spent_minor: Minor;
  /** null when there is no ceiling; negative when the ceiling is passed. */
  remaining_minor: Minor | null;
  unconfirmed_minor: Minor;
};

export type EnvelopeState = "under" | "tight" | "over" | "unset";

/** The share of the ceiling at which an envelope starts warning. */
const TIGHT_AT = 0.85;

/**
 * `tight` is 85% of the ceiling or more, but not past it.
 *
 * Exactly at the ceiling is tight rather than over: the user has spent what
 * they allowed themselves and not a cent more, and colouring that as a failure
 * would be telling them off for hitting their own target.
 */
export function envelopeState(budget: Minor | null, spent: Minor): EnvelopeState {
  if (budget === null) return "unset";
  if (spent > budget) return "over";
  return spent >= budget * TIGHT_AT ? "tight" : "under";
}

/**
 * This envelope's spending rate, carried to the end of the month.
 *
 * Deliberately naive — it assumes the rest of the month looks like the part
 * already lived. That is wrong for rent and right for groceries, and it is
 * shown under a dashed rule everywhere precisely because it is a projection
 * rather than a fact.
 */
export function projectedSpend(
  spent: Minor,
  daysGone: number,
  daysInMonth: number,
): Minor {
  if (daysGone <= 0) return spent;
  return Math.round((spent / daysGone) * daysInMonth);
}

/**
 * What is left to spend per day from here to the end of the month.
 *
 * Floors at zero rather than going negative: once the ceiling is passed the
 * honest daily allowance is «none», and a negative allowance reads as a debt
 * per day, which is not a thing the user can act on. The card says «over by X»
 * in that state instead.
 */
export function dailyAllowance(
  budget: Minor | null,
  spent: Minor,
  daysLeft: number,
): Minor | null {
  if (budget === null || daysLeft <= 0) return null;
  return Math.max(0, Math.round((budget - spent) / daysLeft));
}

/** Months of history below which no ceiling is suggested. */
const MIN_MONTHS = 2;

/** The suggestion is rounded up to a multiple of this many major units. */
const ROUND_TO_MAJOR = 50;

/**
 * A ceiling to suggest for a category, from what the user actually spent.
 *
 * The middle month, not the average. One month with a flight or a deposit in
 * it drags an average far enough to suggest a ceiling nobody would ever hit,
 * and it is exactly the kind of month that happens once. The same reasoning,
 * and the same choice, as `monthlySurplus` in lib/cashflow.ts.
 *
 * Under two months of history it returns null and the category stays unset. A
 * suggestion drawn from one month is a suggestion drawn from whatever that
 * month happened to be, and an invented number the user then budgets against
 * is worse than an empty field that says «you decide».
 *
 * The rounding step is fifty *major* units, converted here rather than written
 * as a constant in cents. The spec had it as a flat 5_000 minor, which is $50
 * only for a currency with two decimals; for the toman and the rial, whose
 * minor unit is the unit, that same constant is 5,000 tomans — so a suggested
 * ceiling would come back as ۴,۹۸۳,۲۵۰ and read as a measurement rather than a
 * proposal. Hence the currency argument the spec's signature does not have.
 */
export function suggestBudget(
  monthlySpends: readonly Minor[],
  currency: CurrencyCode,
): Minor | null {
  const months = monthlySpends.filter((amount) => amount > 0).sort((a, b) => a - b);
  if (months.length < MIN_MONTHS) return null;

  const mid = Math.floor(months.length / 2);
  const median =
    months.length % 2 ? months[mid] : (months[mid - 1] + months[mid]) / 2;

  const step = ROUND_TO_MAJOR * 10 ** minorExponent(currency);
  return Math.ceil(median / step) * step;
}
