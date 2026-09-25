"use client";

import Link from "next/link";
import { Tray, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import {
  dailyAllowance,
  envelopeState,
  fillPercent,
  remaining,
  type Envelope,
} from "@/lib/envelopes";
import { cn } from "@/lib/utils";

/**
 * One envelope on the board.
 *
 * The big figure is what is LEFT, not what was spent: «چقدر مانده» is the
 * question the month is actually about, and a card that answers «چقدر خرج شد»
 * makes the reader do the subtraction.
 *
 * Five states, in the grammar the rest of the app already speaks:
 *   unset  dashed frame, no bar — a decision nobody has made yet
 *   under  ink bar
 *   tight  brass, and the line says what is left per day
 *   over   red bar, negative figure
 *   +unconfirmed  striped bar and a dashed rule under the figure: this sum is
 *                 not settled either
 */
export function EnvelopeCard({
  envelope,
  currency,
  daysLeft,
  /** Median of the last three months, for the «سقف بگذار» invitation. */
  suggestion,
  onSetBudget,
}: {
  envelope: Envelope;
  currency: CurrencyCode;
  daysLeft: number;
  suggestion?: number | null;
  onSetBudget: (categoryId: string) => void;
}) {
  const state = envelopeState(envelope.budget, envelope.spent);
  const left = remaining(envelope.budget, envelope.spent);
  const hasUnconfirmed = envelope.unconfirmed > 0;

  if (state === "unset") {
    return (
      <div className="col-span-2 flex items-center gap-3 rounded-well border-[1.5px] border-dashed border-hairline-strong p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-muted">
          <Tray size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink">
            {envelope.name} — سقف نداری
          </span>
          <span className="mt-0.5 block text-micro text-ink-faint">
            این ماه <Money minor={envelope.spent} currency={currency} />
            {suggestion != null && (
              <>
                {" · میانهٔ ۳ ماه "}
                <Money minor={suggestion} currency={currency} />
              </>
            )}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onSetBudget(envelope.categoryId)}
          className="h-8 shrink-0 rounded-full border border-action px-3 text-caption font-semibold text-action transition-colors hover:bg-action-tint"
        >
          سقف بگذار
        </button>
      </div>
    );
  }

  const perDay = dailyAllowance(envelope.budget, envelope.spent, daysLeft);

  return (
    <Link
      href={`/transactions?category=${envelope.categoryId}`}
      className={cn(
        "flex flex-col rounded-well border p-3 transition-colors",
        state === "tight"
          ? "border-guess-border bg-guess-tint"
          : "border-hairline hover:border-hairline-strong",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-caption",
          state === "tight" ? "text-guess-text" : "text-ink-muted",
        )}
      >
        {envelope.name}
        {state === "tight" && <WarningCircle size={13} aria-hidden />}
      </span>

      <Money
        minor={left ?? 0}
        currency={currency}
        size="row"
        className={cn(
          "mt-1.5 w-fit text-[17px] font-bold",
          state === "over" && "text-negative",
          hasUnconfirmed && "rule-guess",
        )}
      />

      <span
        className={cn(
          "mt-0.5 text-micro",
          state === "tight" ? "text-guess-text" : "text-ink-faint",
        )}
      >
        {hasUnconfirmed ? (
          <>
            شامل <Money minor={envelope.unconfirmed} currency={currency} /> تأییدنشده
          </>
        ) : state === "over" ? (
          <>
            از سقف <Money minor={envelope.budget ?? 0} currency={currency} /> رد شد
          </>
        ) : state === "tight" && perDay !== null ? (
          <>
            روزی <Money minor={perDay} currency={currency} /> تا آخر ماه
          </>
        ) : (
          <>
            از <Money minor={envelope.budget ?? 0} currency={currency} /> مانده
          </>
        )}
      </span>

      {/* The bar fills from the reading start, so it empties towards the left
          exactly as the runway above it does. */}
      <span
        role="progressbar"
        aria-valuenow={fillPercent(envelope.budget, envelope.spent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${envelope.name} — ${faNumber(fillPercent(envelope.budget, envelope.spent))}٪`}
        className={cn(
          "mt-2.5 flex h-1.5 justify-end overflow-hidden rounded-full",
          state === "tight" ? "bg-guess-border/60" : "bg-paper",
        )}
      >
        <span
          className={cn(
            "h-full rounded-full",
            state === "over"
              ? "bg-negative"
              : state === "tight"
                ? "bg-guess"
                : hasUnconfirmed
                  ? "bar-unconfirmed"
                  : "bg-action",
          )}
          style={{ width: `${Math.max(fillPercent(envelope.budget, envelope.spent), 4)}%` }}
        />
      </span>
    </Link>
  );
}
