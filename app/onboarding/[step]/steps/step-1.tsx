"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Field, FormError } from "@/components/field";
import { StepShell, SaveReassurance } from "@/components/onboarding/step-shell";
import { CURRENCIES } from "@/lib/money";
import {
  COUNTRIES,
  CURRENCY_LABELS,
  EMPLOYMENT_OPTIONS,
  type StepMeta,
} from "@/lib/onboarding/config";
import { step1Schema, type Step1Input } from "@/lib/validation/onboarding";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { saveStep1 } from "../../actions";

/** The timezone is read from the browser at submit time, so it is not part of
 *  what the form itself validates. The server still checks the full schema. */
const clientSchema = step1Schema.omit({ timezone: true });
type ClientInput = Omit<Step1Input, "timezone">;

export function Step1({ meta, profile }: { meta: StepMeta; profile: ProfileRow }) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: profile.full_name ?? "",
      countryCode: (profile.country_code as ClientInput["countryCode"]) ?? "CA",
      baseCurrency: (profile.base_currency as ClientInput["baseCurrency"]) ?? "CAD",
      birthYear: profile.birth_year ?? undefined,
      employmentStatus:
        (profile.employment_status as ClientInput["employmentStatus"]) ?? "employed",
    },
  });

  function onSubmit(values: ClientInput) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveStep1({
        ...values,
        // The browser knows the timezone; asking the user for it would be a
        // question with no good answer.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
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
        <div className="flex flex-col gap-4">
          <FormError>{formError}</FormError>

          <Field label="نام" htmlFor="fullName" error={errors.fullName?.message}>
            <Input id="fullName" autoComplete="name" {...register("fullName")} />
          </Field>

          <Field
            label="کشور محل زندگی"
            htmlFor="countryCode"
            error={errors.countryCode?.message}
          >
            <NativeSelect
              id="countryCode"
              {...register("countryCode", {
                onChange: (event) => {
                  // Picking a country is almost always picking its currency.
                  const country = COUNTRIES.find((c) => c.code === event.target.value);
                  if (country) {
                    setValue("baseCurrency", country.currency as Step1Input["baseCurrency"]);
                  }
                },
              })}
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="ارز پایه"
            htmlFor="baseCurrency"
            hint="در این نسخه همه‌ی مبلغ‌ها با همین ارز ثبت می‌شوند."
            error={errors.baseCurrency?.message}
          >
            <NativeSelect id="baseCurrency" {...register("baseCurrency")}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_LABELS[code]} ({code})
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="سال تولد" htmlFor="birthYear" error={errors.birthYear?.message}>
            <Input
              id="birthYear"
              dir="ltr"
              inputMode="numeric"
              placeholder="1990"
              className="tabular-nums"
              {...register("birthYear", { valueAsNumber: true })}
            />
          </Field>

          <Field
            label="وضعیت اشتغال"
            htmlFor="employmentStatus"
            error={errors.employmentStatus?.message}
          >
            <NativeSelect id="employmentStatus" {...register("employmentStatus")}>
              {EMPLOYMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </StepShell>
    </form>
  );
}
