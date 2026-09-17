"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { FREQUENCY_OPTIONS, INCOME_TYPE_OPTIONS } from "@/lib/onboarding/config";
import {
  incomeSourceFormSchema,
  recurringExpenseFormSchema,
  type IncomeSourceForm,
  type RecurringExpenseForm,
} from "@/lib/validation/records";
import type {
  CategoryRow,
  IncomeSourceRow,
  RecurringExpenseRow,
} from "@/lib/supabase/database.types";
import { deleteRecord, saveIncomeSource, saveRecurringExpense } from "./actions";

function amountText(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { omitSymbol: true }).replace(/,/g, "");
}

export function IncomeSourceSheet({
  open,
  onOpenChange,
  currency,
  source,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  source: IncomeSourceRow | null;
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IncomeSourceForm>({
    resolver: zodResolver(incomeSourceFormSchema),
    defaultValues: { title: "", type: "salary", amount: "", frequency: "monthly" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      source
        ? {
            id: source.id,
            title: source.title,
            type: source.type as IncomeSourceForm["type"],
            amount: amountText(source.amount, currency),
            frequency: source.frequency as IncomeSourceForm["frequency"],
          }
        : { id: undefined, title: "", type: "salary", amount: "", frequency: "monthly" },
    );
    setFormError(undefined);
  }, [open, source, currency, reset]);

  function onSubmit(values: IncomeSourceForm) {
    startTransition(async () => {
      const result = await saveIncomeSource(values);
      if ("error" in result) setFormError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={source ? "ویرایش منبع درآمد" : "منبع درآمد تازه"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <Field label="عنوان" htmlFor="income-title" error={errors.title?.message}>
          <Input id="income-title" placeholder="مثلاً حقوق شرکت" {...register("title")} />
        </Field>

        <Field label="مبلغ" htmlFor="income-amount" error={errors.amount?.message}>
          <AmountInput id="income-amount" currency={currency} {...register("amount")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع" htmlFor="income-type">
            <NativeSelect id="income-type" {...register("type")}>
              {INCOME_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="تناوب" htmlFor="income-frequency">
            <NativeSelect id="income-frequency" {...register("frequency")}>
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <input type="hidden" {...register("id")} />

        <div className="mt-2 flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
            {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
          </Button>
          {source && (
            <DeleteButton
              table="income_sources"
              id={source.id}
              onDone={() => onOpenChange(false)}
            />
          )}
        </div>
      </form>
    </BottomSheet>
  );
}

export function RecurringSheet({
  open,
  onOpenChange,
  currency,
  categories,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  categories: CategoryRow[];
  expense: RecurringExpenseRow | null;
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const expenseCategories = categories.filter((category) => category.kind === "expense");
  const slugById = new Map(categories.map((category) => [category.id, category.slug]));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecurringExpenseForm>({
    resolver: zodResolver(recurringExpenseFormSchema),
    defaultValues: {
      title: "",
      categorySlug: "housing",
      amount: "",
      dueDay: 1,
      autoPost: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      expense
        ? {
            id: expense.id,
            title: expense.title,
            categorySlug: expense.category_id
              ? (slugById.get(expense.category_id) ?? "misc")
              : "misc",
            amount: amountText(expense.amount, currency),
            dueDay: expense.due_day,
            autoPost: expense.auto_post,
          }
        : {
            id: undefined,
            title: "",
            categorySlug: "housing",
            amount: "",
            dueDay: 1,
            autoPost: true,
          },
    );
    setFormError(undefined);
    // slugById is derived from `categories`, which is what actually changes.
  }, [open, expense, currency, categories, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(values: RecurringExpenseForm) {
    startTransition(async () => {
      const result = await saveRecurringExpense(values);
      if ("error" in result) setFormError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? "ویرایش هزینه‌ی ثابت" : "هزینه‌ی ثابت تازه"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <Field label="عنوان" htmlFor="recurring-title" error={errors.title?.message}>
          <Input id="recurring-title" placeholder="مثلاً اجاره" {...register("title")} />
        </Field>

        <Field label="مبلغ ماهانه" htmlFor="recurring-amount" error={errors.amount?.message}>
          <AmountInput id="recurring-amount" currency={currency} {...register("amount")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="دسته" htmlFor="recurring-category">
            <NativeSelect id="recurring-category" {...register("categorySlug")}>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name_fa}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="روز ماه"
            htmlFor="recurring-day"
            error={errors.dueDay?.message}
          >
            <Input
              id="recurring-day"
              dir="ltr"
              inputMode="numeric"
              className="tabular-nums"
              {...register("dueDay", { valueAsNumber: true })}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 rounded-control border border-hairline bg-paper p-3">
          <input
            type="checkbox"
            className="size-4 accent-lapis"
            {...register("autoPost")}
          />
          <span className="text-caption text-ink">
            اول هر ماه خودکار ثبت شود
          </span>
        </label>

        <input type="hidden" {...register("id")} />

        <div className="mt-2 flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
            {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
          </Button>
          {expense && (
            <DeleteButton
              table="recurring_expenses"
              id={expense.id}
              onDone={() => onOpenChange(false)}
            />
          )}
        </div>
      </form>
    </BottomSheet>
  );
}

function DeleteButton({
  table,
  id,
  onDone,
}: {
  table: "income_sources" | "recurring_expenses";
  id: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      size="lg"
      aria-label="حذف"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await deleteRecord(table, id);
          onDone();
        })
      }
    >
      <Trash size={18} />
    </Button>
  );
}
