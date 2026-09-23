import Link from "next/link";
import { Tray, WarningCircle } from "@phosphor-icons/react/dist/ssr";
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
 * The big figure is what is **left**, never what was spent. «چقدر مانده» is
 * the question the month is about, and answering it with a spend figure makes
 * the reader do the subtraction themselves — including in the month they are
 * over, which is the one they least want to get wrong.
 *
 * Five states, in the grammar the rest of the app already speaks:
 *   unset         dashed frame, no bar — a decision nobody has made yet
 *   under         accent bar
 *   tight         brass, and the line says what is left per day
 *   over          red bar, negative figure
 *   +unconfirmed  striped bar and a dashed rule under the figure, because
 *                 that sum is not settled either
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
  const left = envelope.remaining_minor ?? 0;
  const hasUnconfirmed = unconfirmed > 0;
  const perDay = dailyAllowance(budget, spent, daysLeft);

  const filled =
    budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col rounded-well border p-3 transition-colors",
        state === "tight"
          ? "border-guess-border bg-guess-tint"
          : "border-hairline bg-surface hover:border-hairline-strong",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 truncate text-caption",
          state === "tight" ? "text-guess-text" : "text-ink-muted",
        )}
      >
        {envelope.name_fa}
        {state === "tight" && <WarningCircle size={13} aria-hidden />}
      </span>

      {/* rule-guess is the dashed grammar from globals.css — the same rule
          that sits under a merchant name the model guessed. */}
      <Money
        minor={left}
        currency={currency}
        signed={state === "over"}
        className={cn(
          "mt-1.5 w-fit text-figure-md font-bold",
          state === "over" ? "text-negative" : "text-ink",
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
            شامل <Money minor={unconfirmed} currency={currency} /> تأییدنشده
          </>
        ) : state === "over" && budget !== null ? (
          <>
            از سقف <Money minor={budget} currency={currency} /> رد شد
          </>
        ) : state === "tight" && perDay !== null ? (
          <>
            روزی <Money minor={perDay} currency={currency} /> تا آخر ماه
          </>
        ) : budget !== null ? (
          <>
            از <Money minor={budget} currency={currency} /> مانده
          </>
        ) : null}
      </span>

      {/* Fills from the reading start, so it empties leftwards exactly as the
          runway on the balance card does. */}
      <span
        role="progressbar"
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${envelope.name_fa} — ${STATE_LABEL[state]}`}
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
          // A sliver at minimum, so an envelope with a ceiling and no spending
          // still reads as a bar rather than as a missing one.
          style={{ width: `${state === "over" ? 100 : Math.max(filled, 4)}%` }}
        />
      </span>
    </Link>
  );
}

/** The state in words, so the bar never carries the meaning on colour alone. */
const STATE_LABEL: Record<string, string> = {
  under: "سر جا",
  tight: "نزدیک سقف",
  over: "از سقف رد شده",
  unset: "بی‌سقف",
};

/**
 * The envelope nobody has decided about yet.
 *
 * Full width and last on the board: it is an outstanding decision rather than
 * an envelope, and sitting it in the grid beside four real ones would say
 * otherwise. Dashed, like everything unfinished here.
 *
 * Its name is a link. The package's version had none, which made a packet
 * someone had just added impossible to open and therefore impossible to take
 * off the board again.
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
  href: string;
  onSetBudget: () => void;
}) {
  const suggestion = suggestedCeiling(envelope, observedMedian);

  return (
    <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-well border-[1.5px] border-dashed border-hairline-strong p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-muted">
        <Tray size={18} />
      </span>
      <span className="min-w-0 flex-1 basis-[50%]">
        <Link
          href={href}
          className="block text-[13px] font-medium text-ink hover:text-action hover:underline"
        >
          {envelope.name_fa} — سقف نداری
        </Link>
        <span className="mt-0.5 block text-micro text-ink-faint">
          {envelope.spent_minor > 0 && (
            <>
              این ماه <Money minor={envelope.spent_minor} currency={currency} />
            </>
          )}
          {suggestion && (
            <>
              {envelope.spent_minor > 0 && " · "}
              {/* Named rather than merged: «three months of your spending» and
                  «the figure you gave at signup» are different claims. */}
              {suggestion.source === "observed" ? "میانهٔ ۳ ماه " : "در ثبت‌نام گفتی "}
              <Money minor={suggestion.amount} currency={currency} />
            </>
          )}
        </span>
      </span>
      <button
        type="button"
        onClick={onSetBudget}
        className="h-8 shrink-0 rounded-full border border-action px-3 text-caption font-semibold text-action transition-colors hover:bg-action-tint"
      >
        سقف بگذار
      </button>
    </div>
  );
}
