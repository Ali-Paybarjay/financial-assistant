/**
 * "This month" is always the user's month, never UTC's. A purchase made at
 * 23:30 in Vancouver belongs to that day, not to tomorrow in London.
 *
 * Transaction dates are calendar dates (`date` in Postgres), so every helper
 * here speaks YYYY-MM-DD strings and never a timestamp.
 */

export type IsoDate = string; // YYYY-MM-DD

const ISO_PARTS = new Map<string, Intl.DateTimeFormat>();

function isoFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = ISO_PARTS.get(timeZone);
  if (!formatter) {
    // en-CA renders as YYYY-MM-DD, which is the shape we store.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    ISO_PARTS.set(timeZone, formatter);
  }
  return formatter;
}

/** Today's calendar date in the user's timezone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): IsoDate {
  return isoFormatter(timeZone).format(now);
}

export type MonthRange = {
  /** First day of the month, YYYY-MM-01. Also the key used for month selection. */
  month: IsoDate;
  from: IsoDate;
  to: IsoDate;
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const ISO_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether a string is a calendar date this module can work with.
 *
 * Shape *and* arithmetic: "2026-13-01" and "2026-02-30" both match the pattern
 * and neither is a day. Checked by round-tripping through UTC, because that is
 * the one operation every helper here depends on being meaningful.
 */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_SHAPE.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  // Date rolls 31 February forward into March rather than rejecting it, so the
  // parts have to come back out the same as they went in.
  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day)
  );
}

/**
 * A month key out of a URL, or this month.
 *
 * `/dashboard?month=bad-date` used to reach `monthRange` unchecked, where
 * `"bad-date".split("-").map(Number)` produced NaN, the range came out as
 * `"NaN-NaN-01"`, and the page answered with the error screen. A query string is
 * the most-edited input in any web app — a link somebody shortened, a bookmark
 * from a version that named the parameter differently, a crawler — and the right
 * answer to one that makes no sense is the sensible page, not a crash. F13.
 *
 * Every page that reads a month from its query string goes through here, so
 * «what does an unparseable month mean» has one answer.
 */
export function monthKeyFromParam(
  raw: unknown,
  timeZone: string,
  now?: Date,
): IsoDate {
  const today = todayInTimeZone(timeZone, now);
  if (!isIsoDate(raw)) return monthRange(timeZone, today).month;

  const { month } = monthRange(timeZone, raw);
  // A month in the future is not browsable — the stepper's «next» is disabled at
  // the current month — so a hand-typed one lands on this month rather than on an
  // empty page with no way forward.
  return month > monthRange(timeZone, today).month
    ? monthRange(timeZone, today).month
    : month;
}

/**
 * The calendar month containing `anchor` (default: today in `timeZone`).
 * Both bounds are inclusive.
 *
 * Throws on anything that is not a calendar date. It used to produce
 * `"NaN-NaN-01"` instead, which travelled into a Postgres query as a date
 * literal and surfaced three layers away as an unexplained page error. A caller
 * holding user input wants `monthKeyFromParam`, which has a fallback; a caller
 * holding a date wants to hear about it if that turns out to be false.
 */
export function monthRange(timeZone: string, anchor?: IsoDate, now?: Date): MonthRange {
  const base = anchor ?? todayInTimeZone(timeZone, now);
  if (!isIsoDate(base)) {
    throw new RangeError(`monthRange needs a YYYY-MM-DD date, got ${String(base)}`);
  }

  const [year, month] = base.split("-").map(Number);
  const last = daysInMonth(year, month);
  return {
    month: `${year}-${pad(month)}-01`,
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
  };
}

/** Step a month key forward or backward. `shiftMonth('2026-09-01', -1)` -> '2026-08-01'. */
export function shiftMonth(month: IsoDate, delta: number): IsoDate {
  const [year, monthNumber] = month.split("-").map(Number);
  const zeroBased = monthNumber - 1 + delta;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = ((zeroBased % 12) + 12) % 12;
  return `${targetYear}-${pad(targetMonth + 1)}-01`;
}

export function daysLeftInMonth(timeZone: string, anchor?: IsoDate, now?: Date): number {
  const today = anchor ?? todayInTimeZone(timeZone, now);
  const { to } = monthRange(timeZone, today);
  return Number(to.split("-")[2]) - Number(today.split("-")[2]);
}

/**
 * Days since the Unix epoch. Calendar dates only, so there is no timezone in
 * play and no DST hour to lose — subtracting two of these gives the number of
 * nights between the dates, which is what "three days apart" means.
 */
export function epochDay(date: IsoDate): number {
  return asUtcDate(date).getTime() / 86_400_000;
}

/** Nights between two calendar dates. Negative when `to` precedes `from`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return epochDay(to) - epochDay(from);
}

/**
 * Whole calendar months from one date to another, signed. Only the year and
 * the month are read, so this counts the number of month boundaries crossed —
 * which is what «how many more times will I be paid before then» means.
 * `monthsBetween('2026-09-18', '2026-12-01')` -> 3.
 */
export function monthsBetween(from: IsoDate, to: IsoDate): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/** Step a calendar date by whole days. `addDays('2026-02-28', 1)` -> '2026-03-01'. */
export function addDays(date: IsoDate, delta: number): IsoDate {
  const shifted = new Date(asUtcDate(date).getTime() + delta * 86_400_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/**
 * The instant at which a calendar date began in `timeZone`. Used for "today's
 * usage" windows, which must follow the user's midnight rather than UTC's.
 */
export function startOfDayUtc(date: IsoDate, timeZone: string): Date {
  const naive = new Date(`${date}T00:00:00Z`);
  const asLocal = new Date(naive.toLocaleString("en-US", { timeZone }));
  const asUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(naive.getTime() - (asLocal.getTime() - asUtc.getTime()));
}

const FA_DATE = new Intl.DateTimeFormat("fa-IR-u-ca-gregory", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const FA_DAY_MONTH = new Intl.DateTimeFormat("fa-IR-u-ca-gregory", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
});

function asUtcDate(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "۱۶ سپتامبر ۲۰۲۶" — Persian digits, Gregorian calendar. */
export function formatDateFa(date: IsoDate): string {
  return FA_DATE.format(asUtcDate(date));
}

/** "۱۶ سپتامبر" — for day-group headings where the year is implied. */
export function formatDayMonthFa(date: IsoDate): string {
  return FA_DAY_MONTH.format(asUtcDate(date));
}

/** "سپتامبر ۲۰۲۶" — the month selector label. */
export function formatMonthFa(month: IsoDate): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-gregory", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(asUtcDate(month));
}
