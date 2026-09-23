import Link from "next/link";
import { Money } from "@/components/money";
import type { CurrencyCode } from "@/lib/money";
import type { SavingsCheck } from "@/lib/goals";

/**
 * Do the savings accounts and the goals agree?
 *
 * The rest of the page is about flow — what to move this month. This is the
 * one place that looks at the stock and says whether the two readings match.
 * Silence here is the good case, so nothing renders when they do.
 */
export function SavingsCheckNote({
  check,
  savingsTotal,
  goalsHeld,
  hasSavingsAccount,
  currency,
}: {
  check: SavingsCheck;
  savingsTotal: number;
  goalsHeld: number;
  /** With no savings account there is nothing to compare against yet. */
  hasSavingsAccount: boolean;
  currency: CurrencyCode;
}) {
  if (!hasSavingsAccount) {
    // Only worth saying once there is something to keep there. A user with no
    // goals and no savings account is not doing anything wrong.
    if (goalsHeld <= 0) return null;
    return (
      <Note>
        هدف‌هایت می‌گویند <Money minor={goalsHeld} currency={currency} /> کنار گذاشته‌ای،
        ولی حساب پس‌اندازی نداری. تا وقتی این پول در حسابی باشد که از آن خرج می‌کنی، یک
        روز بی‌آنکه بفهمی خرج می‌شود.{" "}
        <Link href="/accounts" className="font-medium text-action underline">
          یک حساب پس‌انداز بساز
        </Link>
        .
      </Note>
    );
  }

  if (check.unassigned > 0) {
    return (
      <Note>
        <Money minor={check.unassigned} currency={currency} /> در پس‌اندازت هست که هیچ
        هدفی توضیحش نمی‌دهد. یا هدف تازه‌ای برایش بگذار، یا انتقالی را که بابتش بوده در
        صفحه‌ی تراکنش‌ها به هدفش وصل کن.
      </Note>
    );
  }

  if (check.unbacked > 0) {
    return (
      <Note>
        هدف‌هایت روی هم <Money minor={goalsHeld} currency={currency} /> ادعا می‌کنند ولی
        در پس‌انداز <Money minor={savingsTotal} currency={currency} /> هست —{" "}
        <Money minor={check.unbacked} currency={currency} /> کمتر. یا پولی از پس‌انداز
        درآمده و بابتش گفته نشده، یا عددِ «از قبل کنار گذاشته بودی» بزرگ‌تر از واقعیت
        است.
      </Note>
    );
  }

  return null;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-card border border-hairline bg-surface p-4 text-caption text-ink-muted">
      {children}
    </p>
  );
}
