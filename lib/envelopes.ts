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
  /** What onboarding says this costs per month, if anything. A suggestion. */
  baseline_minor: Minor | null;
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

/** Where a proposed ceiling came from, because the two are not equally good. */
export type CeilingSuggestion = {
  amount: Minor;
  /** «observed» is three months of real spending; «declared» is onboarding. */
  source: "observed" | "declared";
};

/**
 * What to propose as this envelope's ceiling, and where it came from.
 *
 * Lived months win over a figure someone typed during signup, for the same
 * reason `monthlySurplus` prefers observed over declared: one is what
 * happened, the other is what they guessed would happen before they had
 * started keeping books. Both beat an empty field, and the card says which it
 * is showing — «میانهٔ ۳ ماه» and «در ثبت‌نام گفتی» are different claims and
 * should not be dressed as the same one.
 */
export function suggestedCeiling(
  envelope: Pick<EnvelopeRow, "baseline_minor">,
  observedMedian: Minor | null | undefined,
): CeilingSuggestion | null {
  if (observedMedian != null && observedMedian > 0) {
    return { amount: observedMedian, source: "observed" };
  }
  if (envelope.baseline_minor != null && envelope.baseline_minor > 0) {
    return { amount: envelope.baseline_minor, source: "declared" };
  }
  return null;
}

/**
 * What is left of this month's budget, and what it is left *of*.
 *
 * The one figure the capture screen carries, so that recording a purchase
 * still happens in front of the number it moves.
 */
export type MonthRemaining =
  /** Ceilings exist. Every figure counts only the categories that have one. */
  | { kind: "budgeted"; budget: Minor; spent: Minor; remaining: Minor }
  /** No ceiling anywhere, so there is nothing to be left *of*. */
  | { kind: "spent"; spent: Minor }
  /** No ceilings and nothing spent: a month with no facts in it yet. */
  | { kind: "empty" };

/**
 * Both sides of the fraction come from the budgeted categories alone.
 *
 * Counting every category's spending against the few ceilings that exist would
 * report «۳ از ۶ مانده» when «خوراک» has a 6M ceiling it has not touched and
 * the 3M went on unbudgeted rent. That is wrong, and wrong in the pessimistic
 * direction — which is precisely how a user learns to distrust the one figure
 * this screen exists to show.
 *
 * `remaining` is allowed to go negative. What to call that is the screen's
 * decision; flooring it here would be this function telling a lie on the
 * screen's behalf.
 */
export function monthRemaining(envelopes: readonly EnvelopeRow[]): MonthRemaining {
  let budget = 0;
  let budgetedSpend = 0;
  let totalSpend = 0;
  let hasCeiling = false;

  for (const envelope of envelopes) {
    totalSpend += envelope.spent_minor;

    // `!== null` rather than truthiness: a ceiling of zero is a decision —
    // «spend nothing here» — and treating it as an absence would quietly
    // forgive the one category the user was strictest about.
    if (envelope.budget_minor === null) continue;

    hasCeiling = true;
    budget += envelope.budget_minor;
    budgetedSpend += envelope.spent_minor;
  }

  if (hasCeiling) {
    return {
      kind: "budgeted",
      budget,
      spent: budgetedSpend,
      remaining: budget - budgetedSpend,
    };
  }

  return totalSpend > 0 ? { kind: "spent", spent: totalSpend } : { kind: "empty" };
}
