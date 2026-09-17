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

/**
 * The calendar month containing `anchor` (default: today in `timeZone`).
 * Both bounds are inclusive.
 */
export function monthRange(timeZone: string, anchor?: IsoDate, now?: Date): MonthRange {
  const base = anchor ?? todayInTimeZone(timeZone, now);
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
