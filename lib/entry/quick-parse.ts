import { normalizeDigits } from "@/lib/money";

/**
 * The gate in front of the model.
 *
 * An always-open composer changes the economics of free-text entry. Behind a
 * button, every model call was something the user deliberately went looking
 * for; in a bar that sits under every screen, a lot of what gets typed is
 * «قهوه ۵» — which needs no reading, only two fields filled in. Sending that
 * to a model costs real money, takes two seconds, and comes back with exactly
 * what a regex already knew.
 *
 * So this decides, before any request is made, whether there is anything to
 * interpret. It never rejects the user's input — the two outcomes are «ask
 * the model» and «open the form with this already filled in», and the second
 * is faster than the first rather than a lesser version of it.
 *
 * Pure, and deliberately conservative: anything it is not sure about goes to
 * the model. A wrong «simple» reading is a wrong transaction; a wrong
 * «complex» reading is one avoidable API call.
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
      reason: "too-short" | "no-amount" | "simple";
      /** The amount as typed, in Latin digits, ready for `toMinor`. */
      amount?: string;
      /** Whatever was left after the number came out. */
      merchant?: string;
    };

/** Below this, there is not enough text to be a description of anything. */
const MIN_LENGTH = 3;

/** Past this many words beside the number, it is a sentence, not a label. */
const MAX_SIMPLE_WORDS = 3;

/**
 * Words that mean the number is not the whole story. A multiplier has to be
 * applied and a date has to be resolved, and getting either wrong writes a
 * wrong row — so both go to the model rather than to a regex.
 */
const NEEDS_READING =
  /(هزار|میلیون|میلیارد|دیروز|پریروز|امروز|فردا|هفته|ماه|پیش|قبل|شنبه|یکشنبه|دوشنبه|سه‌شنبه|سه شنبه|چهارشنبه|پنج‌شنبه|پنج شنبه|جمعه)/;

/** Units, which name the currency rather than describing the purchase. */
const CURRENCY_WORDS =
  /^(دلار|تومان|تومن|ریال|یورو|پوند|کرون|درهم|usd|cad|eur|gbp|sek|aud)$/i;

/** A run of digits, with an optional decimal or thousands separator inside. */
const NUMBER = /\d+(?:[.,]\d+)*/g;

export function quickParse(input: string): QuickParse {
  const text = normalizeDigits(input).trim();

  if (text.length < MIN_LENGTH) return { kind: "manual", reason: "too-short" };

  const numbers = text.match(NUMBER) ?? [];
  const [first] = numbers;
  // Nothing to record. The form opens empty rather than the model being asked
  // to find an amount that is not there.
  if (!first) return { kind: "manual", reason: "no-amount" };

  // More than one figure usually means more than one purchase, which is
  // exactly the case the model earns its keep on.
  if (numbers.length > 1) return { kind: "model" };
  if (NEEDS_READING.test(text)) return { kind: "model" };

  const rest = text
    .replace(NUMBER, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !CURRENCY_WORDS.test(word));

  if (rest.length > MAX_SIMPLE_WORDS) return { kind: "model" };

  return {
    kind: "manual",
    reason: "simple",
    amount: first.replace(/,/g, ""),
    merchant: rest.join(" ") || undefined,
  };
}
