"use client";

import {
  ArrowsClockwise,
  ArrowsLeftRight,
  Bank,
  CaretLeft,
  Keyboard,
  Microphone,
  Receipt,
  TextT,
  UsersThree,
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
  statement: Bank,
  dong: UsersThree,
};

const SOURCE_LABEL: Record<string, string> = {
  form: "دستی",
  text: "از متن",
  voice: "از صدا",
  receipt: "از عکس فاکتور",
  recurring: "هزینه‌ی ثابت",
  statement: "از صورت‌حساب",
  dong: "از دنگ و دونگ",
};

export function TransactionRowItem({
  transaction,
  category,
  accountTitle,
  toAccountTitle,
  goalTitle,
  currency,
  onSelect,
}: {
  transaction: TransactionRow;
  category?: CategoryRow;
  /** Omitted where accounts are not in play, which keeps the line short. */
  accountTitle?: string;
  /** The far end of a transfer. */
  toAccountTitle?: string;
  /** The goal this row funded or spent, when it names one. */
  goalTitle?: string;
  currency: CurrencyCode;
  onSelect: () => void;
}) {
  const isTransfer = transaction.type === "transfer";
  // A transfer's icon names what happened, not how it was entered: "I moved
  // money" is the fact, and which of three forms it was typed into is not.
  const SourceIcon = isTransfer
    ? ArrowsLeftRight
    : (SOURCE_ICON[transaction.source] ?? Keyboard);
  const unconfirmed = !transaction.is_confirmed;
  const title = isTransfer
    ? "انتقال بین حساب‌ها"
    : transaction.merchant || transaction.note || category?.name_fa || "بدون عنوان";

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
            : isTransfer
              ? [
                  // The goal leads, because it is the only thing on this line
                  // that cannot be worked out from anywhere else — and without
                  // it, money set aside for something is indistinguishable
                  // from money that just moved.
                  goalTitle ? `پس‌اندازِ ${goalTitle}` : null,
                  // Reads right to left: "to B ← from A" in source order gives
                  // «از A به B» on screen.
                  accountTitle && toAccountTitle
                    ? `از ${accountTitle} به ${toAccountTitle}`
                    : null,
                  formatDateFa(transaction.occurred_on),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : [
                  goalTitle ? `بابت ${goalTitle}` : null,
                  category?.name_fa,
                  accountTitle,
                  formatDateFa(transaction.occurred_on),
                ]
                  .filter(Boolean)
                  .join(" · ")}
        </span>

        {/* On an unconfirmed row the line above is given over to the guess, so
            the goal would otherwise vanish until the row is confirmed. It gets
            its own line rather than joining that one, because that line is
            brass — the colour means «the model guessed this» — and the goal is
            something the user chose. Saying it in brass would be a lie about
            where it came from. */}
        {unconfirmed && goalTitle && (
          <span className="truncate text-caption text-ink-muted">
            {isTransfer ? `پس‌اندازِ ${goalTitle}` : `بابت ${goalTitle}`}
          </span>
        )}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {/* A transfer is neither a gain nor a loss, so it gets no sign and no
            colour: the money is still the user's, it is just somewhere else. */}
        <Money
          minor={
            isTransfer
              ? transaction.amount
              : transaction.type === "income"
                ? transaction.amount
                : -transaction.amount
          }
          currency={currency}
          size="row"
          className={
            isTransfer
              ? "text-ink-muted"
              : transaction.type === "income"
                ? "text-positive"
                : "text-ink"
          }
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
