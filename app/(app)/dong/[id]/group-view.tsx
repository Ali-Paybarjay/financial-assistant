"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChartPie,
  CheckCircle,
  CreditCard,
  PencilSimple,
  Plus,
  ShoppingCart,
  UserPlus,
  Users,
  Vault,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { SegmentedControl } from "@/components/segmented-control";
import { FormError } from "@/components/field";
import { ExpenseRowItem, MemberName, PaymentRowItem } from "@/components/dong/rows";
import { DongReport } from "@/components/dong/report";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import { personalMovement, standing, type Transfer } from "@/lib/dong";
import type {
  AccountRow,
  DongMemberRow,
  DongPaymentRow,
} from "@/lib/supabase/database.types";
import type { DongExpenseWithShares, DongGroupDetail } from "@/lib/queries/dong";
import { GroupSheet } from "../group-sheet";
import { ExpenseSheet } from "./expense-sheet";
import { MemberSheet } from "./member-sheet";
import { PaymentSheet, type PaymentDraft } from "./payment-sheet";
import { addDongFund, setDongGroupSettled } from "../actions";

type Tab = "expenses" | "payments" | "people" | "report";

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "expenses", label: "خریدها", icon: <ShoppingCart size={15} /> },
  { value: "payments", label: "پرداخت‌ها", icon: <CreditCard size={15} /> },
  { value: "people", label: "افراد", icon: <Users size={15} /> },
  { value: "report", label: "گزارش", icon: <ChartPie size={15} /> },
];

