import Link from "next/link";
import { Money } from "@/components/money";
import { GuessPill } from "@/components/confidence-rule";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import type { MonthlySurplus } from "@/lib/cashflow";
import type { SavingsPlan } from "@/lib/goals";

/**
 * The answer the goals page has always promised and never gave: one number,
 * how much to put aside this month, and where it came from.
 *
 * The figure the plan is built on is shown next to it on purpose. A plan is
 * only worth following if you can see the assumption underneath it and say
 * «that's wrong, my rent went up» — so the source of the surplus is stated,
 * and an estimate is labelled as one.
 */
export function PlanCard({
  plan,
  surplus,
  currency,
}: {
  plan: SavingsPlan;
  surplus: MonthlySurplus;
  currency: CurrencyCode;
}) {
  if (surplus.basis === "unknown") {
    return (
      <section className="mb-6">
        <h2 className="text-section font-semibold text-ink">برنامه‌ی پس‌انداز</h2>
        <p className="mt-1.5 text-body text-ink-muted">
          نمی‌دانم هر ماه چقدر برایت می‌ماند، پس نمی‌توانم بگویم چقدر کنار بگذاری.{" "}
          <Link href="/income" className="font-medium text-action underline">
            درآمد و هزینه‌های ثابتت را وارد کن
          </Link>{" "}
          تا برنامه را بسازم.
        </p>
      </section>
    );
  }

  const broke = surplus.amount <= 0;

  return (
    <section className="mb-6">
      <h2 className="text-section font-semibold text-ink">برنامه‌ی پس‌انداز</h2>

      <p className="mt-2 text-label text-ink-muted">
        {broke ? "این ماه چیزی برای کنار گذاشتن نمی‌ماند" : "هر ماه این‌قدر کنار بگذار"}
      </p>
      <Money minor={plan.allocated} currency={currency} size="hero" />

      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-ink-muted">
        <BasisText surplus={surplus} currency={currency} />
        {surplus.basis === "declared" && <GuessPill>تخمین</GuessPill>}
      </p>

      {plan.shortfall > 0 && (
        <p className="mt-3 rounded-well bg-guess-tint px-3.5 py-3 text-caption text-guess-text">
          برای اینکه به همه‌ی تاریخ‌ها برسی ماهی{" "}
          <Money minor={plan.required} currency={currency} /> لازم است — یعنی{" "}
          <Money minor={plan.shortfall} currency={currency} /> بیشتر از چیزی که داری. سه
          راه داری: تاریخ‌ها را عقب‌تر ببر، مبلغ هدف‌ها را کم کن، یا ماهی همین‌قدر از
          هزینه‌ها بزن.
        </p>
      )}

      {plan.shortfall === 0 && plan.unassigned > 0 && (
        <p className="mt-3 text-caption text-ink-muted">
          بعد از این، ماهی <Money minor={plan.unassigned} currency={currency} /> هم آزاد
          می‌ماند. هدف تازه‌ای برایش بگذار تا بی‌سروصدا خرج نشود.
        </p>
      )}
    </section>
  );
}

/** Where the surplus figure came from, in the words the user would use. */
function BasisText({
  surplus,
  currency,
}: {
  surplus: MonthlySurplus;
  currency: CurrencyCode;
}) {
  const amount = <Money minor={surplus.amount} currency={currency} tone="auto" signed />;

  if (surplus.basis === "declared") {
    return (
      <span>
        بر پایه‌ی {amount} که با درآمد و هزینه‌هایی که خودت گفته‌ای هر ماه باید بماند.
      </span>
    );
  }

  if (surplus.months === 1) {
    return <span>بر پایه‌ی {amount} که ماه گذشته برایت ماند.</span>;
  }

  return (
    <span>
      بر پایه‌ی {amount} که در {faNumber(surplus.months)} ماه گذشته معمولاً برایت مانده.
    </span>
  );
}
