import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import type { CurrencyCode, Minor } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The month's balance, and where it is heading.
 *
 * The one dark surface in the app, which is why it is also the one place the
 * `*-on-ink` colours are used: the ordinary green and red sit at 2.7:1 here
 * and cannot be read.
 *
 * The forecast is the point of the card. A balance on its own reports the
 * past, and the question people actually open a budgeting app with is about
 * the future — so the figure beside it says where this month lands at the
 * current rate, under a dashed rule because it is a projection and not a
 * fact. Past months have no future to project, so they show the balance
 * alone.
 */
export function BalanceCard({
  balance,
  forecast,
  currency,
  daysGone,
  daysLeft,
  perDayAllowed,
  perDaySpent,
  monthLabel,
}: {
  balance: Minor;
  /** Where the month lands at the current rate. null for a month already over. */
  forecast: Minor | null;
  currency: CurrencyCode;
  daysGone: number;
  daysLeft: number;
  /** What is left, spread over the days that are left. */
  perDayAllowed: Minor | null;
  /** What has actually been going out per day so far. */
  perDaySpent: Minor | null;
  monthLabel: string;
}) {
  const daysInMonth = daysGone + daysLeft;
  const goneShare = daysInMonth > 0 ? (daysGone / daysInMonth) * 100 : 0;
  // Spending faster than the remaining budget allows is the one thing on this
  // card worth colouring, and it is said in words directly underneath.
  const outpacing =
    perDayAllowed !== null && perDaySpent !== null && perDaySpent > perDayAllowed;

  return (
    // A container query, not a viewport one: the card is full width on a
    // phone and a third of the page on a desktop, so what the balance can
    // afford depends on the card rather than on the screen.
    <section className="@container rounded-card bg-ink p-4 text-white">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-label text-white/70">ماندهٔ {monthLabel}</p>
          {/* The size is set here and inherited rather than passed to <Money>
              as a class. tailwind-merge cannot tell a custom colour from a
              font size, so `text-[clamp(…)]` and `text-positive-on-ink` in
              one className would have the colour silently delete the size —
              which is the bug commit a87fc11 was about. */}
          <span className="mt-1 block font-display text-[clamp(1.5rem,9cqw,2.5rem)] leading-[1.1] font-extrabold">
            <Money
              minor={balance}
              currency={currency}
              signed
              className={
                balance < 0 ? "text-negative-on-ink" : "text-positive-on-ink"
              }
            />
          </span>
        </div>

        {forecast !== null && (
          <div className="shrink-0 text-end">
            <p className="text-caption text-white/70">پیش‌بینی</p>
            {/* Dashed, like every figure in this app that has not happened
                yet. The word «پیش‌بینی» carries it for anyone who cannot see
                the rule. */}
            <Money
              minor={forecast}
              currency={currency}
              signed
              className={cn(
                "mt-0.5 inline-block border-b-2 border-dashed pb-[2px] text-[17px] font-semibold",
                forecast < 0
                  ? "border-negative-on-ink/60 text-negative-on-ink"
                  : "border-positive-on-ink/60 text-positive-on-ink",
              )}
            />
          </div>
        )}
      </div>

      {/* The landing strip. Solid for the days behind, dashed for the days
          ahead — the same grammar as everything else that is not settled yet.
          In RTL the first child sits at the start, which is where the month
          began. */}
      {daysInMonth > 0 && (
        <div aria-hidden className="mt-4 flex items-center gap-1">
          <span
            className="h-[3px] rounded-full bg-white"
            style={{ width: `${goneShare}%` }}
          />
          <span className="h-0 flex-1 border-t-[3px] border-dotted border-white/45" />
        </div>
      )}

      <div className="mt-2.5 flex items-baseline justify-between gap-3 text-caption">
        <span className="text-white/70">{faNumber(daysLeft)} روز مانده</span>
        {perDayAllowed !== null && perDaySpent !== null && (
          <span className="flex items-baseline gap-1.5 text-white/70">
            <span className="flex items-baseline gap-1">
              سهم روز
              <Money minor={perDayAllowed} currency={currency} className="text-white" />
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-baseline gap-1">
              خرجِ روز
              <Money
                minor={perDaySpent}
                currency={currency}
                className={outpacing ? "text-negative-on-ink" : "text-white"}
              />
            </span>
          </span>
        )}
      </div>

      {outpacing && (
        <p className="mt-1.5 text-caption text-negative-on-ink">
          تندتر از سهم روز خرج می‌کنی.
        </p>
      )}
    </section>
  );
}
