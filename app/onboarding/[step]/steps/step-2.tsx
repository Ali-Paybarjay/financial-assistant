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
import { StepShell } from "@/components/onboarding/step-shell";
import { SkipButton } from "@/components/onboarding/skip-button";
import { formatMoney, toMinor, type CurrencyCode } from "@/lib/money";
import {
  FREQUENCY_OPTIONS,
  INCOME_PLACEHOLDER,
  INCOME_TYPE_OPTIONS,
  type StepMeta,
} from "@/lib/onboarding/config";
import { step2Schema, type Step2Input } from "@/lib/validation/onboarding";
import type { IncomeSourceRow } from "@/lib/supabase/database.types";
import { saveStep2 } from "../../actions";

function minorToText(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { omitSymbol: true }).replace(/,/g, "");
}

export function Step2({
  meta,
  currency,
  profile,
  sources,
}: {
  meta: StepMeta;
  currency: CurrencyCode;
  profile: { monthly_income_estimate: number | null };
  sources: IncomeSourceRow[];
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      monthlyIncomeEstimate: profile.monthly_income_estimate
        ? minorToText(profile.monthly_income_estimate, currency)
        : "",
      sources:
        sources.length > 0
          ? sources.map((source) => ({
              title: source.title,
              type: source.type as Step2Input["sources"][number]["type"],
              amount: minorToText(source.amount, currency),
              frequency: source.frequency as Step2Input["sources"][number]["frequency"],
            }))
          : [{ title: "حقوق", type: "salary", amount: "", frequency: "monthly" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "sources" });

  function onSubmit(values: Step2Input) {
    setFormError(undefined);
    // Reject unparseable amounts here rather than after a round trip.
    try {
      toMinor(values.monthlyIncomeEstimate, currency);
      values.sources.forEach((source) => toMinor(source.amount, currency));
    } catch {
      setFormError("یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس، مثل ۴۵۰۰.");
      return;
    }
    startTransition(async () => {
      const result = await saveStep2(values);
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
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormError>{formError ?? errors.sources?.message}</FormError>

          <Field
            label="متوسط درآمد ماهیانه"
            htmlFor="monthlyIncomeEstimate"
            hint="تقریبی هم کافی است."
            error={errors.monthlyIncomeEstimate?.message}
          >
            <AmountInput
              id="monthlyIncomeEstimate"
              currency={currency}
              placeholder={INCOME_PLACEHOLDER[currency]}
              {...register("monthlyIncomeEstimate")}
            />
          </Field>

          <div className="flex flex-col gap-3">
            <p className="text-label font-medium text-ink-muted">منابع درآمد</p>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="عنوان منبع درآمد"
                    placeholder="مثلاً حقوق شرکت"
                    {...register(`sources.${index}.title`)}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="حذف این ردیف"
                      onClick={() => remove(index)}
                    >
                      <Trash size={18} />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NativeSelect
                    aria-label="نوع درآمد"
                    {...register(`sources.${index}.type`)}
                  >
                    {INCOME_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    aria-label="تناوب"
                    {...register(`sources.${index}.frequency`)}
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <AmountInput
                  aria-label="مبلغ"
                  currency={currency}
                  placeholder="0"
                  {...register(`sources.${index}.amount`)}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({ title: "", type: "other", amount: "", frequency: "monthly" })
              }
            >
              <Plus size={16} />
              منبع درآمد دیگر
            </Button>
          </div>
        </div>
      </StepShell>
    </form>
  );
}
