"use client";

import Link from "next/link";
import { CaretLeft, Plus, Wallet } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import type { AccountWithBalance } from "@/lib/accounts";

/**
 * What the accounts hold, on the dashboard.
 *
 * Deliberately separate from the month's KPI cards: those answer "how did this
 * month go", and this answers "how much is there". A month can be in surplus
 * while the account is empty, and putting the two numbers in one row would
 * invite them to be read as one.
 */
export function AccountBalances({
  accounts,
  total,
  currency,
}: {
  accounts: AccountWithBalance[];
  total: number;
  currency: CurrencyCode;
}) {
  const open = accounts.filter((account) => account.is_active);
  // Not null. Hiding the card when there is nothing in it also hides the only
  // route to the accounts page a phone has — at exactly the moment the user
  // would be going there to add their first account.
  if (open.length === 0) return <AccountsInvitation />;

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface">
      <Link
        href="/accounts"
        className="flex items-center justify-between gap-2 p-4 pb-2.5 hover:bg-paper"
      >
        <span className="flex items-center gap-2">
          <Wallet size={18} className="text-action" />
          <h2 className="text-[15px] font-semibold text-ink">موجودی حساب‌ها</h2>
        </span>
        <span className="flex items-center gap-1.5">
          <Money minor={total} currency={currency} size="kpi" tone="auto" />
          <CaretLeft size={14} className="text-ink-faint" />
        </span>
      </Link>

      {/* Only past two, so the dashboard keeps its shape whether the user has
          one account or nine; the page itself has the rest. */}
      <ul className="px-4 pb-3">
        {open.slice(0, 3).map((account) => (
          <li
            key={account.id}
            className="flex items-baseline justify-between gap-2 border-t border-hairline py-2 first:border-t-0"
          >
            <span className="truncate text-caption text-ink-muted">{account.title}</span>
            <Money
              minor={account.balance}
              currency={currency}
              size="inherit"
              className={
                account.balance < 0
                  ? "text-[13px] font-medium text-negative"
                  : "text-[13px] font-medium text-ink"
              }
            />
          </li>
        ))}
        {open.length > 3 && (
          <li className="border-t border-hairline pt-2 text-caption text-ink-muted">
            و {faNumber(open.length - 3)} حساب دیگر
          </li>
        )}
      </ul>
    </section>
  );
}

/** What the card is before the first account exists. */
function AccountsInvitation() {
  return (
    <section className="rounded-card border border-hairline bg-surface p-5">
      <span className="flex size-11 items-center justify-center rounded-full bg-action-tint text-action">
        <Wallet size={22} />
      </span>

      <h2 className="mt-3 text-[17px] font-semibold text-ink">حساب‌ها</h2>
      <p className="mt-1.5 text-body text-ink-muted">
        موجودی هر حساب را یک‌بار بنویس؛ از آن به بعد هر خرج و درآمدی که به آن حساب
        بزنی، خودش کم و زیادش می‌کند.
      </p>

      <Button asChild size="lg" variant="outline" className="mt-4 w-full">
        <Link href="/accounts">
          <Plus size={18} />
          افزودن اولین حساب
        </Link>
      </Button>
    </section>
  );
}
