"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Money } from "@/components/money";
import { BudgetSheet } from "@/components/dashboard/budget-sheet";
import { setEnvelopeOnBoard } from "@/app/(app)/dashboard/budget-actions";
import { faNumber } from "@/lib/format";
import {
  dailyAllowance,
  envelopeState,
  projectedSpend,
  type EnvelopeRow,
} from "@/lib/envelopes";
import type { CurrencyCode, Minor } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The ceiling, above the rows it is made of.
 *
 * This is the other half of tapping an envelope: the board says how much is
 * left, and this says the same thing beside the purchases that got it there.
 *
 * It is also the only place a ceiling can be changed. The board's cards are
 * links — a card that both navigated and opened an editor would have to guess
 * which one a tap meant — so «ویرایش سقف» lives here, one tap further in,
 * next to the evidence for whether the number was right in the first place.
 */
export function EnvelopeHeader({
  envelope,
  observedMedian,
  currency,
  daysGone,
  daysLeft,
  rowCount,
}: {
  envelope: EnvelopeRow;
  /** Three months of real spending, where there are three months of it. */
  observedMedian: Minor | null;
  currency: CurrencyCode;
  daysGone: number;
  daysLeft: number;
  rowCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isRemoving, startRemoving] = useTransition();

  /**
   * Off the board, and it stays off. The spending is untouched — it is still
   * in this list and still in the month's total; what goes is the card.
   */
  function removeFromBoard() {
    startRemoving(async () => {
      await setEnvelopeOnBoard(envelope.category_id, false);
      router.push("/dashboard");
    });
  }

  const removeButton = (
    <button
      type="button"
      onClick={removeFromBoard}
      disabled={isRemoving}
      className="text-caption font-medium text-ink-muted hover:text-negative hover:underline disabled:opacity-50"
    >
      {isRemoving ? "دارم برمی‌دارم…" : "حذف از بورد"}
    </button>
  );
  const { budget_minor: budget, spent_minor: spent } = envelope;
  const state = envelopeState(budget, spent);
  const perDay = dailyAllowance(budget, spent, daysLeft);
  const projected = projectedSpend(spent, daysGone, daysGone + daysLeft);
  const remaining = envelope.remaining_minor ?? 0;
  const filled =
    budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  const sheet = (
    <BudgetSheet
      envelope={editing ? envelope : null}
      observedMedian={observedMedian}
      currency={currency}
      open={editing}
      onOpenChange={setEditing}
    />
  );

  if (budget === null) {
    return (
      <section className="mt-4 rounded-card border border-dashed border-hairline-strong p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-body font-semibold text-ink">
            {envelope.name_fa} — سقف نداری
          </h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-caption font-semibold text-action"
          >
            سقف بگذار
          </button>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="text-caption text-ink-muted">
            این ماه <Money minor={spent} currency={currency} /> خرج این دسته شده.
          </p>
          {removeButton}
        </div>
        {sheet}
      </section>
    );
  }

  return (
    <section
      className={cn(
        "mt-4 rounded-card border p-4",
        state === "tight"
          ? "border-guess-border bg-guess-tint"
          : "border-hairline bg-surface",
      )}
    >
      <div className="@container flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-caption text-ink-muted">
            {state === "over" ? "از سقف رد شده" : "مانده"}
          </p>
          {/* Size on the wrapper, colour on <Money>: tailwind-merge cannot
              tell a custom colour from a font size, so the two in one
              className would have the colour delete the size. */}
          <span className="mt-0.5 block font-display text-[clamp(1.375rem,8cqw,2rem)] leading-[1.1] font-extrabold">
            <Money
              minor={remaining}
              currency={currency}
              signed={state === "over"}
              className={state === "over" ? "text-negative" : "text-ink"}
            />
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 text-caption font-semibold text-action"
        >
          ویرایش سقف
        </button>
      </div>

      <p className="mt-1 text-caption text-ink-muted">
        <Money minor={spent} currency={currency} /> از سقف{" "}
        <Money minor={budget} currency={currency} />
        {daysLeft > 0 && <> · {faNumber(daysLeft)} روز مانده</>}
      </p>

      <span
        role="progressbar"
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${envelope.name_fa} — ${STATE_LABEL[state]}`}
        className="mt-2.5 block h-2 overflow-hidden rounded-full bg-paper"
      >
        <span
          className={cn(
            "block h-full rounded-full",
            state === "over" && "bg-negative",
            state === "tight" && "bg-guess",
            state === "under" && "bg-action",
          )}
          style={{ width: `${state === "over" ? 100 : filled}%` }}
        />
      </span>

      {/* The projection the card on the board has no room for. Dashed,
          because it has not happened. */}
      {daysGone > 0 && (
        <p className="mt-3 border-t border-hairline pt-3 text-body text-ink">
          اگر تا آخر ماه با همین سرعت بروی،{" "}
          <Money
            minor={projected}
            currency={currency}
            className="border-b-2 border-dashed border-guess pb-[1px] font-semibold text-guess-text"
          />{" "}
          می‌شود.
        </p>
      )}

      <p className="mt-1.5 text-caption text-ink-muted">
        {perDay !== null && perDay > 0 ? (
          <>
            برای ماندن سر سقف، از امروز روزی{" "}
            <Money minor={perDay} currency={currency} />.
          </>
        ) : (
          <>این پاکت همین حالا تمام شده است.</>
        )}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-3">
        <p className="text-caption font-semibold text-ink-muted">
          {faNumber(rowCount)} ردیف در این پاکت
        </p>
        {removeButton}
      </div>

      {sheet}
    </section>
  );
}

/** The state in words, so the bar never carries the meaning on colour alone. */
const STATE_LABEL: Record<string, string> = {
  under: "سر جا",
  tight: "نزدیک سقف",
  over: "از سقف رد شده",
  unset: "بی‌سقف",
};
