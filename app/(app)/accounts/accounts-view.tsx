"use client";

import { useState } from "react";
import Link from "next/link";
import { Bank, Plus, Wallet } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { AccountRowItem } from "@/components/accounts/account-row";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { totalBalance, type AccountWithBalance } from "@/lib/accounts";
import { AccountSheet } from "./account-sheet";

export function AccountsView({
  currency,
  today,
  accounts,
}: {
  currency: CurrencyCode;
  today: string;
  accounts: AccountWithBalance[];
}) {
  const [editing, setEditing] = useState<AccountWithBalance | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const active = accounts.filter((account) => account.is_active);
  const closed = accounts.filter((account) => !account.is_active);
  const total = totalBalance(accounts);

  function open(account: AccountWithBalance | null) {
    setEditing(account);
    setSheetOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-4">
      <header className="mb-4">
        <h1 className="text-title font-semibold text-ink">حساب‌ها</h1>
        <p className="mt-1 text-caption text-ink-muted">
          موجودی هر حساب را یک‌بار بنویس؛ از آن به بعد هر خرج و درآمدی که به آن حساب
          بزنی، خودش کم و زیادش می‌کند.
        </p>
      </header>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-hairline-strong bg-surface px-4 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-lapis-tint text-lapis">
            <Bank size={24} />
          </span>
          <p className="text-body text-ink">هنوز حسابی تعریف نکرده‌ای.</p>
          <p className="max-w-[40ch] text-caption text-ink-muted">
            حساب بانکی، کارت اعتباری یا حتی پول نقدِ توی جیبت — هرکدام موجودی خودش را
            دارد و جداگانه دنبال می‌شود.
          </p>
          <Button size="lg" onClick={() => open(null)}>
            <Plus size={18} />
            اولین حساب را بساز
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between rounded-card border border-hairline bg-surface px-4 py-3">
            <span className="flex items-center gap-2 text-caption text-ink-muted">
              <Wallet size={16} />
              مجموع {faNumber(active.length)} حساب باز
            </span>
            <Money minor={total} currency={currency} size="kpi" tone="auto" />
          </div>

          <div className="mt-3 overflow-hidden rounded-card border border-hairline bg-surface">
            {active.map((account) => (
              <AccountRowItem
                key={account.id}
                account={account}
                currency={currency}
                onEdit={() => open(account)}
              />
            ))}
          </div>

          {closed.length > 0 && (
            <>
              <h2 className="mt-5 mb-2 text-label font-medium text-ink-muted">
                حساب‌های بسته
              </h2>
              <div className="overflow-hidden rounded-card border border-hairline bg-surface">
                {closed.map((account) => (
                  <AccountRowItem
                    key={account.id}
                    account={account}
                    currency={currency}
                    onEdit={() => open(account)}
                  />
                ))}
              </div>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-4 w-full"
            onClick={() => open(null)}
          >
            <Plus size={18} />
            افزودن حساب
          </Button>
        </>
      )}

      <p className="mt-4 rounded-control border border-dashed border-hairline-strong bg-paper px-3 py-2.5 text-caption text-ink-muted">
        موجودی هیچ‌وقت جایی ذخیره نمی‌شود: همان عددی که نوشتی، به‌علاوه‌ی هرچه از آن
        تاریخ به بعد در{" "}
        <Link href="/transactions" className="font-medium text-lapis hover:underline">
          تراکنش‌ها
        </Link>{" "}
        به این حساب خورده. پس اگر تراکنشی را پاک یا اصلاح کنی، موجودی همان لحظه درست
        می‌شود.
      </p>

      <AccountSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currency={currency}
        today={today}
        account={editing}
        isFirst={accounts.length === 0}
      />
    </div>
  );
}
