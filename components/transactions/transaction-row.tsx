"use client";

import {
  ArrowsClockwise,
  CaretLeft,
  Keyboard,
  Microphone,
  Receipt,
  TextT,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Money } from "@/components/money";
import { formatDateFa } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryRow, TransactionRow } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/** The icon names the act the user performed. There is deliberately no "AI"
 *  sparkle: the user typed, spoke, or photographed something. */
const SOURCE_ICON: Record<string, Icon> = {
  form: Keyboard,
  text: TextT,
  voice: Microphone,
  receipt: Receipt,
  recurring: ArrowsClockwise,
};

const SOURCE_LABEL: Record<string, string> = {
  form: "دستی",
  text: "از متن",
  voice: "از صدا",
  receipt: "از عکس فاکتور",
  recurring: "هزینه‌ی ثابت",
};

export function TransactionRowItem({
  transaction,
  category,
  currency,
  onSelect,
}: {
  transaction: TransactionRow;
  category?: CategoryRow;
  currency: CurrencyCode;
  onSelect: () => void;
}) {
  const SourceIcon = SOURCE_ICON[transaction.source] ?? Keyboard;
  const unconfirmed = !transaction.is_confirmed;
  const title = transaction.merchant || transaction.note || category?.name_fa || "بدون عنوان";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 border-b border-hairline p-3 text-start last:border-b-0 hover:bg-paper"
    >
      <span
        className={cn(
          "flex size-[34px] shrink-0 items-center justify-center rounded-control",
          unconfirmed ? "bg-guess-tint text-guess" : "bg-lapis-tint text-lapis",
        )}
      >
        <SourceIcon size={18} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "w-fit max-w-full truncate text-[14px] font-medium text-ink",
            // The signature element, at row scale.
            unconfirmed && "border-b-2 border-dashed border-guess pb-[2px]",
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "truncate text-caption",
            unconfirmed ? "font-medium text-guess" : "text-ink-muted",
          )}
        >
          {unconfirmed
            ? `تأییدنشده · ${SOURCE_LABEL[transaction.source] ?? ""}`
            : [category?.name_fa, formatDateFa(transaction.occurred_on)]
                .filter(Boolean)
                .join(" · ")}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <Money
          minor={transaction.type === "income" ? transaction.amount : -transaction.amount}
          currency={currency}
          size="row"
          className={transaction.type === "income" ? "text-positive" : "text-ink"}
        />
        {unconfirmed && (
          <span className="flex items-center gap-0.5 text-caption font-medium text-lapis">
            بررسی
            <CaretLeft size={11} />
          </span>
        )}
      </span>
    </button>
  );
}
