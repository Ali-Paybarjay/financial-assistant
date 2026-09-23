import Link from "next/link";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import {
  dailyAllowance,
  envelopeState,
  suggestedCeiling,
  type EnvelopeRow,
} from "@/lib/envelopes";
import type { CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * One envelope on the board.
 *
 * The big number is always what is **left**, never what was spent. The
 * question a person opens this app to answer is «how much have I got», and
 * answering it with a spend figure makes them do the subtraction themselves
 * every time — including the month they are over, where the subtraction they
 * do in their head is the one they least want to get wrong.
 *
 * Four states and one modifier, and every one of them says what it means in
 * words as well as colour: the bar is never the only thing that distinguishes
 * an envelope that is fine from one that is not.
 */
export function EnvelopeCard({
  envelope,
  currency,
  daysLeft,
  href,
}: {
  envelope: EnvelopeRow;
  currency: CurrencyCode;
  daysLeft: number;
  /** The ledger, filtered to this category. */
  href: string;
}) {
  const { budget_minor: budget, spent_minor: spent, unconfirmed_minor: unconfirmed } =
    envelope;
  const state = envelopeState(budget, spent);
  const remaining = envelope.remaining_minor ?? 0;
  const hasUnconfirmed = unconfirmed > 0;

  // The bar fills as the envelope empties. Clamped, because past the ceiling
  // there is no more bar to give and the colour carries the rest.
  const filled =
    budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  const perDay = dailyAllowance(budget, spent, daysLeft);

  return (
    <Link
      href={href}
      className={cn(
        // A container query, because the card is half a phone wide and a
        // third of a desktop column wide, and the figure has to fit both.
        "@container flex min-w-0 flex-col gap-2 overflow-hidden rounded-card border p-3 transition-colors",
        state === "tight"
          ? "border-guess-border bg-guess-tint hover:border-guess"
          : "border-hairline bg-surface hover:border-hairline-strong",
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="truncate text-caption font-medium text-ink-muted">
          {envelope.name_fa}
        </span>
        {state === "tight" && (
          <Warning size={14} weight="fill" className="shrink-0 text-guess" />
        )}
      </span>

      {/* The dashed rule under the figure is the app's one grammar: a total
          holding an unconfirmed guess is not final, and says so the same way
          every guessed value in the product does.

          The size sits on this wrapper and the colour on <Money>, never both
          in one className: tailwind-merge cannot tell a custom colour from a
          font size and would drop one of them. */}
      <span
        className={cn(
          "block w-fit max-w-full font-display text-[clamp(1rem,13cqw,1.5rem)] leading-tight font-extrabold",
          hasUnconfirmed && "border-b-2 border-dashed border-guess pb-[2px]",
        )}
      >
        <Money
          minor={remaining}
          currency={currency}
          signed={state === "over"}
          className={state === "over" ? "text-negative" : "text-ink"}
        />
      </span>

      <span className="text-caption text-ink-muted">
        {state === "over" && budget !== null && (
          <>
            از سقف <Money minor={budget} currency={currency} /> رد شد
          </>
        )}
        {state === "tight" && perDay !== null && (
          <span className="text-guess-text">
            روزی <Money minor={perDay} currency={currency} /> تا آخر ماه
          </span>
        )}
        {state === "under" && budget !== null && (
          <>
            از <Money minor={budget} currency={currency} /> مانده
          </>
        )}
      </span>

      {hasUnconfirmed && (
        <span className="text-caption text-guess-text">
          شامل <Money minor={unconfirmed} currency={currency} /> تأییدنشده
        </span>
      )}

      {budget !== null && (
        <span
          role="progressbar"
          aria-valuenow={filled}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${envelope.name_fa} — ${STATE_LABEL[state]}`}
          className="h-2 overflow-hidden rounded-full bg-paper"
        >
          <span
            className={cn(
              "block h-full rounded-full",
              state === "over" && "bg-negative",
              state === "tight" && "bg-guess",
              state === "under" && "bg-action",
              // Striped rather than solid: part of this total is still a
              // guess, so the bar is drawn as provisional too.
              hasUnconfirmed && "[background-image:repeating-linear-gradient(115deg,transparent_0_3px,rgb(255_255_255/0.55)_3px_6px)]",
            )}
            style={{ width: `${state === "over" ? 100 : filled}%` }}
          />
        </span>
      )}
    </Link>
  );
}

/** The state in words, so the bar is not carrying the meaning on colour alone. */
const STATE_LABEL: Record<string, string> = {
  under: "سر جا",
  tight: "نزدیک سقف",
  over: "از سقف رد شده",
  unset: "بی‌سقف",
};

/**
 * The envelope nobody has decided about yet.
 *
 * Full width and last on the board, because it is not an envelope — it is an
 * outstanding decision, and sitting it in the grid beside four real ones
 * would imply it is in the same state as them. Dashed border for the same
 * reason every unfinished thing in this app is dashed.
 */
export function UnsetEnvelopeCard({
  envelope,
  observedMedian,
  currency,
  href,
  onSetBudget,
}: {
  envelope: EnvelopeRow;
  /** The median of the last three months, when there are enough of them. */
  observedMedian: number | null;
  currency: CurrencyCode;
  /**
   * The ledger, filtered to this category — and the only route to taking the
   * packet off the board. Without it a card someone had just added was a dead
   * end: no ceiling meant no link, and no link meant no way back out.
   */
  href: string;
  onSetBudget: () => void;
}) {
  const suggestion = suggestedCeiling(envelope, observedMedian);
  return (
    // Wraps rather than truncates: at 375px a fixed button beside a fixed
    // title left «خوراک و سوپرمارکت — س…», which names neither the category
    // nor what is being asked about it.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-dashed border-hairline-strong p-3">
      <span className="min-w-0 flex-1 basis-[60%]">
        <Link
          href={href}
          className="block text-body font-semibold text-ink hover:text-action hover:underline"
        >
          {envelope.name_fa} — سقف نداری
        </Link>
        <span className="mt-0.5 block text-caption text-ink-muted">
          {envelope.spent_minor > 0 && (
            <>
              این ماه <Money minor={envelope.spent_minor} currency={currency} />
            </>
          )}
          {suggestion && (
            <>
              {envelope.spent_minor > 0 && " · "}
              {/* Named rather than merged: «three months of your spending» and
                  «the figure you typed at signup» are different claims. */}
              {suggestion.source === "observed" ? "میانهٔ ۳ ماه " : "در ثبت‌نام گفتی "}
              <Money minor={suggestion.amount} currency={currency} />
            </>
          )}
        </span>
      </span>
      <button
        type="button"
        onClick={onSetBudget}
        className="h-9 shrink-0 rounded-full border border-action px-4 text-caption font-semibold text-action transition-colors hover:bg-action-tint"
      >
        سقف بگذار
      </button>
    </div>
  );
}
