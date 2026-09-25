import { normalizeDigits } from "@/lib/money";

export type QuickParse =
  | { handled: false }
  | {
      handled: true;
      /** Cents. Never a float — see lib/money.ts. */
      amountMinor: number;
      /** Whatever was left of the line after the amount. */
      title: string;
    };

/**
 * The gate in front of the model.
 *
 * With the composer always open, people type things that are not expenses,
 * and people type expenses so plain that a regex reads them perfectly:
 * «قهوه ۵.۷۵». Both cases used to cost an API call — the first to be told
 * "there is nothing here", the second to be told what we already knew.
 *
 * Rules, deliberately narrow:
 *   - no digits at all      → not an expense, hand back the manual form
 *   - shorter than 3 chars  → not an expense
 *   - exactly one number
 *     plus 1–4 plain words  → parsed here, no model
 *   - anything else         → the model reads it
 *
 * Narrow on purpose: a wrong local guess is worse than a paid correct one,
 * because the user sees a confirm card with the wrong merchant on it.
 */
export function quickParse(input: string): QuickParse {
  const text = normalizeDigits(input).trim();
  if (text.length < 3) return { handled: true, amountMinor: 0, title: text };

  const numbers = text.match(/\d+(?:[.,]\d{1,2})?/g);
  if (!numbers) return { handled: true, amountMinor: 0, title: text };
  if (numbers.length !== 1) return { handled: false };

  const rest = text.replace(numbers[0], " ").trim();
  const words = rest.split(/\s+/).filter(Boolean);
  // More than four words means there is structure worth reading — a date, a
  // person, a split, an account.
  if (words.length > 4) return { handled: false };
  // A currency word, a date word or a split word all mean "ask the model".
  if (/دیروز|فردا|امروز|نفر|قسط|از حساب|تومان|دلار|یورو/.test(rest)) {
    return { handled: false };
  }

  const amountMinor = Math.round(Number(numbers[0].replace(",", ".")) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return { handled: false };

  return { handled: true, amountMinor, title: words.join(" ") };
}

/** Whether a line contains anything that could be money at all. */
export function looksLikeMoney(input: string): boolean {
  return /\d/.test(normalizeDigits(input));
}
