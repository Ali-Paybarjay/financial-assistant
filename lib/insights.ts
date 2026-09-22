import { daysBetween, type IsoDate } from "@/lib/date";
import { faCount } from "@/lib/format";
import { dailyAllowance, envelopeState, type EnvelopeRow } from "@/lib/envelopes";
import { requiredMonthly, type GoalWithProgress } from "@/lib/goals";
import { projectedMonthEnd } from "@/lib/cashflow";
import type { AccountRow } from "@/lib/supabase/database.types";
import type { Minor } from "@/lib/money";

/**
 * What the stream has to say, worked out from the ledger.
 *
 * Every rule here is arithmetic on figures that were read somewhere else.
 * Nothing in this module touches a database and nothing in it asks a model —
 * rule 5, «the model reads, it does not decide». An insight is a calculation,
 * so it is stated in the indicative: never «شاید», never «به نظر می‌رسد», and
 * never «هوش مصنوعی».
 *
 * Insights are not stored. They are derived per request and only their
 * dismissal is persisted, because a stored insight and a transaction edited
 * the next day come apart — and what the user is then shown is a confident
 * sentence about a number that no longer exists.
 *
 * An empty ledger produces an empty array. «Everything looks fine» is not an
 * insight; it is a sentence written to fill a screen, and it teaches people to
 * stop reading the ones that matter.
 */

export type InsightRule =
  | "pace_over"
  | "envelope_over"
  | "envelope_tight"
  | "weekly_delta"
  | "unconfirmed_backlog"
  | "statement_due"
  | "goal_at_risk"
  | "recurring_missed";

/**
 * A sentence, in pieces.
 *
 * The spec had `text: string`, which cannot survive rule 1: money has exactly
 * one rendering path in this app and it is the <Money> component, which
 * carries direction isolation and tabular figures that a formatted substring
 * inside a Persian sentence would lose. So a sentence is a list of parts and
 * the page renders the money ones itself — which also keeps this module a
 * pure function with no JSX in it, and therefore testable without a DOM.
 */
export type InsightPart =
  | { kind: "text"; value: string }
  | { kind: "money"; value: Minor }
  | { kind: "percent"; value: number };

export type Insight = {
  /** «rule:scope» — unique in its domain, and what a dismissal is keyed on. */
  key: string;
  rule: InsightRule;
  tone: "neutral" | "warn" | "good";
  parts: InsightPart[];
  action?: { label: string; href: string };
  /** Higher sorts first. */
  weight: number;
};

const text = (value: string): InsightPart => ({ kind: "text", value });
const money = (value: Minor): InsightPart => ({ kind: "money", value });
const percent = (value: number): InsightPart => ({ kind: "percent", value });

/**
 * What outranks what.
 *
 * The two at the top are not the most alarming, they are the most *actionable*
 * — and until they are dealt with, every other figure on this list is provisional.
 * There is no point ranking a sentence about this week's spending above the
 * warning that this week's spending is not all in yet.
 */
const WEIGHT: Record<InsightRule, number> = {
  recurring_missed: 100,
  unconfirmed_backlog: 90,
  envelope_over: 70,
  pace_over: 60,
  goal_at_risk: 50,
  envelope_tight: 40,
  statement_due: 30,
  weekly_delta: 20,
};

/** Spending this much faster than the day's share before it is worth saying. */
const PACE_TOLERANCE = 1.15;

/** Days of the month that have to have passed before a pace means anything. */
const PACE_MIN_DAYS = 5;

/** Days that must remain for «روزی چقدر» to still be advice. */
const TIGHT_MIN_DAYS_LEFT = 7;

/** How much a week has to move before the change is worth a sentence. */
const WEEKLY_DELTA = 0.15;

/** How old an unconfirmed guess has to be before it is a backlog. */
const STALE_HOURS = 48;

