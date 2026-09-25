import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";

/**
 * The month's answer, on a tinted card at the top of the board.
 *
 * Tinted rather than filled: the card has to be a surface you notice without
 * becoming the darkest thing on a light page — the near-black version read as
 * a different product bolted onto this one. --action-tint carries the
 * accent's hue at a tenth of its weight, and the figure keeps its own colour.
 *
 * The forecast sits beside the balance, under a dashed rule, because it is
 * the same kind of statement as a guessed merchant name: nobody has lived
 * those days yet.
 */
export function BalanceCard({
  balance,
  /** What the month ends at if today's pace holds. Omitted for past months. */
  forecast,
  currency,
  daysGone,
  daysLeft,
  /** What is left divided by the days left. */
  perDay,
  /** What the user is actually spending per day, if it is more than perDay. */
  burnPerDay,
}: {
  balance: number;
  forecast: number | null;
  currency: CurrencyCode;
  daysGone: number;
  daysLeft: number;
  perDay: number | null;
  burnPerDay: number | null;
}) {
  const total = daysGone + daysLeft;
  const gonePercent = total > 0 ? (daysGone / total) * 100 : 100;

  return (
    <section className="rounded-card border border-action-tint-edge bg-action-tint p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-ink-muted">مانده‌ی این ماه</p>
          <Money
            minor={balance}
            currency={currency}
            size="hero"
            tone="auto"
            signed
            className="mt-0.5 block text-[34px]"
          />
        </div>

        {forecast !== null && (
          <div className="shrink-0 text-end">
            <p className="text-micro text-ink-muted">پیش‌بینی</p>
            <Money
              minor={forecast}
              currency={currency}
              size="row"
              signed
              tone="auto"
              className="mt-0.5 inline-block text-[17px] font-bold rule-guess"
            />
          </div>
        )}
      </div>

      {/* Same runway as before, drawn in the accent because it now sits on a
          tinted ground where ink would outweigh the figure above it. */}
      <div className="runway runway-on-tint mt-3.5" aria-hidden>
        <span className="runway-gone" style={{ width: `${gonePercent}%` }} />
        {daysLeft > 0 && <span className="runway-left" />}
      </div>

      <p className="mt-2 flex items-baseline justify-between gap-3 text-micro text-ink-muted">
        <span>
          {daysLeft > 0 ? `${faNumber(daysLeft)} روز مانده` : "این ماه تمام شده"}
        </span>
        {perDay !== null && (
          <span>
            سهم روز <Money minor={perDay} currency={currency} />
            {burnPerDay !== null && burnPerDay > perDay && (
              <>
                {" · خرجِ روز "}
                <Money minor={burnPerDay} currency={currency} className="text-negative" />
              </>
            )}
          </span>
        )}
      </p>
    </section>
  );
}
