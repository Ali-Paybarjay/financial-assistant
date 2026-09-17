"use client";

import {
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
import type { AccountWithBalance } from "@/lib/accounts";
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
  onEdit,
}: {
  account: AccountWithBalance;
  currency: CurrencyCode;
  onEdit: () => void;
}) {
  const KindIcon = KIND_ICON[account.kind] ?? Vault;

  const meta = [
    ACCOUNT_KIND_LABEL.get(account.kind),
    account.institution,
    account.reference,
    account.transactionCount > 0
      ? `${faNumber(account.transactionCount)} تراکنش`
      : `از ${formatDateFa(account.opening_balance_on)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "flex w-full items-center gap-3 border-b border-hairline p-3 text-start last:border-b-0 hover:bg-paper",
        !account.is_active && "opacity-55",
      )}
    >
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-control bg-lapis-tint text-lapis">
        <KindIcon size={18} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium text-ink">
            {account.title}
          </span>
          {account.is_default && (
            <span className="shrink-0 rounded-full bg-lapis-tint px-1.5 py-0.5 text-[11px] font-medium text-lapis">
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
  );
}
