"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { AccountField } from "@/components/accounts/account-field";
import { NativeSelect } from "@/components/native-select";
import { SegmentedControl } from "@/components/segmented-control";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";
import type { CurrencyCode } from "@/lib/money";
import type { AccountRow, CategoryRow, GoalRow } from "@/lib/supabase/database.types";
import {
  transactionFormSchema,
  type TransactionForm,
} from "@/lib/validation/transactions";
import { saveTransaction } from "@/app/(app)/transactions/actions";
import { cn } from "@/lib/utils";

export function ManualForm({
  currency,
  categories,
  accounts,
  goals,
  defaultAccountId,
  today,
  onSaved,
}: {
  currency: CurrencyCode;
  categories: CategoryRow[];
  accounts: AccountRow[];
  goals: GoalRow[];
  defaultAccountId: string | null;
  today: string;
  onSaved: (message: string) => void;
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TransactionForm>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: "expense",
      amount: "",
      categorySlug: "groceries",
      accountId: defaultAccountId ?? "",
      toAccountId: "",
      goalId: "",
      occurredOn: today,
      merchant: "",
      note: "",
    },
  });

  const type = watch("type");
  const isTransfer = type === "transfer";
  const visibleCategories = categories.filter((category) => category.kind === type);

  // Offered only once there are two accounts to move money between. With one
  // account it is not a transfer, it is a withdrawal.
  const transferable = accounts.filter((account) => account.is_active).length >= 2;

  function onSubmit(values: TransactionForm) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveTransaction(values);
      if ("error" in result) setFormError(result.error);
      // A transfer does not change what is left this month, so quoting the
      // month's balance back would be a non sequitur dressed as a confirmation.
      else if (values.type === "transfer") {
        onSaved("انتقال ثبت شد. موجودی هر دو حساب به‌روز شد.");
      } else onSaved(`ثبت شد. ${result.balanceText} برایت مانده.`);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormError>{formError}</FormError>

      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <SegmentedControl<TransactionForm["type"]>
            label="نوع تراکنش"
            value={field.value}
            onChange={field.onChange}
            segments={[
              { value: "expense", label: "هزینه" },
              { value: "income", label: "درآمد" },
              ...(transferable
                ? [
                    {
                      value: "transfer" as const,
                      label: "انتقال",
                      icon: <ArrowsLeftRight size={15} />,
                    },
                  ]
                : []),
            ]}
          />
        )}
      />

      <Field label="مبلغ" htmlFor="amount" error={errors.amount?.message}>
        <AmountInput
          id="amount"
          size="hero"
          currency={currency}
          placeholder="0"
          autoFocus
          {...register("amount")}
        />
      </Field>

      {!isTransfer && (
      <Field label="دسته" htmlFor="category" error={errors.categorySlug?.message}>
        <Controller
          control={control}
          name="categorySlug"
          render={({ field }) => (
            <div id="category" className="flex flex-wrap gap-1.5">
              {visibleCategories.map((category) => {
                const selected = field.value === category.slug;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => field.onChange(category.slug)}
                    className={cn(
                      "h-9 rounded-full border px-3 text-[13px] transition-colors",
                      selected
                        ? "border-action bg-action text-white"
                        : "border-hairline-strong bg-surface text-ink-muted hover:border-action hover:text-action",
                    )}
                  >
                    {category.name_fa}
                  </button>
                );
              })}
            </div>
          )}
        />
      </Field>
      )}

      {isTransfer ? (
        <div className="flex flex-col gap-4">
          <AccountField
            id="account"
            label="از حساب"
            accounts={accounts}
            allowNone={false}
            error={errors.accountId?.message}
            {...register("accountId")}
          />
          <AccountField
            id="toAccount"
            label="به حساب"
            accounts={accounts}
            allowNone={false}
            error={errors.toAccountId?.message}
            hint="از موجودی اولی کم و به دومی اضافه می‌شود؛ در هزینه و درآمد ماه شمرده نمی‌شود."
            {...register("toAccountId")}
          />
        </div>
      ) : (
        <AccountField
          id="account"
          accounts={accounts}
          hint="از موجودی همین حساب کم یا به آن اضافه می‌شود."
          {...register("accountId")}
        />
      )}

      {/* Asked here, not only in the edit sheet: the day you buy the thing you
          were saving for is the day you know it was for that goal, and making
          the user save the row first and go back to label it is how the link
          never gets made. Income is never goal money, so it is not offered. */}
      {type !== "income" && goals.length > 0 && (
        <Field
          label="بابت کدام هدف؟"
          htmlFor="goal"
          hint={
            isTransfer
              ? "اگر این انتقال پس‌اندازِ یک هدف است، اینجا بگو."
              : "اگر این خرید از پس‌انداز همان هدف بوده، اینجا بگو تا از موجودی هدف کم شود."
          }
        >
          <NativeSelect id="goal" {...register("goalId")}>
            <option value="">هیچ‌کدام</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="تاریخ" htmlFor="occurredOn" error={errors.occurredOn?.message}>
          <Input id="occurredOn" type="date" dir="ltr" {...register("occurredOn")} />
        </Field>
        {isTransfer ? (
          <Field label="توضیح" htmlFor="note">
            <Input id="note" placeholder="اختیاری" {...register("note")} />
          </Field>
        ) : (
          <Field label="فروشنده" htmlFor="merchant">
            <Input id="merchant" placeholder="اختیاری" {...register("merchant")} />
          </Field>
        )}
      </div>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending
          ? "دارم ثبت می‌کنم…"
          : type === "expense"
            ? "ثبت هزینه"
            : type === "income"
              ? "ثبت درآمد"
              : "ثبت انتقال"}
      </Button>
    </form>
  );
}
