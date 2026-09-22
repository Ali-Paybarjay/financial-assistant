"use client";

import Link from "next/link";
import {
  ArrowClockwise,
  Bank,
  CreditCard,
  Money as MoneyIcon,
  PiggyBank,
  Vault,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import { reconcileState, type AccountWithBalance } from "@/lib/accounts";
import { ACCOUNT_KIND_LABEL } from "@/lib/validation/accounts";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, Icon> = {
  checking: Bank,
  savings: PiggyBank,
  card: CreditCard,
  cash: MoneyIcon,
  other: Vault,
};

export function AccountRowItem({
  account,
  currency,
  today,
  timeZone,
  onEdit,
}: {
  account: AccountWithBalance;
  currency: CurrencyCode;
  today: string;
  timeZone: string;
  onEdit: () => void;
}) {
  const KindIcon = KIND_ICON[account.kind] ?? Vault;
  const reconcile = reconcileState(account, today, timeZone);

  const checked = account.last_reconciled_at
    ? reconcile.due
      ? reconcile.monthsBehind && reconcile.monthsBehind > 1
        ? `${faNumber(reconcile.monthsBehind)} ماه چک نشده`
        : "این ماه چک نشده"
      : "این ماه چک شده"
    : "هنوز با بانک چک نشده";

  const meta = [
    ACCOUNT_KIND_LABEL.get(account.kind),
    account.institution,
    account.transactionCount > 0
      ? `${faNumber(account.transactionCount)} تراکنش`
      : `از ${formatDateFa(account.opening_balance_on)}`,
    account.is_active ? checked : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-hairline p-3 last:border-b-0",
        !account.is_active && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-muted">
        <KindIcon size={18} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium text-ink">
            {account.title}
          </span>
          {account.is_default && (
            // A state, not an action: it says which account the app reaches
            // for, and nothing here is pressable in the action colour's sense.
            <span className="shrink-0 rounded-full bg-paper px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
              پیش‌فرض
            </span>
          )}
        </span>
        <span className="truncate text-caption text-ink-muted">{meta}</span>
      </span>

        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <Money
            minor={account.balance}
            currency={currency}
            size="row"
            className={account.balance < 0 ? "text-negative" : "text-ink"}
          />
          {account.movement !== 0 && (
            <Money
              minor={account.movement}
              currency={currency}
              size="inherit"
              signed
              className="text-caption text-ink-muted"
            />
          )}
        </span>
      </button>

      {/* Its own control, not part of the row: "check this against the bank"
          is the action of the month, and burying it behind an edit sheet is
          how a monthly habit fails to form. A closed account is not asked. */}
      {account.is_active && (
        <Link
          href={`/import?account=${account.id}`}
          aria-label={`بروزرسانی ${account.title}`}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-control border transition-colors",
            reconcile.due
              ? "border-action bg-action text-white hover:bg-action/90"
              : "border-hairline-strong bg-surface text-ink-muted hover:border-action hover:text-action",
          )}
        >
          <ArrowClockwise size={17} />
        </Link>
      )}
    </div>
  );
}
