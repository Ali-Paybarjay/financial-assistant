"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Flag, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { Money } from "@/components/money";
import { faPercent } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { GOAL_TYPE_OPTIONS } from "@/lib/onboarding/config";
import { goalFormSchema, type GoalForm } from "@/lib/validation/records";
import type { GoalRow } from "@/lib/supabase/database.types";
import { deleteGoal, saveGoal } from "./actions";

function amountText(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { omitSymbol: true }).replace(/,/g, "");
}

export function GoalsView({
  currency,
  goals,
}: {
  currency: CurrencyCode;
  goals: GoalRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<GoalRow | null>(null);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GoalForm>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      title: "",
      type: "emergency_fund",
      targetAmount: "",
      savedAmount: "",
      targetDate: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            id: editing.id,
            title: editing.title,
            type: editing.type as GoalForm["type"],
            targetAmount: amountText(editing.target_amount, currency),
            savedAmount: amountText(editing.saved_amount, currency),
            targetDate: editing.target_date ?? "",
          }
        : {
            id: undefined,
            title: "",
            type: "emergency_fund",
            targetAmount: "",
            savedAmount: "",
            targetDate: "",
          },
    );
    setFormError(undefined);
  }, [open, editing, currency, reset]);

  function onSubmit(values: GoalForm) {
    startTransition(async () => {
      const result = await saveGoal(values);
      if ("error" in result) setFormError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-4">
      <h1 className="mb-4 text-title font-semibold text-ink">هدف‌ها</h1>

      {goals.length === 0 ? (
        <p className="rounded-card border border-hairline bg-surface p-6 text-center text-body text-ink-muted">
          هنوز هدفی نداری. یک هدف بساز تا بگویم ماهی چقدر باید بگذاری کنار.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => {
            const progress = Math.min(
              100,
              Math.round((goal.saved_amount / goal.target_amount) * 100),
            );
            const remaining = Math.max(goal.target_amount - goal.saved_amount, 0);
            return (
              <li key={goal.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(goal);
                    setOpen(true);
                  }}
                  className="flex w-full flex-col gap-2 rounded-card border border-hairline bg-surface p-4 text-start hover:border-hairline-strong"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                      <Flag size={16} className="text-lapis" />
                      {goal.title}
                    </span>
                    <span className="flex items-baseline gap-1 text-caption text-ink-muted">
                      <Money minor={goal.saved_amount} currency={currency} />
                      /
                      <Money minor={goal.target_amount} currency={currency} />
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={goal.title}
                    className="h-2 overflow-hidden rounded-full bg-lapis-tint"
                  >
                    <div
                      className="h-full rounded-full bg-lapis"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-baseline justify-between text-caption text-ink-muted">
                    <span>{faPercent(progress)} رسیده‌ای</span>
                    <span className="flex items-baseline gap-1">
                      <Money minor={remaining} currency={currency} />
                      مانده
                      {goal.target_date && ` تا ${formatDateFa(goal.target_date)}`}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 w-full"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <Plus size={18} />
        هدف تازه
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? "ویرایش هدف" : "هدف تازه"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormError>{formError}</FormError>

          <Field label="عنوان" htmlFor="goal-title" error={errors.title?.message}>
            <Input id="goal-title" placeholder="مثلاً سفر تابستان" {...register("title")} />
          </Field>

          <Field label="نوع" htmlFor="goal-type">
            <NativeSelect id="goal-type" {...register("type")}>
              {GOAL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="مبلغ هدف"
              htmlFor="goal-target"
              error={errors.targetAmount?.message}
            >
              <AmountInput id="goal-target" currency={currency} {...register("targetAmount")} />
            </Field>
            <Field label="تا حالا کنار گذاشته‌ای" htmlFor="goal-saved">
              <AmountInput id="goal-saved" currency={currency} {...register("savedAmount")} />
            </Field>
          </div>

          <Field label="تا چه تاریخی؟" htmlFor="goal-date">
            <Input id="goal-date" type="date" dir="ltr" {...register("targetDate")} />
          </Field>

          <input type="hidden" {...register("id")} />

          <div className="mt-2 flex gap-2">
            <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
              {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                aria-label="حذف"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteGoal(editing.id);
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                <Trash size={18} />
              </Button>
            )}
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}