export function GroupView({
  detail,
  accounts,
  today,
}: {
  detail: DongGroupDetail;
  /** Every account the viewer has; narrowed to this group's currency below. */
  accounts: AccountRow[];
  today: string;
}) {
  const { group, members, balances, expenses, payments } = detail;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("expenses");
  const [actionError, setActionError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const [groupSheet, setGroupSheet] = useState(false);
  const [expenseSheet, setExpenseSheet] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DongExpenseWithShares | null>(null);
  const [paymentSheet, setPaymentSheet] = useState(false);
  const [editingPayment, setEditingPayment] = useState<DongPaymentRow | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [memberSheet, setMemberSheet] = useState(false);
  const [editingMember, setEditingMember] = useState<DongMemberRow | null>(null);

  const byId = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const balanceById = useMemo(
    () => new Map(balances.map((balance) => [balance.memberId, balance])),
    [balances],
  );

  const me = members.find((member) => member.is_me);
  const myBalance = me ? balanceById.get(me.id) : undefined;
  const hasFund = members.some((member) => member.is_fund);

  // This app converts nothing, so an account in another currency cannot be
  // the one this group is run out of. See migration 0017.
  const usableAccounts = useMemo(
    () => accounts.filter((account) => account.currency === group.currency),
    [accounts, group.currency],
  );

  const moved = useMemo(
    () =>
      personalMovement(
        me?.id,
        expenses.map((expense) => ({
          paidByMemberId: expense.paid_by_member_id,
          accountId: expense.account_id,
          amount: expense.amount,
        })),
        payments.map((payment) => ({
          fromMemberId: payment.from_member_id,
          toMemberId: payment.to_member_id,
          accountId: payment.account_id,
          amount: payment.amount,
        })),
      ),
    [me?.id, expenses, payments],
  );

  function openExpense(expense: DongExpenseWithShares | null) {
    setEditingExpense(expense);
    setExpenseSheet(true);
  }

  function openPayment(payment: DongPaymentRow | null, draft: PaymentDraft | null = null) {
    setEditingPayment(payment);
    setPaymentDraft(draft);
    setPaymentSheet(true);
  }

  function openMember(member: DongMemberRow | null) {
    setEditingMember(member);
    setMemberSheet(true);
  }

  function run(action: () => Promise<{ error: string } | { ok: true }>) {
    setActionError(undefined);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setActionError(result.error);
      else router.refresh();
    });
  }

  function onSettleTransfer(transfer: Transfer) {
    setTab("payments");
    openPayment(null, {
      fromMemberId: transfer.fromMemberId,
      toMemberId: transfer.toMemberId,
      amount: transfer.amount,
    });
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-4">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/dong"
            aria-label="برگشت به دوره‌ها"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-lapis-tint hover:text-lapis"
          >
            <ArrowRight size={18} />
          </Link>

          <h1 className="min-w-0 flex-1 truncate text-title font-semibold text-ink">
            {group.title}
          </h1>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="ویرایش دوره"
            onClick={() => setGroupSheet(true)}
          >
            <PencilSimple size={18} />
          </Button>
        </div>

        <p className="mt-1 ps-11 text-caption text-ink-muted">
          {faNumber(group.memberCount)} نفر · از {formatDateFa(group.started_on)}
          {group.settled_at && " · بسته‌شده"}
        </p>
      </header>

      {/* The one number the viewer opened this page for. */}
      {myBalance && (
        <div className="mb-3 flex items-baseline justify-between rounded-card border border-hairline bg-surface px-4 py-3">
          <span className="text-caption text-ink-muted">
            {standing(myBalance.net) === "owed"
              ? "از بقیه طلبکاری"
              : standing(myBalance.net) === "owes"
                ? "به بقیه بدهکاری"
                : "حسابت با بقیه صاف است"}
          </span>
          <Money
            minor={myBalance.net}
            currency={group.currency}
            size="kpi"
            signed
            tone={myBalance.net === 0 ? "none" : "auto"}
          />
        </div>
      )}

      {/* What this trip has actually done to the user's own money. Separate
          from the balance above, and deliberately: that number is about the
          group, this one is about their bank account, and the two are almost
          never the same. */}
      {(moved.out > 0 || moved.in > 0) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-card border border-hairline bg-surface px-4 py-3">
          <span className="text-caption text-ink-muted">از حساب‌های خودت</span>
          <span className="flex items-baseline gap-4 text-caption text-ink-muted">
            <span>
              رفته <Money minor={moved.out} currency={group.currency} size="row" />
            </span>
            <span>
              برگشته <Money minor={moved.in} currency={group.currency} size="row" />
            </span>
          </span>
        </div>
      )}

      {/* Offered once, where the answer is cheap: the alternative is a trip
          that is entirely correct about who owes whom and has never touched
          the account the money actually left. */}
      {me && !group.account_id && usableAccounts.length > 0 && (
        <button
          type="button"
          onClick={() => setGroupSheet(true)}
          className="mb-3 w-full rounded-card border border-dashed border-hairline-strong bg-paper px-4 py-3 text-start text-caption text-ink-muted hover:border-lapis hover:text-lapis"
        >
          برای این دوره حسابی انتخاب نکرده‌ای. اگر انتخاب کنی، هر خریدی که خودت
          پولش را بدهی در حسابداری شخصی‌ات هم ثبت می‌شود.
        </button>
      )}

      <SegmentedControl
        label="بخش‌های دوره"
        value={tab}
        onChange={setTab}
        segments={TABS}
      />

      {actionError && (
        <div className="mt-3">
          <FormError>{actionError}</FormError>
        </div>
      )}

      <div className="mt-3">
        {tab === "expenses" && (
          <>
            {expenses.length === 0 ? (
              <EmptyPanel
                icon={<ShoppingCart size={24} />}
                title="هنوز خریدی ثبت نشده."
                body="هر چیزی که کسی پولش را داده اینجا ثبت می‌شود — با اسم کسی که پرداخته و کسانی که سهیم‌اند."
              />
            ) : (
              <div className="overflow-hidden rounded-card border border-hairline bg-surface">
                {expenses.map((expense) => (
                  <ExpenseRowItem
                    key={expense.id}
                    expense={expense}
                    members={byId}
                    currency={group.currency}
                    onEdit={() => openExpense(expense)}
                  />
                ))}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="mt-3 w-full"
              onClick={() => openExpense(null)}
            >
              <Plus size={18} />
              خرید تازه
            </Button>
          </>
        )}

        {tab === "payments" && (
          <>
            {payments.length === 0 ? (
              <EmptyPanel
                icon={<CreditCard size={24} />}
                title="هنوز پرداختی ثبت نشده."
                body="قرضِ وسط راه، پول ریخته‌شده به صندوق، یا تسویه‌ی آخر دوره — هر سه اینجا می‌آیند."
              />
            ) : (
              <div className="overflow-hidden rounded-card border border-hairline bg-surface">
                {payments.map((payment) => (
                  <PaymentRowItem
                    key={payment.id}
                    payment={payment}
                    members={byId}
                    currency={group.currency}
                    onEdit={() => openPayment(payment)}
                  />
                ))}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="mt-3 w-full"
              disabled={members.length < 2}
              onClick={() => openPayment(null)}
            >
              <Plus size={18} />
              پرداخت تازه
            </Button>

            {members.length < 2 && (
              <p className="mt-2 text-center text-caption text-ink-muted">
                برای ثبت پرداخت دست‌کم دو نفر لازم است.
              </p>
            )}
          </>
        )}

        {tab === "people" && (
          <>
            <div className="overflow-hidden rounded-card border border-hairline bg-surface">
              {members.map((member) => {
                const balance = balanceById.get(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => openMember(member)}
                    className="flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-start last:border-b-0 hover:bg-paper"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <MemberName
                        member={member}
                        className="truncate text-[15px] font-medium text-ink"
                      />
                      {balance && (
                        <span className="mt-0.5 text-caption text-ink-muted">
                          پرداخته{" "}
                          <Money
                            minor={balance.paid}
                            currency={group.currency}
                            omitSymbol
                          />{" "}
                          · سهمش{" "}
                          <Money
                            minor={balance.share}
                            currency={group.currency}
                            omitSymbol
                          />
                        </span>
                      )}
                    </span>

                    {balance && (
                      <Money
                        minor={balance.net}
                        currency={group.currency}
                        size="row"
                        signed
                        tone={balance.net === 0 ? "none" : "auto"}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              size="lg"
              className="mt-3 w-full"
              onClick={() => openMember(null)}
            >
              <UserPlus size={18} />
              افزودن نفر
            </Button>

            {!hasFund && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full"
                  disabled={isPending}
                  onClick={() => run(() => addDongFund(group.id))}
                >
                  <Vault size={16} />
                  ساختن صندوق دوره
                </Button>
                <p className="mt-2 rounded-control border border-dashed border-hairline-strong bg-paper px-3 py-2.5 text-caption text-ink-muted">
                  اگر اول دوره همه مبلغی روی هم می‌گذارند، صندوق بساز: پول ریختن به آن
                  یک پرداخت است و خرج‌کردن از آن یک خرید، و آخر دوره خودش نشان می‌دهد
                  چقدر از صندوق مانده.
                </p>
              </>
            )}
          </>
        )}

        {tab === "report" && (
          <DongReport
            balances={balances}
            members={byId}
            expenses={expenses}
            currency={group.currency}
            onSettle={onSettleTransfer}
          />
        )}
      </div>

      {/* Archiving lives at the bottom of the page, not in the header: it is
          the last thing you do with a group, and never by accident. */}
      <Button
        type="button"
        variant="ghost"
        className="mt-5 w-full"
        disabled={isPending}
        onClick={() => run(() => setDongGroupSettled(group.id, !group.settled_at))}
      >
        <CheckCircle size={16} />
        {group.settled_at ? "بازکردن دوباره‌ی دوره" : "بستن دوره"}
      </Button>

      <GroupSheet
        open={groupSheet}
        onOpenChange={setGroupSheet}
        group={group}
        accounts={accounts}
        defaultCurrency={group.currency}
        defaultAccountId={group.account_id}
        today={today}
      />
      <ExpenseSheet
        open={expenseSheet}
        onOpenChange={setExpenseSheet}
        groupId={group.id}
        members={members}
        accounts={usableAccounts}
        groupAccountId={group.account_id}
        currency={group.currency}
        today={today}
        expense={editingExpense}
      />
      <PaymentSheet
        open={paymentSheet}
        onOpenChange={setPaymentSheet}
        groupId={group.id}
        members={members}
        accounts={usableAccounts}
        groupAccountId={group.account_id}
        currency={group.currency}
        today={today}
        payment={editingPayment}
        draft={paymentDraft}
      />
      <MemberSheet
        open={memberSheet}
        onOpenChange={setMemberSheet}
        groupId={group.id}
        member={editingMember}
      />
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-hairline-strong bg-surface px-4 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-lapis-tint text-lapis">
        {icon}
      </span>
      <p className="text-body text-ink">{title}</p>
      <p className="max-w-[42ch] text-caption text-ink-muted">{body}</p>
    </div>
  );
}
