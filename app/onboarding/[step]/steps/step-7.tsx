"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/amount-input";
import { NativeSelect } from "@/components/native-select";
import { Field, FormError } from "@/components/field";
import { StepShell } from "@/components/onboarding/step-shell";
import { OptionCard } from "@/components/onboarding/option-card";
import { SkipButton } from "@/components/onboarding/skip-button";
import { formatMoney, toMinor, type CurrencyCode } from "@/lib/money";
import type { StepMeta } from "@/lib/onboarding/config";
import { faNumber, faPercent } from "@/lib/format";
import type { Step7Input } from "@/lib/validation/onboarding";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { saveStep7 } from "../../actions";

const EMERGENCY_FUND_CHOICES = [0, 1, 3, 6, 12];

export function Step7({
  meta,
  currency,
  profile,
}: {
  meta: StepMeta;
  currency: CurrencyCode;
  profile: ProfileRow;
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const { register, control, handleSubmit, watch } = useForm<Step7Input>({
    defaultValues: {
      hasDebt: profile.has_debt ?? false,
      debtAmount: profile.debt_amount
        ? formatMoney(profile.debt_amount, currency, { omitSymbol: true }).replace(/,/g, "")
        : "",
      emergencyFundMonths: profile.emergency_fund_months ?? 0,
      savingsRateEstimate: profile.savings_rate_estimate ?? 10,
    },
  });

  const hasDebt = watch("hasDebt");
  const savingsRate = watch("savingsRateEstimate");

  function onSubmit(values: Step7Input) {
    setFormError(undefined);
    if (values.hasDebt && values.debtAmount?.trim()) {
      try {
        toMinor(values.debtAmount, currency);
      } catch {
        setFormError("مبلغ بدهی عدد نیست. فقط رقم بنویس.");
        return;
      }
    }
    startTransition(async () => {
      const result = await saveStep7(values);
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
              {isPending ? "دارم ذخیره می‌کنم…" : "تمام"}
            </Button>
            <SkipButton step={meta.step} />
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <FormError>{formError}</FormError>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2 text-label font-medium text-ink-muted">
              بدهی داری؟
            </legend>
            <Controller
              control={control}
              name="hasDebt"
              render={({ field }) => (
                <>
                  <OptionCard
                    name="hasDebt"
                    value="no"
                    checked={field.value === false}
                    onSelect={() => field.onChange(false)}
                  >
                    نه
                  </OptionCard>
                  <OptionCard
                    name="hasDebt"
                    value="yes"
                    checked={field.value === true}
                    onSelect={() => field.onChange(true)}
                  >
                    بله
                  </OptionCard>
                </>
              )}
            />
          </fieldset>

          {hasDebt && (
            <Field label="مجموع بدهی" htmlFor="debtAmount">
              <AmountInput
                id="debtAmount"
                currency={currency}
                placeholder="0"
                {...register("debtAmount")}
              />
            </Field>
          )}

          <Field
            label="صندوق اضطراری‌ات چند ماه هزینه‌ات را پوشش می‌دهد؟"
            htmlFor="emergencyFundMonths"
          >
            <NativeSelect
              id="emergencyFundMonths"
              {...register("emergencyFundMonths", { valueAsNumber: true })}
            >
              {EMERGENCY_FUND_CHOICES.map((months) => (
                <option key={months} value={months}>
                  {months === 0 ? "هنوز ندارم" : `حدود ${faNumber(months)} ماه`}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="چند درصد درآمدت را پس‌انداز می‌کنی؟"
            htmlFor="savingsRateEstimate"
          >
            <div className="flex items-center gap-3">
              <input
                id="savingsRateEstimate"
                type="range"
                min={0}
                max={100}
                step={5}
                className="h-11 flex-1 accent-action"
                {...register("savingsRateEstimate", { valueAsNumber: true })}
              />
              <span className="min-w-14 text-center text-[16px] font-semibold text-ink">
                {faPercent(savingsRate)}
              </span>
            </div>
          </Field>
        </div>
      </StepShell>
    </form>
  );
}
