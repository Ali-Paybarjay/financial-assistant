import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";

/**
 * The month drawn as a runway, directly under the balance.
 *
 * The product's test sentence is that a user understands how much is left in
 * under five seconds — but «چقدر مانده» is never really a question about a
 * number on its own. It is a question about a number and a deadline: $400 is
 * comfortable on the 28th and alarming on the 4th. The old design had both
 * facts and set the second one as 12px grey text beside the first, which meant
 * the reader had to do the division themselves.
 *
 * So the days become a shape under the figure, in the grammar the rest of the
 * app already speaks: the days already lived are inked, the days still to come
 * are in pencil, exactly as a confirmed amount is inked and a guessed one is
 * not. Days nobody has lived yet are not settled either.
 *
 * A month that has ended has no pencil left in it, which is the whole line.
 */
export function MonthRunway({
  daysGone,
  daysLeft,
  perDay,
  currency,
}: {
  daysGone: number;
  /** 0 for a month that has already ended — the runway is then fully inked. */
  daysLeft: number;
  /** What is left, divided by the days left. Omitted when the month is over. */
  perDay: number | null;
  currency: CurrencyCode;
}) {
  const total = daysGone + daysLeft;
  const gonePercent = total > 0 ? (daysGone / total) * 100 : 100;

  return (
    <div className="mt-3.5 flex flex-col gap-1.5">
      <div className="runway" aria-hidden>
        <span className="runway-gone" style={{ width: `${gonePercent}%` }} />
        {daysLeft > 0 && <span className="runway-left" />}
      </div>

      <p className="flex items-baseline justify-between gap-3 text-caption text-ink-muted">
        <span>{faNumber(daysGone)} روز گذشته</span>
        {daysLeft > 0 ? (
          <span className="flex items-baseline gap-1">
            {faNumber(daysLeft)} روز مانده
            {perDay !== null && (
              <>
                <span aria-hidden className="text-ink-faint">
                  ·
                </span>
                روزی <Money minor={perDay} currency={currency} />
              </>
            )}
          </span>
        ) : (
          <span>این ماه تمام شده</span>
        )}
      </p>
    </div>
  );
}
