"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { Rows, Section, Well } from "@/components/page";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import type { AccountWithBalance } from "@/lib/accounts";

/**
 * What the accounts hold, on the dashboard.
 *
 * Deliberately separate from the month's figures: those answer "how did this
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
  // Not null. Hiding this when there is nothing in it also hides the only
  // route to the accounts page a phone has — at exactly the moment the user
  // would be going there to add their first account.
  if (open.length === 0) return <AccountsInvitation />;

  return (
    <Section
      title="موجودی حساب‌ها"
      action={
        <Link href="/accounts" className="text-caption font-medium text-action">
          همه
        </Link>
      }
    >
      <div className="flex items-baseline justify-between gap-2 pb-2.5">
        <span className="text-caption text-ink-muted">
          {faNumber(open.length)} حساب باز
        </span>
        <Money minor={total} currency={currency} size="kpi" tone="auto" />
      </div>

      {/* Only the first three, so the dashboard keeps its shape whether the
          user has one account or nine; the page itself has the rest. */}
      <Rows>
        {open.slice(0, 3).map((account) => (
          <div
            key={account.id}
            className="flex items-baseline justify-between gap-2 py-2"
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
          </div>
        ))}
        {open.length > 3 && (
          <div className="py-2 text-caption text-ink-muted">
            و {faNumber(open.length - 3)} حساب دیگر
          </div>
        )}
      </Rows>
    </Section>
  );
}

/** What this is before the first account exists. */
function AccountsInvitation() {
  return (
    <Section title="حساب‌ها">
      <Well className="flex flex-col items-start gap-3">
        <p className="max-w-[52ch] text-body text-ink-muted">
          موجودی هر حساب را یک‌بار بنویس؛ از آن به بعد هر خرج و درآمدی که به آن حساب
          بزنی، خودش کم و زیادش می‌کند.
        </p>
        <Button asChild variant="outline">
          <Link href="/accounts">
            <Plus size={18} />
            افزودن اولین حساب
          </Link>
        </Button>
      </Well>
    </Section>
  );
}
