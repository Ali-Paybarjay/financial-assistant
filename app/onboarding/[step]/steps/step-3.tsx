"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/amount-input";
import { FormError } from "@/components/field";
import { StepShell, SaveReassurance } from "@/components/onboarding/step-shell";
import { formatMoney, toMinor, type CurrencyCode } from "@/lib/money";
import { RECURRING_SUGGESTIONS, type StepMeta } from "@/lib/onboarding/config";
import { step3Schema, type Step3Input } from "@/lib/validation/onboarding";
import type { CategoryRow, RecurringExpenseRow } from "@/lib/supabase/database.types";
import { saveStep3 } from "../../actions";

export function Step3({
  meta,
  currency,
  categories,
  expenses,
}: {
  meta: StepMeta;
  currency: CurrencyCode;
  categories: CategoryRow[];
  expenses: RecurringExpenseRow[];
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      expenses: expenses.map((expense) => ({
        title: expense.title,
        categorySlug: expense.category_id
          ? (slugById.get(expense.category_id) ?? "misc")
          : "misc",
        amount: formatMoney(expense.amount, currency, { omitSymbol: true }).replace(/,/g, ""),
        dueDay: expense.due_day,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "expenses" });
  const usedTitles = new Set(fields.map((field) => field.title));

  function onSubmit(values: Step3Input) {
    setFormError(undefined);
    try {
      values.expenses.forEach((expense) => toMinor(expense.amount, currency));
    } catch {
      setFormError("یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس، مثل ۱۲۰۰.");
      return;
    }
    startTransition(async () => {
      const result = await saveStep3(values);
      if (result && "error" in result) setFormError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepShell
        step={meta.step}
        kicker={meta.kicker}
        title={meta.title}
        subtitle={meta.subtitle}
        footer={
          <>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "دارم ذخیره می‌کنم…" : "ادامه"}
            </Button>
            <SaveReassurance />
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormError>{formError ?? errors.expenses?.message}</FormError>

          <div className="flex flex-wrap gap-2">
            {RECURRING_SUGGESTIONS.filter(
              (suggestion) => !usedTitles.has(suggestion.title),
            ).map((suggestion) => (
              <button
                key={suggestion.title}
                type="button"
                onClick={() =>
                  append({
                    title: suggestion.title,
                    categorySlug: suggestion.slug,
                    amount: "",
                    dueDay: suggestion.dueDay,
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline-strong bg-surface px-3.5 text-[13px] text-ink transition-colors hover:border-action hover:bg-action-tint hover:text-action"
              >
                <Plus size={14} />
                {suggestion.title}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {fields.length === 0 && (
              <p className="rounded-card border border-dashed border-hairline-strong bg-paper p-4 text-caption text-ink-muted">
                یکی از چیپ‌های بالا را بزن، یا ردیف دلخواه اضافه کن.
              </p>
            )}

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-card border border-hairline bg-paper p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="عنوان هزینه"
                    placeholder="مثلاً اجاره"
                    {...register(`expenses.${index}.title`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="حذف این ردیف"
                    onClick={() => remove(index)}
                  >
                    <Trash size={18} />
                  </Button>
                </div>
                <AmountInput
                  aria-label="مبلغ ماهانه"
                  currency={currency}
                  placeholder="0"
                  {...register(`expenses.${index}.amount`)}
                />
                <input type="hidden" {...register(`expenses.${index}.categorySlug`)} />
                <input
                  type="hidden"
                  {...register(`expenses.${index}.dueDay`, { valueAsNumber: true })}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({ title: "", categorySlug: "misc", amount: "", dueDay: 1 })
              }
            >
              <Plus size={16} />
              ردیف دلخواه
            </Button>
          </div>
        </div>
      </StepShell>
    </form>
  );
}
