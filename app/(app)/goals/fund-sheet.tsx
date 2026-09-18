"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import {
  goalFundingFormSchema,
  type GoalFundingForm,
} from "@/lib/validation/records";
import type { AccountWithBalance } from "@/lib/accounts";
import type { GoalPlan } from "@/lib/goals";
import { fundGoal } from "./actions";

function amountText(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { omitSymbol: true }).replace(/,/g, "");
}

/**
 * Moving the month's share into savings.
 *
 * Deliberately a transfer between two real accounts rather than a number typed
 * onto the goal: money that never left the account it is spent from has not
 * been set aside, and a progress bar that says otherwise is the thing this
 * feature exists to stop. Nothing here is an expense — that happens on the day
 * the money is spent on the goal.
 */
export function FundGoalSheet({
  plan,
  currency,
  today,
  accounts,
  savingsAccounts,
  defaultFromAccountId,
  suggested,
  onClose,
}: {
  plan: GoalPlan | null;
  currency: CurrencyCode;
  today: string;
  accounts: AccountWithBalance[];
  savingsAccounts: AccountWithBalance[];
  defaultFromAccountId: string | null;
  /** What the plan says to move this month. */
  suggested: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GoalFundingForm>({
    resolver: zodResolver(goalFundingFormSchema),
  });

  useEffect(() => {
    if (!plan) return;
    reset({
      goalId: plan.goal.id,
      amount: amountText(suggested, currency),
      fromAccountId: defaultFromAccountId ?? "",
      toAccountId: savingsAccounts[0]?.id ?? "",
      occurredOn: today,
    });
    setFormError(undefined);
  }, [plan, suggested, currency, defaultFromAccountId, savingsAccounts, today, reset]);

  function onSubmit(values: GoalFundingForm) {
    startTransition(async () => {
      const result = await fundGoal(values);
      if ("error" in result) setFormError(result.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  const spendable = accounts.filter((account) => account.kind !== "savings");

  return (
    <BottomSheet
      open={plan !== null}
      onOpenChange={(next) => !next && onClose()}
      title={plan ? `بریز کنار — ${plan.goal.title}` : "بریز کنار"}
    >
      {savingsAccounts.length === 0 ? (
        // The one thing the user has to do first, said plainly, with the way
        // to do it attached. A goal cannot be funded into nowhere.
        <div className="flex flex-col gap-3">
          <p className="text-body text-ink-muted">
            حساب پس‌اندازی نداری. پولی که کنار می‌گذاری باید جای جدایی برود، وگرنه
            همان‌جا می‌ماند که از آن خرج می‌کنی و بی‌آنکه بفهمی خرج می‌شود.
          </p>
          <Button asChild size="lg">
            <Link href="/accounts">یک حساب پس‌انداز بساز</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormError>{formError}</FormError>
          <input type="hidden" {...register("goalId")} />

          <Field label="مبلغ" htmlFor="fund-amount" error={errors.amount?.message}>
            <AmountInput id="fund-amount" currency={currency} {...register("amount")} />
          </Field>

          <Field
            label="از کدام حساب"
            htmlFor="fund-from"
            error={errors.fromAccountId?.message}
          >
            <NativeSelect id="fund-from" {...register("fromAccountId")}>
              <option value="">انتخاب کن</option>
              {spendable.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.title}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="به کدام حساب پس‌انداز"
            htmlFor="fund-to"
            error={errors.toAccountId?.message}
          >
            <NativeSelect id="fund-to" {...register("toAccountId")}>
              {savingsAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.title}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="تاریخ" htmlFor="fund-date" error={errors.occurredOn?.message}>
            <Input id="fund-date" type="date" dir="ltr" {...register("occurredOn")} />
          </Field>

          <p className="text-caption text-ink-muted">
            این یک انتقال است، نه هزینه. پول هنوز مال توست و در هزینه‌های ماه شمرده
            نمی‌شود؛ روزی هزینه می‌شود که بابت همین هدف خرجش کنی.
          </p>

          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "دارم ثبت می‌کنم…" : "ثبت انتقال"}
          </Button>
        </form>
      )}
    </BottomSheet>
  );
}
