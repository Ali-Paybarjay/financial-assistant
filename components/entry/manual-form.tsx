"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { SegmentedControl } from "@/components/segmented-control";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryRow } from "@/lib/supabase/database.types";
import {
  transactionFormSchema,
  type TransactionForm,
} from "@/lib/validation/transactions";
import { saveTransaction } from "@/app/(app)/transactions/actions";
import { cn } from "@/lib/utils";

export function ManualForm({
  currency,
  categories,
  today,
  onSaved,
}: {
  currency: CurrencyCode;
  categories: CategoryRow[];
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
      occurredOn: today,
      merchant: "",
      note: "",
    },
  });

  const type = watch("type");
  const visibleCategories = categories.filter((category) => category.kind === type);

  function onSubmit(values: TransactionForm) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveTransaction(values);
      if ("error" in result) setFormError(result.error);
      else onSaved(`ثبت شد. ${result.balanceText} برایت مانده.`);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormError>{formError}</FormError>

      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <SegmentedControl<"expense" | "income">
            label="نوع تراکنش"
            value={field.value}
            onChange={field.onChange}
            segments={[
              { value: "expense", label: "هزینه" },
              { value: "income", label: "درآمد" },
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
                        ? "border-lapis bg-lapis text-white"
                        : "border-hairline-strong bg-surface text-ink-muted hover:border-lapis hover:text-lapis",
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="تاریخ" htmlFor="occurredOn" error={errors.occurredOn?.message}>
          <Input id="occurredOn" type="date" dir="ltr" {...register("occurredOn")} />
        </Field>
        <Field label="فروشنده" htmlFor="merchant">
          <Input id="merchant" placeholder="اختیاری" {...register("merchant")} />
        </Field>
      </div>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending
          ? "دارم ثبت می‌کنم…"
          : type === "expense"
            ? "ثبت هزینه"
            : "ثبت درآمد"}
      </Button>
    </form>
  );
}
