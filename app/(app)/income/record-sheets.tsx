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
import { AccountField } from "@/components/accounts/account-field";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import {
  FREQUENCY_OPTIONS,
  INCOME_TYPE_OPTIONS,
  MONTH_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
} from "@/lib/onboarding/config";
import {
  incomeSourceFormSchema,
  recurringExpenseFormSchema,
  type IncomeSourceForm,
  type RecurringExpenseForm,
} from "@/lib/validation/records";
import type {
  AccountRow,
  CategoryRow,
  IncomeSourceRow,
  RecurringExpenseRow,
} from "@/lib/supabase/database.types";
import { deleteRecord, saveIncomeSource, saveRecurringExpense } from "./actions";

function amountText(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { omitSymbol: true }).replace(/,/g, "");
}

/** 1–12. Only ever a default for the month select, never a stored value. */
const THIS_MONTH = new Date().getUTCMonth() + 1;

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
            title: source.title,
            type: source.type as IncomeSourceForm["type"],
            amount: amountText(source.amount, currency),
            frequency: source.frequency as IncomeSourceForm["frequency"],
          }
        : { title: "", type: "salary", amount: "", frequency: "monthly" },
    );
    setFormError(undefined);
  }, [open, source, currency, reset]);

  function onSubmit(values: IncomeSourceForm) {
    startTransition(async () => {
      // The id belongs to the row being edited, not to the form. A hidden
      // input hands back "" for a new record, "" is not a uuid, and nothing
      // renders errors.id — so the submit became a silent no-op.
      const result = await saveIncomeSource({ ...values, id: source?.id });
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

        <div className="mt-2 flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
            {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
          </Button>
          {source && (
            <DeleteButton
              table="income_sources"
              id={source.id}
              onDone={() => onOpenChange(false)}
              onError={setFormError}
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
  accounts,
  defaultAccountId,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  categories: CategoryRow[];
  accounts: AccountRow[];
  defaultAccountId: string | null;
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
    watch,
  } = useForm<RecurringExpenseForm>({
    resolver: zodResolver(recurringExpenseFormSchema),
    defaultValues: {
      title: "",
      categorySlug: "housing",
      accountId: defaultAccountId ?? "",
      amount: "",
      frequency: "monthly",
      dueDay: 1,
      // Only read for a non-monthly bill. Defaulting to this month means the
      // select opens on something sensible rather than on January.
      dueMonth: THIS_MONTH,
      autoPost: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      expense
        ? {
            title: expense.title,
            categorySlug: expense.category_id
              ? (slugById.get(expense.category_id) ?? "misc")
              : "misc",
            accountId: expense.account_id ?? "",
            amount: amountText(expense.amount, currency),
            frequency: expense.frequency as RecurringExpenseForm["frequency"],
            dueDay: expense.due_day,
            dueMonth: expense.due_month ?? THIS_MONTH,
            autoPost: expense.auto_post,
          }
        : {
            title: "",
            categorySlug: "housing",
            accountId: defaultAccountId ?? "",
            amount: "",
            frequency: "monthly",
            dueDay: 1,
            dueMonth: THIS_MONTH,
            autoPost: true,
          },
    );
    setFormError(undefined);
    // slugById is derived from `categories`, which is what actually changes.
  }, [open, expense, currency, categories, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const frequency = watch("frequency");

  function onSubmit(values: RecurringExpenseForm) {
    startTransition(async () => {
      // The id belongs to the row being edited, not to the form. A hidden
      // input hands back "" for a new record, "" is not a uuid, and nothing
      // renders errors.id — so the submit became a silent no-op.
      const result = await saveRecurringExpense({ ...values, id: expense?.id });
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="مبلغ" htmlFor="recurring-amount" error={errors.amount?.message}>
            <AmountInput id="recurring-amount" currency={currency} {...register("amount")} />
          </Field>
          {/* The amount is per payment, so how often it is paid is the other
              half of it. Without this every bill was read as monthly, and a
              yearly premium counted twelve times over in what a month costs. */}
          <Field label="هر چند وقت" htmlFor="recurring-frequency">
            <NativeSelect id="recurring-frequency" {...register("frequency")}>
              {RECURRING_FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

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

        {/* Which day is not enough for a bill that is not due every month.
            Without it the generator has no way to know when to post one. */}
        {frequency !== "monthly" && (
          <Field
            label={frequency === "yearly" ? "کدام ماه" : "از کدام ماه شروع می‌شود"}
            htmlFor="recurring-month"
            hint={
              frequency === "quarterly"
                ? "از همان ماه، و بعد هر سه ماه یک‌بار."
                : undefined
            }
          >
            <NativeSelect
              id="recurring-month"
              {...register("dueMonth", { valueAsNumber: true })}
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        <AccountField
          id="recurring-account"
          accounts={accounts}
          selectedId={expense?.account_id}
          hint="ردیفی که اول ماه ثبت می‌شود، از موجودی همین حساب کم می‌شود."
          {...register("accountId")}
        />

        <label className="flex items-center gap-2.5 rounded-control border border-hairline bg-paper p-3">
          <input
            type="checkbox"
            className="size-4 accent-action"
            {...register("autoPost")}
          />
          <span className="text-caption text-ink">
            {frequency === "monthly"
              ? "اول هر ماه خودکار ثبت شود"
              : "سرِ موعدش خودکار ثبت شود"}
          </span>
        </label>

        <div className="mt-2 flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
            {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
          </Button>
          {expense && (
            <DeleteButton
              table="recurring_expenses"
              id={expense.id}
              onDone={() => onOpenChange(false)}
              onError={setFormError}
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
  onError,
}: {
  table: "income_sources" | "recurring_expenses";
  id: string;
  onDone: () => void;
  /** Because a delete really can fail, and used to fail without a word. */
  onError: (message: string) => void;
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
          // The result was thrown away here. A fixed bill that had ever been
          // generated could not be deleted at all, and the sheet closed as
          // though it had been — the row was simply still there afterwards.
          const result = await deleteRecord(table, id);
          if ("error" in result) {
            onError(result.error);
            return;
          }
          onDone();
        })
      }
    >
      <Trash size={18} />
    </Button>
  );
}
