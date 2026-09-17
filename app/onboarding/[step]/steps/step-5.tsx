"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { StepShell, SaveReassurance } from "@/components/onboarding/step-shell";
import { SkipButton } from "@/components/onboarding/skip-button";
import { formatMoney, toMinor, type CurrencyCode } from "@/lib/money";
import { GOAL_TYPE_OPTIONS, type StepMeta } from "@/lib/onboarding/config";
import { step5Schema, type Step5Input } from "@/lib/validation/onboarding";
import type { GoalRow } from "@/lib/supabase/database.types";
import { saveStep5 } from "../../actions";

export function Step5({
  meta,
  currency,
  goals,
}: {
  meta: StepMeta;
  currency: CurrencyCode;
  goals: GoalRow[];
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Step5Input>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      goals:
        goals.length > 0
          ? goals.map((goal) => ({
              title: goal.title,
              type: goal.type as Step5Input["goals"][number]["type"],
              targetAmount: formatMoney(goal.target_amount, currency, {
                omitSymbol: true,
              }).replace(/,/g, ""),
              targetDate: goal.target_date ?? "",
              priority: goal.priority,
            }))
          : [
              {
                title: "صندوق اضطراری",
                type: "emergency_fund",
                targetAmount: "",
                targetDate: "",
                priority: 0,
              },
            ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "goals" });

  function onSubmit(values: Step5Input) {
    setFormError(undefined);
    try {
      values.goals.forEach((goal) => toMinor(goal.targetAmount, currency));
    } catch {
      setFormError("مبلغ هدف عدد نیست. فقط رقم بنویس، مثل ۱۰۰۰۰.");
      return;
    }
    startTransition(async () => {
      const result = await saveStep5(values);
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
            <SkipButton step={meta.step} />
            <SaveReassurance />
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormError>{formError ?? errors.goals?.message}</FormError>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  aria-label="عنوان هدف"
                  placeholder="مثلاً سفر تابستان"
                  {...register(`goals.${index}.title`)}
                />
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="حذف این هدف"
                    onClick={() => remove(index)}
                  >
                    <Trash size={18} />
                  </Button>
                )}
              </div>

              <NativeSelect aria-label="نوع هدف" {...register(`goals.${index}.type`)}>
                {GOAL_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>

              <Field label="مبلغ هدف" htmlFor={`goal-amount-${index}`}>
                <AmountInput
                  id={`goal-amount-${index}`}
                  currency={currency}
                  placeholder="10000"
                  {...register(`goals.${index}.targetAmount`)}
                />
              </Field>

              <Field label="تا چه تاریخی؟" htmlFor={`goal-date-${index}`}>
                <Input
                  id={`goal-date-${index}`}
                  type="date"
                  dir="ltr"
                  {...register(`goals.${index}.targetDate`)}
                />
              </Field>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({
                title: "",
                type: "other",
                targetAmount: "",
                targetDate: "",
                priority: fields.length,
              })
            }
          >
            <Plus size={16} />
            هدف دیگر
          </Button>
        </div>
      </StepShell>
    </form>
  );
}