export function buildInsights(input: {
  /** YYYY-MM-DD in the user's timezone. */
  today: IsoDate;
  month: { start: IsoDate; end: IsoDate; daysGone: number; daysLeft: number };
  totals: {
    income: Minor;
    expense: Minor;
    unconfirmedCount: number;
    oldestUnconfirmedAt: string | null;
  };
  previousWeek: Minor;
  currentWeek: Minor;
  envelopes: EnvelopeRow[];
  goals: GoalWithProgress[];
  accountsDue: AccountRow[];
  missedRecurring: number;
  /** Keys the user has already waved away. */
  dismissedKeys: Set<string>;
  /** What a month is worth spare, for judging whether a goal still fits. */
  monthlySurplus: Minor;
}): Insight[] {
  const { month, totals, dismissedKeys } = input;
  const monthKey = month.start.slice(0, 7);
  const insights: Insight[] = [];

  const add = (
    rule: InsightRule,
    scope: string,
    tone: Insight["tone"],
    parts: InsightPart[],
    action?: Insight["action"],
  ) => {
    const key = `${rule}:${scope}`;
    if (dismissedKeys.has(key)) return;
    insights.push({ key, rule, tone, parts, action, weight: WEIGHT[rule] });
  };

  // ---- a fixed bill that never posted ------------------------------------
  // First, because until it is settled the month's expense total is short by
  // a rent, and every figure below is drawn from that total.
  if (input.missedRecurring > 0) {
    add(
      "recurring_missed",
      monthKey,
      "warn",
      [
        text(`${faCount(input.missedRecurring)} هزینهٔ ثابت ثبت نشده`),
        text("؛ تا ثبتشان، جمع ماه کامل نیست."),
      ],
      { label: "بررسی", href: "/income" },
    );
  }

  // ---- guesses nobody has confirmed --------------------------------------
  if (
    totals.unconfirmedCount > 0 &&
    totals.oldestUnconfirmedAt !== null &&
    hoursSince(totals.oldestUnconfirmedAt, input.today) >= STALE_HOURS
  ) {
    add(
      "unconfirmed_backlog",
      input.today,
      "warn",
      [
        text(`${faCount(totals.unconfirmedCount)} حدس تأییدنشده مانده`),
        text("؛ جمع ماه تا تأییدشان قطعی نیست."),
      ],
      { label: "بررسی", href: "/transactions" },
    );
  }

  // ---- envelopes past their ceiling --------------------------------------
  for (const envelope of input.envelopes) {
    const state = envelopeState(envelope.budget_minor, envelope.spent_minor);
    if (state !== "over") continue;
    add(
      "envelope_over",
      `${envelope.category_id}:${monthKey}`,
      "warn",
      [
        text(`پاکت «${envelope.name_fa}» `),
        money(Math.abs(envelope.remaining_minor ?? 0)),
        text(" از سقف رد شد."),
      ],
      { label: "سقف را ببر بالا", href: "/transactions" },
    );
  }

  // ---- the month's own pace ----------------------------------------------
  // Only once enough of the month has happened for a rate to mean anything.
  // On the 2nd, one large shop reads as a catastrophe.
  if (month.daysGone >= PACE_MIN_DAYS && month.daysLeft > 0) {
    const perDaySpent = totals.expense / month.daysGone;
    const perDayAllowed = (totals.income - totals.expense) / month.daysLeft;
    if (perDayAllowed >= 0 && perDaySpent > perDayAllowed * PACE_TOLERANCE) {
      const landing = projectedMonthEnd({
        income: totals.income,
        expense: totals.expense,
        daysGone: month.daysGone,
        daysInMonth: month.daysGone + month.daysLeft,
      });
      add(
        "pace_over",
        monthKey,
        landing < 0 ? "warn" : "neutral",
        [text("با این سرعت، ماه را با "), money(landing), text(" تمام می‌کنی.")],
        { label: "پاکت‌ها", href: "/dashboard" },
      );
    }
  }

  // ---- a goal that no longer fits ----------------------------------------
  for (const goal of input.goals) {
    const required = requiredMonthly(goal, input.today);
    if (required === null || required <= input.monthlySurplus) continue;
    add(
      "goal_at_risk",
      `${goal.id}:${monthKey}`,
      "warn",
      [
        text(`«${goal.title}» ماهی `),
        money(required),
        text(" می‌خواهد و این ماه "),
        money(Math.max(0, input.monthlySurplus)),
        text(" برایت می‌ماند."),
      ],
      { label: "برنامه", href: "/goals" },
    );
  }

  // ---- envelopes getting close -------------------------------------------
  for (const envelope of input.envelopes) {
    const state = envelopeState(envelope.budget_minor, envelope.spent_minor);
    if (state !== "tight" || month.daysLeft < TIGHT_MIN_DAYS_LEFT) continue;
    const perDay = dailyAllowance(
      envelope.budget_minor,
      envelope.spent_minor,
      month.daysLeft,
    );
    if (perDay === null) continue;
    add(
      "envelope_tight",
      `${envelope.category_id}:${weekKey(input.today)}`,
      "neutral",
      [
        text(`از «${envelope.name_fa}» `),
        money(envelope.remaining_minor ?? 0),
        text(" مانده — روزی "),
        money(perDay),
        text(" تا آخر ماه."),
      ],
      { label: "پاکت", href: "/transactions" },
    );
  }

  // ---- an account the bank has not been checked against ------------------
  for (const account of input.accountsDue) {
    add(
      "statement_due",
      `${account.id}:${monthKey}`,
      "neutral",
      [
        text(`پرینت «${account.title}» را آپلود کن تا موجودی با بانک یکی شود.`),
      ],
      { label: "صورت‌حساب", href: "/import" },
    );
  }

  // ---- how this week compares to the last one ----------------------------
  if (input.previousWeek > 0) {
    const change = (input.currentWeek - input.previousWeek) / input.previousWeek;
    if (Math.abs(change) >= WEEKLY_DELTA) {
      add(
        "weekly_delta",
        weekKey(input.today),
        "neutral",
        [
          text("این هفته "),
          money(input.currentWeek),
          text(" خرج کرده‌ای؛ "),
          percent(Math.round(Math.abs(change) * 100)),
          text(change > 0 ? " بیشتر از هفتهٔ قبل." : " کمتر از هفتهٔ قبل."),
        ],
        { label: "جزئیات", href: "/transactions" },
      );
    }
  }

  return insights.sort((a, b) => b.weight - a.weight);
}

/**
 * The ISO week a date falls in, as «2026-W38».
 *
 * Used as the scope for the rules that repeat weekly, so the same observation
 * dismissed on Monday stays dismissed until the week turns over rather than
 * coming back the next morning with a new key.
 */
export function weekKey(date: IsoDate): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  // ISO weeks run Monday to Sunday and belong to the year containing their
  // Thursday, which is what this shift finds.
  const weekday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - weekday + 3);
  const thursday = utc.getTime();
  const firstThursday = new Date(Date.UTC(utc.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week =
    1 + Math.round((thursday - firstThursday.getTime()) / (7 * 86_400_000));
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Hours between a timestamp and the start of `today`, in whole hours. */
function hoursSince(timestamp: string, today: IsoDate): number {
  const then = timestamp.slice(0, 10);
  return daysBetween(then, today) * 24;
}
