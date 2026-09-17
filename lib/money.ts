/**
 * The only permitted path for converting, summing and formatting money.
 * Nothing else in the codebase may do arithmetic on an amount or call
 * Intl.NumberFormat on one.
 *
 * Amounts are integers in the currency's minor unit (cents). $45.50 is 4550.
 */

export const CURRENCIES = [
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "SEK",
  "IRT",
  "IRR",
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** Integer amount in the currency's minor unit. */
export type Minor = number;

const MINOR_EXPONENT: Record<CurrencyCode, number> = {
  CAD: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AUD: 2,
  SEK: 2,
  // Iranian amounts are whole units. The rial's two official decimals have no
  // circulating coin behind them and nobody types them; the toman has none at
  // all. An exponent of 0 means a minor unit here *is* a toman or a rial.
  IRT: 0,
  IRR: 0,
};

/**
 * Currencies whose symbol is a word, written after the amount. Being in this
 * map is what makes a symbol trail, and entries land here for two reasons:
 *
 * - "IRT" is not an ISO 4217 code — no code exists for the toman, and this is
 *   the one the exchanges settled on. Intl therefore has no symbol for it, and
 *   prints "IRR" for the rial rather than a symbol, so both words are supplied
 *   here. They follow the amount, the way Persian writes them.
 * - Intl does know "kr", but puts it in front under the en-US formatting this
 *   module standardises on. Swedish writes it after, so the position is
 *   overridden even though the glyph would have been right.
 */
const SYMBOL_OVERRIDE: Partial<Record<CurrencyCode, string>> = {
  SEK: "kr",
  IRT: "تومان",
  IRR: "ریال",
};

/** How many decimal places this currency has. */
export function minorExponent(currency: CurrencyCode): number {
  return MINOR_EXPONENT[currency];
}

/** True when the symbol is a word that belongs after the amount, not before. */
export function symbolTrails(currency: CurrencyCode): boolean {
  return currency in SYMBOL_OVERRIDE;
}

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
    } else if (char === "٫") {
      out += "."; // U+066B, the Persian decimal mark.
    } else if (char === "،") {
      // U+060C is the Persian comma. It is not a decimal mark — it is the key
      // people reach for when they group thousands — so it becomes a comma and
      // the separator rules below decide what it meant.
      out += ",";
    } else {
      out += char;
    }
  }
  return out;
}

export class MoneyParseError extends Error {}

/** Grouping is 1–3 digits, then groups of exactly 3. "12.3.4" is not a number. */
const GROUPED_BY_DOT = /^\d{1,3}(?:\.\d{3})+$/;
const GROUPED_BY_COMMA = /^\d{1,3}(?:,\d{3})+$/;

/**
 * Rewrite a human amount so the only separator left is one "." for the decimal.
 *
 * Seven of the thirteen countries this app supports write the decimal with a
 * comma — Sweden, Germany, France, Spain, Italy, Austria, Belgium — and every
 * comma used to be stripped as grouping, so "1234,50" was read as 123,450.
 *
 * A comma is the decimal mark when either:
 *  - a dot appears before it, the way German writes "1.234,50"; or
 *  - it is the only comma and at most two digits follow it, the shape of
 *    "1234,50" and "0,5".
 * Otherwise it groups, so "1,234" is still one thousand two hundred and
 * thirty-four, and grouping is verified rather than assumed — "1,23,456"
 * throws rather than quietly becoming 123,456.
 *
 * A string with no comma is left exactly as it was, which keeps the dot the
 * unambiguous decimal mark it has always been here: "1.005" is one and a half
 * cent rounded, not one thousand and five.
 */
function toPlainDecimal(unsigned: string): string {
  if (!unsigned.includes(",")) return unsigned;

  const lastDot = unsigned.lastIndexOf(".");
  const lastComma = unsigned.lastIndexOf(",");

  const commaIsDecimal =
    lastDot >= 0
      ? lastComma > lastDot
      : unsigned.indexOf(",") === lastComma && unsigned.length - lastComma - 1 <= 2;

  const decimalAt = commaIsDecimal ? lastComma : lastDot;
  const groupMark = commaIsDecimal ? "." : ",";

  const integerPart = decimalAt >= 0 ? unsigned.slice(0, decimalAt) : unsigned;
  const fractionPart = decimalAt >= 0 ? unsigned.slice(decimalAt + 1) : "";

  if (integerPart.includes(groupMark)) {
    const grouped = groupMark === "." ? GROUPED_BY_DOT : GROUPED_BY_COMMA;
    if (!grouped.test(integerPart)) {
      throw new MoneyParseError(`Not a valid amount: ${unsigned}`);
    }
  }

  const whole = integerPart.split(groupMark).join("");
  return fractionPart ? `${whole}.${fractionPart}` : whole;
}

