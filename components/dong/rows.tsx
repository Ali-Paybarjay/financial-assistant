"use client";

import { ArrowLeft, Tag, Vault } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { formatDateFa } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import type { DongMemberRow, DongPaymentRow } from "@/lib/supabase/database.types";
import type { DongExpenseWithShares } from "@/lib/queries/dong";
import { PAYMENT_KIND_LABEL } from "@/lib/validation/dong";
import { cn } from "@/lib/utils";

/** What a member is called on screen. The kitty gets an icon, not a person's row. */
export function MemberName({
  member,
  className,
}: {
  member: DongMemberRow | undefined;
  className?: string;
}) {
  if (!member) return <span className={className}>—</span>;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {member.is_fund && <Vault size={13} className="text-ink-faint" aria-hidden />}
      {member.name}
      {member.is_me && (
        <span className="rounded-full bg-action-tint px-1.5 text-micro font-medium text-action">
          تو
        </span>
      )}
    </span>
  );
}

export function ExpenseRowItem({
  expense,
  members,
  currency,
  onEdit,
}: {
  expense: DongExpenseWithShares;
  members: Map<string, DongMemberRow>;
  currency: CurrencyCode;
  onEdit: () => void;
}) {
  const payer = members.get(expense.paid_by_member_id);
  // The viewer's own share is the number they came to this row for; the total
  // is what the group spent, which is a different question.
  const mine = [...members.values()].find((member) => member.is_me);
  const myShare = mine
    ? expense.shares.find((share) => share.member_id === mine.id)
    : undefined;

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-start last:border-b-0 hover:bg-paper"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium text-ink">{expense.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-ink-muted">
          <MemberName member={payer} />
          <span aria-hidden>·</span>
          <span>{formatDateFa(expense.occurred_on)}</span>
          {expense.tag && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Tag size={12} aria-hidden />
                {expense.tag}
              </span>
            </>
          )}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end">
        <Money minor={expense.amount} currency={currency} size="row" />
        {myShare && (
          <span className="mt-0.5 text-micro text-ink-muted">
            سهم تو <Money minor={myShare.amount} currency={currency} omitSymbol />
          </span>
        )}
      </span>
    </button>
  );
}

export function PaymentRowItem({
  payment,
  members,
  currency,
  onEdit,
}: {
  payment: DongPaymentRow;
  members: Map<string, DongMemberRow>;
  currency: CurrencyCode;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-start last:border-b-0 hover:bg-paper"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5 text-[15px] text-ink">
          <MemberName member={members.get(payment.from_member_id)} className="truncate" />
          {/* The row reads right to left, so the arrow points the way the
              money goes: out of the payer, into the receiver. */}
          <ArrowLeft size={14} className="shrink-0 text-ink-faint" aria-hidden />
          <MemberName member={members.get(payment.to_member_id)} className="truncate" />
        </span>
        <span className="mt-0.5 text-caption text-ink-muted">
          {PAYMENT_KIND_LABEL.get(payment.kind) ?? payment.kind} ·{" "}
          {formatDateFa(payment.occurred_on)}
        </span>
      </span>

      <Money minor={payment.amount} currency={currency} size="row" />
    </button>
  );
}
