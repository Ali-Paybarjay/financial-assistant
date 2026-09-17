/**
 * The only permitted path for converting, summing and formatting money.
 * Nothing else in the codebase may do arithmetic on an amount or call
 * Intl.NumberFormat on one.
 *
 * Amounts are integers in the currency's minor unit (cents). $45.50 is 4550.
 */

export const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** Integer amount in the currency's minor unit. */
export type Minor = number;

const MINOR_EXPONENT: Record<CurrencyCode, number> = {
  CAD: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AUD: 2,
};

/** U+2212. ASCII hyphen reads as a dash next to tabular figures. */
const MINUS = "−";

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;

/** Users type amounts on a Persian keyboard; the form must accept ۴۵٫۵ as 45.5 */
export function normalizeDigits(input: string): string {
  let out = "";
  for (const char of input) {
    const code = char.codePointAt(0)!;
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) {
      out += String(code - PERSIAN_ZERO);
    } else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) {
      out += String(code - ARABIC_ZERO);
    } else if (char === "٫" || char === "،") {
      out += "."; // Arabic decimal separator, Arabic comma
    } else {
      out += char;
    }
  }
  return out;
}

export class MoneyParseError extends Error {}

/**
 * Parse human input into minor units without ever touching floating point.
 * "45.50" -> 4550. Throws on anything that is not a plain positive amount.
 */
export function toMinor(input: string | number, currency: CurrencyCode): Minor {
  const exponent = MINOR_EXPONENT[currency];
  const raw = normalizeDigits(String(input))
    .replace(/[\s,٬]/g, "")
    .trim();

  if (!/^-?\d*(\.\d*)?$/.test(raw) || raw === "" || raw === "." || raw === "-") {
    throw new MoneyParseError(`Not a valid amount: ${String(input)}`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = "0", fraction = ""] = unsigned.split(".");

  const padded = fraction.padEnd(exponent + 1, "0");
  const kept = padded.slice(0, exponent);
  const nextDigit = Number(padded[exponent] ?? "0");

  let minor = Number(`${whole}${kept}`);
  if (nextDigit >= 5) minor += 1;

  if (!Number.isSafeInteger(minor)) {
    throw new MoneyParseError(`Amount out of range: ${String(input)}`);
  }
  return negative ? -minor : minor;
}

/** Minor units back to a decimal number. Charts only — never for arithmetic. */
export function toMajor(minor: Minor, currency: CurrencyCode): number {
  return minor / 10 ** MINOR_EXPONENT[currency];
}

export function sumMinor(amounts: readonly Minor[]): Minor {
  return amounts.reduce((total, amount) => total + amount, 0);
}

export type FormatOptions = {
  /** Prefix with an explicit + or − even when positive. */
  signed?: boolean;
  /** Drop the currency symbol; used where a column header already states it. */
  omitSymbol?: boolean;
};

/**
 * Latin digits and a thousands separator, always. The returned string is
 * rendered by <Money /> inside a direction-isolated span so the currency
 * symbol keeps its place inside Persian text.
 */
export function formatMoney(
  minor: Minor,
  currency: CurrencyCode,
  options: FormatOptions = {},
): string {
  const exponent = MINOR_EXPONENT[currency];
  const negative = minor < 0;
  const absolute = Math.abs(minor);

  const formatter = new Intl.NumberFormat("en-US", {
    style: options.omitSymbol ? "decimal" : "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });

  const body = formatter.format(absolute / 10 ** exponent);

  if (negative) return `${MINUS}${body}`;
  if (options.signed) return `+${body}`;
  return body;
}

/** Savings rate as a whole percent. Returns null when income is zero. */
export function savingsRate(incomeMinor: Minor, expenseMinor: Minor): number | null {
  if (incomeMinor <= 0) return null;
  return Math.round(((incomeMinor - expenseMinor) / incomeMinor) * 1000) / 10;
}
