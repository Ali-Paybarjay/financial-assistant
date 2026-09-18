import { Money } from "@/components/money";
import { cn } from "@/lib/utils";
import { formatMonthFa } from "@/lib/date";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import type { GoalPlan } from "@/lib/goals";

/**
 * The sentence a goal is for: what to put aside this month, and what happens
 * to the date if you can't.
 *
 * Every branch names a number and, where the news is bad, the thing that would
 * fix it. «کم می‌آوری» on its own is a complaint, not a plan.
 */
export function GoalPlanLine({
  plan,
  currency,
  /** The goal currently taking the spare money, for a goal still in the queue. */
  aheadOf,
}: {
  plan: GoalPlan;
  currency: CurrencyCode;
  aheadOf?: string;
}) {
  const money = (minor: number) => <Money minor={minor} currency={currency} />;

  switch (plan.standing) {
    case "done":
      return <Line tone="positive">رسیدی. این هدف تمام است.</Line>;

    case "paused":
      return <Line tone="muted">متوقف است؛ چیزی از این ماه برنمی‌دارد.</Line>;

    case "on_track":
      return (
        <Line tone="positive">
          ماهی {money(plan.required ?? 0)} کنار بگذار تا{" "}
          {formatMonthFa(plan.goal.target_date!)} برسی.
        </Line>
      );

    case "overdue":
      return (
        <Line tone="bad">
          تاریخش گذشته و {money(plan.remaining)} مانده. یا همین ماه جبرانش کن، یا تاریخ
          تازه‌ای برایش بگذار.
        </Line>
      );

    case "short":
      return (
        <Line tone="caution">
          برای رسیدن به {formatMonthFa(plan.goal.target_date!)} ماهی{" "}
          {money(plan.required ?? 0)} لازم است، ولی{" "}
          {plan.allocated > 0 ? (
            <>فقط {money(plan.allocated)} برایش می‌ماند</>
          ) : (
            <>چیزی برایش نمی‌ماند</>
          )}
          .{" "}
          {plan.arrivesOn ? (
            <>با این حساب {formatMonthFa(plan.arrivesOn)} می‌رسی.</>
          ) : (
            <>با این حساب هیچ‌وقت نمی‌رسی.</>
          )}
        </Line>
      );

    case "undated":
      return (
        <Line tone="muted">
          ماهی {money(plan.allocated)} به این می‌رسد — حدود{" "}
          {formatMonthFa(plan.arrivesOn!)}، یعنی {faNumber(plan.monthsToArrive!)} ماه
          دیگر. تاریخ بگذاری، دقیق‌تر می‌گویم.
        </Line>
      );

    case "queued":
      return (
        <Line tone="muted">
          {aheadOf
            ? `فعلاً چیزی به این نمی‌رسد؛ اول «${aheadOf}».`
            : "فعلاً چیزی برای کنار گذاشتنش نمی‌ماند."}
        </Line>
      );
  }
}

/**
 * Colour carries the same three states the rest of the app uses, and never
 * alone: every line says in words what its colour says in colour.
 */
const TONE_CLASS = {
  positive: "bg-positive-tint text-positive",
  /** Reachable, but not by the date asked for. */
  caution: "bg-guess-tint text-guess-text",
  /** The date has already been missed. */
  bad: "bg-negative-tint text-negative",
  muted: "bg-paper text-ink-muted",
} as const;

function Line({
  tone,
  children,
}: {
  tone: keyof typeof TONE_CLASS;
  children: React.ReactNode;
}) {
  // A span, not a paragraph: the whole goal card is a button, and a button
  // may only contain phrasing content.
  return (
    <span className={cn("block rounded-control px-3 py-2 text-caption", TONE_CLASS[tone])}>
      {children}
    </span>
  );
}
