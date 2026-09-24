"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { StepShell } from "@/components/onboarding/step-shell";
import { SkipButton } from "@/components/onboarding/skip-button";
import { formatMoney, toMinor, type CurrencyCode } from "@/lib/money";
import { VARIABLE_BASELINE_SLUGS, type StepMeta } from "@/lib/onboarding/config";
import type { Step4Input } from "@/lib/validation/onboarding";
import type {
  CategoryRow,
  VariableExpenseBaselineRow,
} from "@/lib/supabase/database.types";
import { saveStep4 } from "../../actions";

export function Step4({
  meta,
  currency,
  categories,
  baselines,
}: {
  meta: StepMeta;
  currency: CurrencyCode;
  categories: CategoryRow[];
  baselines: VariableExpenseBaselineRow[];
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const tracked = VARIABLE_BASELINE_SLUGS.map((slug) =>
    categories.find((category) => category.slug === slug),
  ).filter((category): category is CategoryRow => Boolean(category));

  const existing = new Map(
    baselines.map((baseline) => [baseline.category_id, baseline.monthly_estimate]),
  );

  const { register, handleSubmit } = useForm<Step4Input>({
    defaultValues: {
      baselines: tracked.map((category) => ({
        categorySlug: category.slug,
        amount: existing.has(category.id)
          ? formatMoney(existing.get(category.id)!, currency, { omitSymbol: true }).replace(
              /,/g,
              "",
            )
          : "",
      })),
    },
  });

  function onSubmit(values: Step4Input) {
    setFormError(undefined);
    try {
      values.baselines
        .filter((baseline) => baseline.amount.trim() !== "")
        .forEach((baseline) => toMinor(baseline.amount, currency));
    } catch {
      setFormError("یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس.");
      return;
    }
    startTransition(async () => {
      const result = await saveStep4(values);
      if (result && "error" in result) setFormError(result.error);
    });
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
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
        <div className="flex flex-col gap-4">
          <FormError>{formError}</FormError>

          {tracked.map((category, index) => (
            <Field
              key={category.id}
              label={category.name_fa}
              htmlFor={`baseline-${category.slug}`}
            >
              <AmountInput
                id={`baseline-${category.slug}`}
                currency={currency}
                placeholder="0"
                {...register(`baselines.${index}.amount`)}
              />
              <input type="hidden" {...register(`baselines.${index}.categorySlug`)} />
            </Field>
          ))}

          <p className="text-caption text-ink-muted">
            این عددها تراکنش نمی‌سازند؛ فقط نقطه‌ی شروع مقایسه‌اند.
          </p>
        </div>
      </StepShell>
    </form>
  );
}
