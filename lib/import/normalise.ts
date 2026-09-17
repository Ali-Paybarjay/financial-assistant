import { expandJalaliYear, jalaliToIso } from "@/lib/jalali";
import { addDays, daysBetween, type IsoDate } from "@/lib/date";
import { convertMinor, type CurrencyCode, type Minor } from "@/lib/money";
import type {
  ReviewableField,
  StatementClosingBalance,
  StatementLine,
} from "@/lib/ai/schemas";
import type { CategoryRow, StatementDirection } from "@/lib/supabase/database.types";

/**
 * Settling everything the model was not asked to decide.
 *
 * The statement prompt asks the model to read and nothing else: the date as
 * printed and which calendar it is, the amount in the unit the bank used, a
 * category slug it may well get wrong. Every one of those has a right answer,
 * and the right answers are computed here so that the same file read twice
 * produces the same rows.
 */

/** Data rows sent to the model per call when the file is a spreadsheet export. */
export const CSV_ROWS_PER_CALL = 80;

/** A statement date older than this is a misread, not history. */
const MAX_AGE_DAYS = 3650;
/** Postings a few days ahead are normal; a year ahead is a misread. */
const MAX_FUTURE_DAYS = 31;

/** Jalali years in use are around 1400, Gregorian ones around 2000. No overlap. */
const JALALI_YEAR_CEILING = 1700;

/** A line after every question with a right answer has been settled. */
export type NormalisedLine = {
  occurredOn: IsoDate;
  direction: StatementDirection;
  /** In the base currency, whatever unit the statement was written in. */
  amount: Minor;
  description: string;
  merchant: string | null;
  categorySlug: string;
  confidence: number;
  needsReview: ReviewableField[];
};

export type NormaliseContext = {
  today: IsoDate;
  statementCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  categories: CategoryRow[];
};

/**
 * Returns null for a row that cannot be trusted at all — a date outside living
 * memory, an amount that does not convert. A row dropped shows up in the
 * count the report prints; a row guessed does not.
 *
 * A category the user does not have does NOT drop the row, which is where this
 * differs from the receipt path. An outflow whose purpose cannot be worked out
 * is still an outflow, and recording it as «متفرقه» for the user to correct is
 * the whole point of importing a statement.
 */
export function normalise(
  raw: StatementLine,
  context: NormaliseContext,
): NormalisedLine | null {
  const occurredOn = resolveDate(raw.date, context.today);
  if (!occurredOn) return null;

  let amount: Minor;
  try {
    amount = convertMinor(
      raw.amount_minor,
      context.statementCurrency,
      context.baseCurrency,
    );
  } catch {
    return null;
  }
  if (amount <= 0) return null;

  const fallback = raw.direction === "in" ? "other-income" : "misc";
  const kind = raw.direction === "in" ? "income" : "expense";
  const wanted = context.categories.find((entry) => entry.slug === raw.category_slug);
  const usable = Boolean(wanted && wanted.kind === kind);

  const needsReview = new Set<ReviewableField>(raw.needs_review);
  // Nobody reads a category off a bank statement; it is always inferred, so
  // the rule is applied here rather than left to the model to remember.
  needsReview.add("category");
  // The amount is never a guess: an unreadable one costs the row, not a flag.
  needsReview.delete("amount");
  if (!raw.merchant) needsReview.delete("merchant");

  return {
    occurredOn,
    direction: raw.direction,
    amount,
    description: raw.description.trim().slice(0, 500) || "بدون شرح",
    merchant: raw.merchant?.trim().slice(0, 120) || null,
    categorySlug: usable ? raw.category_slug : fallback,
    // A fallback category is a weaker answer than the model claimed it was.
    confidence: usable ? raw.confidence : Math.min(raw.confidence, 0.4),
    needsReview: [...needsReview],
  };
}

/** What the statement said the account held, once settled like a row. */
export type NormalisedClosingBalance = {
  /** In the base currency. May be negative: a card closes owing. */
  amount: Minor;
  asOf: IsoDate;
};

/**
 * The closing balance, through the same date and currency machinery every row
 * goes through — so a rial statement read by a toman user does not offer a
 * balance ten times too large, and 1404-06-31 becomes a real date.
 *
 * Returns null rather than a guess for anything it cannot settle. The number
 * is about to be offered to the user as the truth about their account, which
 * is the last place a silent approximation belongs.
 */
export function normaliseClosingBalance(
  raw: StatementClosingBalance | null,
  context: NormaliseContext,
): NormalisedClosingBalance | null {
  if (!raw) return null;

  const asOf = resolveDate(raw.date, context.today);
  if (!asOf) return null;

  try {
    const amount = convertMinor(
      raw.amount_minor,
      context.statementCurrency,
      context.baseCurrency,
    );
    return { amount, asOf };
  } catch {
    return null;
  }
}

/**
 * The newest of the balances reported across a multi-call read.
 *
 * A long statement is read in several calls, and three monthly exports of one
 * account are three files; each may report the balance as of the end of its
 * own slice. The one the user is owed is the latest, and picking by date
 * rather than by arrival order is what makes the answer independent of which
 * call came back first.
 */
export function latestBalance(
  balances: readonly NormalisedClosingBalance[],
): NormalisedClosingBalance | null {
  return balances.reduce<NormalisedClosingBalance | null>(
    (newest, candidate) => (!newest || candidate.asOf >= newest.asOf ? candidate : newest),
    null,
  );
}

/**
 * The calendar is decided by the year rather than by the model's label: a
 * Jalali year cannot be 2025 and a Gregorian one cannot be 1404, so the
 * magnitude settles it even when the model labels it wrongly.
 */
export function resolveDate(date: string, today: IsoDate): IsoDate | null {
  const parts = date.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;

  const [year, month, day] = parts;
  let iso: IsoDate;

  if (year < JALALI_YEAR_CEILING) {
    try {
      iso = jalaliToIso(expandJalaliYear(year), month, day);
    } catch {
      return null;
    }
  } else {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    // The round trip is what catches 31 February.
    const check = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) {
      return null;
    }
  }

  if (daysBetween(iso, today) > MAX_AGE_DAYS) return null;
  if (iso > addDays(today, MAX_FUTURE_DAYS)) return null;

  return iso;
}

/**
 * Split a spreadsheet export into calls of a fixed number of data rows, with
 * the header repeated on each. Exact by construction: no row falls in two
 * chunks, so no row can be read twice and counted twice.
 */
export function spreadsheetChunks(text: string): string[] {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length === 0) return [];
  if (rows.length <= CSV_ROWS_PER_CALL + 1) return [rows.join("\n")];

  const [header, ...body] = rows;
  const chunks: string[] = [];

  for (let start = 0; start < body.length; start += CSV_ROWS_PER_CALL) {
    chunks.push([header, ...body.slice(start, start + CSV_ROWS_PER_CALL)].join("\n"));
  }

  return chunks;
}