/**
 * Parse human input into minor units without ever touching floating point.
 * "45.50" -> 4550. Throws on anything that is not a plain positive amount.
 */
export function toMinor(input: string | number, currency: CurrencyCode): Minor {
  const exponent = MINOR_EXPONENT[currency];
  // \s covers the no-break and narrow no-break spaces French and Swedish group
  // with; ٬ (U+066C) is the Persian thousands mark and never anything else.
  const raw = normalizeDigits(String(input))
    .replace(/[\s٬]/g, "")
    .trim();

  const negative = raw.startsWith("-");
  const plain = toPlainDecimal(negative ? raw.slice(1) : raw);

  if (!/^\d*(\.\d*)?$/.test(plain) || plain === "" || plain === ".") {
    throw new MoneyParseError(`Not a valid amount: ${String(input)}`);
  }

  const [whole = "0", fraction = ""] = plain.split(".");

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
  const override = SYMBOL_OVERRIDE[currency];

  const formatter = new Intl.NumberFormat("en-US", {
    style: options.omitSymbol || override ? "decimal" : "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });

  const digits = formatter.format(absolute / 10 ** exponent);
  const body = override && !options.omitSymbol ? `${digits} ${override}` : digits;

  if (negative) return `${MINUS}${body}`;
  if (options.signed) return `+${body}`;
  return body;
}

/** The narrow symbol only ("$", "€", "تومان"), to label an input with. */
export function currencySymbol(currency: CurrencyCode): string {
  return (
    SYMBOL_OVERRIDE[currency] ??
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

/** Savings rate as a whole percent. Returns null when income is zero. */
export function savingsRate(incomeMinor: Minor, expenseMinor: Minor): number | null {
  if (incomeMinor <= 0) return null;
  return Math.round(((incomeMinor - expenseMinor) / incomeMinor) * 1000) / 10;
}

/**
 * Currencies that are the same money written at a different scale. The rial
 * and the toman are one currency with two units — ten rial to the toman — and
 * an Iranian bank prints statements in rial while the account holder thinks in
 * toman. Importing one into the other without this would be a ten-fold error
 * on every row.
 *
 * Nothing else belongs here. A genuine cross-currency import needs the rate
 * that applied on the day of each transaction, which this app does not have.
 */
const UNIT_SIBLINGS: Partial<Record<CurrencyCode, Partial<Record<CurrencyCode, number>>>> =
  {
    // Multiply by the factor to go from the key currency to the inner one.
    IRR: { IRT: 0.1 },
    IRT: { IRR: 10 },
  };

export class CurrencyMismatchError extends Error {}

/** The currencies a statement may be written in for a given base currency. */
export function convertibleFrom(currency: CurrencyCode): CurrencyCode[] {
  const siblings = Object.keys(UNIT_SIBLINGS[currency] ?? {}) as CurrencyCode[];
  return [currency, ...siblings];
}

/**
 * `convertMinor(450000, 'IRR', 'IRT')` -> 45000.
 *
 * Throws on any pair that is not the same currency or its sibling unit: a
 * silent wrong conversion is worse than a refused import.
 */
export function convertMinor(
  amount: Minor,
  from: CurrencyCode,
  to: CurrencyCode,
): Minor {
  if (from === to) return amount;

  const factor = UNIT_SIBLINGS[from]?.[to];
  if (factor === undefined) {
    throw new CurrencyMismatchError(`Cannot convert ${from} to ${to}`);
  }

  const converted = amount * factor;
  // Rial amounts are whole tomans in all but name, but a stray 5 rial on a fee
  // row must not silently vanish into 0.
  return converted < 0 ? -Math.round(-converted) : Math.round(converted);
}
