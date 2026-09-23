"use client";

import { Envelope } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { suggestedCeiling, type EnvelopeRow } from "@/lib/envelopes";
import type { CurrencyCode, Minor } from "@/lib/money";

/**
 * The board, explained once, to someone who has not set a single ceiling.
 *
 * Without any ceilings the board is a row of «سقف نداری» cards, which shows
 * the shape of the feature and never says what it is for. This says it, in
 * the place where it is true, and offers the three categories the answer is
 * most obviously about.
 *
 * It is not an onboarding step. Asked during signup it would arrive before
 * there is any spending to suggest a ceiling from — `suggestBudget` needs two
 * months of history and a new account has none — so every figure would be
 * blank and the question would be «what should your grocery budget be?» asked
 * of someone who has not yet recorded a grocery shop.
 *
 * The way out is the balance above it, which is the answer for anyone who
 * does not want envelopes: the month still adds up without them.
 */
export function BudgetInvite({
  candidates,
  observedMedians,
  currency,
  onSetBudget,
  onDismiss,
}: {
  /** The three categories worth asking about first. */
  candidates: EnvelopeRow[];
  /** categoryId -> three months of real spending, where there is any. */
  observedMedians: Record<string, Minor>;
  currency: CurrencyCode;
  onSetBudget: (envelope: EnvelopeRow) => void;
  onDismiss: () => void;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action-tint text-action">
          <Envelope size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold text-ink">
            یک سقف بگذار تا بدانی چقدر مانده
          </h2>
          <p className="mt-1 text-caption text-ink-muted">
            بدون سقف فقط می‌دانی چقدر خرج کرده‌ای. با سقف، هر دسته می‌گوید تا آخر ماه
            چقدر برایت مانده.
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {candidates.map((envelope) => {
          const suggestion = suggestedCeiling(
            envelope,
            observedMedians[envelope.category_id],
          );
          return (
          <li
            key={envelope.category_id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-paper px-3 py-2"
          >
            <span className="min-w-0 flex-1 basis-[55%]">
              <span className="block truncate text-[14px] font-medium text-ink">
                {envelope.name_fa}
              </span>
              {(envelope.spent_minor > 0 || suggestion) && (
                <span className="block text-caption text-ink-muted">
                  {envelope.spent_minor > 0 && (
                    <>
                      این ماه{" "}
                      <Money minor={envelope.spent_minor} currency={currency} />
                    </>
                  )}
                  {suggestion && (
                    <>
                      {envelope.spent_minor > 0 && " · "}
                      {suggestion.source === "observed"
                        ? "میانهٔ ۳ ماه "
                        : "در ثبت‌نام گفتی "}
                      <Money minor={suggestion.amount} currency={currency} />
                    </>
                  )}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onSetBudget(envelope)}
              className="h-9 shrink-0 rounded-full border border-action px-4 text-caption font-semibold text-action transition-colors hover:bg-action-tint"
            >
              سقف بگذار
            </button>
          </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 text-caption font-medium text-ink-muted hover:text-ink hover:underline"
      >
        فعلاً نه — همان مانده‌ی ماه کافی است
      </button>
    </section>
  );
}
