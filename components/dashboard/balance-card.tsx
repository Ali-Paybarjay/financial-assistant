import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import type { CurrencyCode, Minor } from "@/lib/money";

/**
 * The month's answer, on a tinted card at the top of the board.
 *
 * Tinted rather than filled, and that is a correction: the first version made
 * this the one near-black surface in a light app, which read as a different
 * product bolted onto this one — and left it needing its own green and red,
 * because the ordinary pair sits at 2.7:1 on ink. `--action-tint` carries the
 * accent's hue at a tenth of its weight, the figure keeps the colours every
 * other figure uses, and the two `*-on-ink` tokens are gone with it.
 *
 * The forecast sits beside the balance under a dashed rule, because it is the
 * same kind of statement as a guessed merchant name: nobody has lived those
 * days yet. Past months have no days left to guess about and show no
 * forecast at all.
 *
 * The label names what the figure is, and the disclosure under it says what the
 * figure is not. Three different numbers in this product could be called «what
 * I have left», and this is only the first of them:
 *
 *   1. this month's income minus this month's spending — the figure here;
 *   2. what the accounts hold right now — «موجودی حساب‌ها», its own card;
 *   3. what is free to spend after the month's remaining commitments — which
 *      this app does not compute, and must therefore not imply.
 *
 * It used to be labelled «ماندهٔ سپتامبر» with nothing beside it, which reads as
 * (3) and is (1). A user with rent still to pay on the 28th was being shown a
 * number they could not actually spend.
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
  /** Named, not «این ماه»: the card also shows months that are over. */
  monthLabel: string;
}) {
  const daysInMonth = daysGone + daysLeft;
  const gonePercent = daysInMonth > 0 ? (daysGone / daysInMonth) * 100 : 100;
  // Worth colouring only when it is news: spending faster than what is left
  // allows. Otherwise it is a figure, not a warning.
  const outpacing =
    perDayAllowed !== null && perDaySpent !== null && perDaySpent > perDayAllowed;

  return (
    // A container query rather than a viewport one: this card is full width
    // on a phone and a third of a column on a desktop, so what the figure can
    // afford depends on the card. The package sized it at a flat 34px, which
    // clipped «+$1,886.15» to «+$1,886.1» at 375px.
    <section className="@container rounded-card border border-action-tint-edge bg-action-tint p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-caption text-ink-muted">
            ماندهٔ درآمد و هزینهٔ {monthLabel}
          </p>
          {/* Size on the wrapper, colour inside <Money>: tailwind-merge
              cannot tell a custom colour from a font size, so the two in one
              className would silently lose one of them. */}
          <span className="mt-0.5 block font-display text-[clamp(1.5rem,9cqw,2.25rem)] leading-[1.1] font-extrabold">
            <Money minor={balance} currency={currency} tone="auto" signed />
          </span>
        </div>

        {forecast !== null && (
          <div className="shrink-0 text-end">
            <p className="text-micro text-ink-muted">پیش‌بینی</p>
            {/* rule-guess is the app's dashed grammar, from globals.css —
                the same rule under a merchant name the model guessed. */}
            <Money
              minor={forecast}
              currency={currency}
              signed
              tone="auto"
              className="rule-guess mt-0.5 inline-block text-figure-md font-bold"
            />
          </div>
        )}
      </div>

      {/* The month as a runway: the days lived are inked, the days still to
          come are in pencil. Drawn in the accent because it sits on a tinted
          ground, where ink would outweigh the figure above it. */}
      {daysInMonth > 0 && (
        <div className="runway runway-on-tint mt-3.5" aria-hidden>
          <span className="runway-gone" style={{ width: `${gonePercent}%` }} />
          {daysLeft > 0 && <span className="runway-left" />}
        </div>
      )}

      <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-micro text-ink-muted">
        <span>
          {daysLeft > 0 ? `${faNumber(daysLeft)} روز مانده` : "این ماه تمام شده"}
        </span>
        {perDayAllowed !== null && perDaySpent !== null && (
          <span>
            سهم روز <Money minor={perDayAllowed} currency={currency} />
            {" · خرجِ روز "}
            <Money
              minor={perDaySpent}
              currency={currency}
              className={outpacing ? "text-negative" : undefined}
            />
          </span>
        )}
      </p>

      {outpacing && (
        <p className="mt-1.5 text-caption text-negative">
          تندتر از سهم روز خرج می‌کنی.
        </p>
      )}

      {/* Closed by default: the arithmetic is one tap away for the person who
          wants it and out of the way of the person who does not. A `details`
          rather than a tooltip, because it has to work on a phone and be
          reachable from the keyboard without any of this being a component. */}
      <details className="group mt-2">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-micro font-medium text-action [&::-webkit-details-marker]:hidden">
          این عدد از کجا می‌آید؟
        </summary>
        <div className="mt-1.5 flex flex-col gap-1 border-t border-hairline pt-1.5 text-micro text-ink-muted">
          <p>
            درآمدِ ثبت‌شدهٔ این ماه منهای هزینهٔ ثبت‌شدهٔ این ماه. انتقال بین حساب‌های
            خودت در آن نیست.
          </p>
          <p>
            این «موجودی حساب‌هایت» نیست — آن را در کارت موجودی حساب‌ها ببین. تعهدهای
            باقی‌ماندهٔ همین ماه هم از آن کم نشده، پس همه‌اش لزوماً قابل‌خرج نیست.
          </p>
        </div>
      </details>
    </section>
  );
}
