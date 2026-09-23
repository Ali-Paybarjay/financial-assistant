import { normalizeDigits } from "@/lib/money";

/**
 * The gate in front of the model.
 *
 * An always-open composer changes the economics of free-text entry, so this
 * decides — before any request is made — whether there is anything here worth
 * reading. It never rejects what the user typed: the two outcomes are «ask
 * the model» and «open the form with this already filled in».
 *
 * **What counts as «worth reading» was wrong in the first version**, and the
 * mistake is worth naming because it is easy to make again. That version
 * short-circuited anything shaped like «amount + a word or two» — «بنزین ۶۰»,
 * «قبض برق ۸۰ پوند» — on the grounds that a regex could already see the
 * number. It could. But the number was never the hard part: **the category
 * is**, and the category is the one field a regex cannot produce. So the fast
 * path opened a form with the amount filled and the category empty, which is
 * the same work as recording the expense by hand and left the model with
 * almost nothing to do.
 *
 * The rule now: a word that is not a unit is something to interpret, and
 * anything to interpret goes to the model. Only two things stop here — text
 * with no amount in it at all, and an amount with nothing said about it.
 */

export type QuickParse =
  /** Worth a model call: there is something here a regex cannot resolve. */
  | { kind: "model" }
  /**
   * Not worth one. The form opens with whatever could be read, and `reason`
   * is what the composer says while opening it.
   */
  | {
      kind: "manual";
      reason:
        /** Fewer than three characters: not a description of anything. */
        | "too-short"
        /** No figure anywhere. The amount is the one field never inferred. */
        | "no-amount"
        /** A figure and nothing said about it — nothing to categorise. */
        | "amount-only";
      /** The amount as typed, in Latin digits, ready for `toMinor`. */
      amount?: string;
      /** Whatever was left after the number came out. */
      merchant?: string;
    };

/** Below this, and with no figure in it, there is nothing to work with. */
const MIN_LENGTH = 3;

/** Units. They name the currency rather than describing the purchase. */
const CURRENCY_WORDS =
  /^(دلار|تومان|تومن|ریال|یورو|پوند|کرون|درهم|usd|cad|eur|gbp|sek|aud|\$|£|€)$/i;

/** A run of digits, with an optional decimal or thousands separator inside. */
const NUMBER = /\d+(?:[.,]\d+)*/g;

export function quickParse(input: string): QuickParse {
  const text = normalizeDigits(input).trim();

  const numbers = text.match(NUMBER) ?? [];
  const [first] = numbers;

  // Everything after the figures come out, minus the units. Whatever is left
  // is what someone would use to decide which envelope this belongs in.
  const said = text
    .replace(NUMBER, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !CURRENCY_WORDS.test(word));

  if (!first) {
    // The length floor is checked here rather than first: «۵۰» is two
    // characters and is a perfectly good amount, so shortness only means
    // anything once we know there is no figure to go on.
    if (text.length < MIN_LENGTH) return { kind: "manual", reason: "too-short" };

    // Nothing to record. The form opens carrying the words, so the user only
    // has to add the figure rather than type the whole thing again.
    return {
      kind: "manual",
      reason: "no-amount",
      merchant: said.join(" ") || undefined,
    };
  }

  // «۵۰», «۵۰ پوند» — a figure and nothing said about it. There is no
  // category to infer from silence, so asking a model would buy nothing.
  if (said.length === 0) {
    return {
      kind: "manual",
      reason: "amount-only",
      amount: first.replace(/,/g, ""),
    };
  }

  return { kind: "model" };
}
