"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  countryFromBrowser,
  currencyForCountry,
  isSupportedCountry,
  type CountryCode,
} from "@/lib/onboarding/geo";
import { step1Schema, type Step1Input } from "@/lib/validation/onboarding";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { saveStep1 } from "../../actions";

/** The timezone is read from the browser at submit time, so it is not part of
 *  what the form itself validates. The server still checks the full schema. */
const clientSchema = step1Schema.omit({ timezone: true });
type ClientInput = Omit<Step1Input, "timezone">;

export type Step1Prefill = {
  /** The name on the account they signed in with, if the provider sent one. */
  fullName: string | null;
  /** What the edge network made of their IP address. */
  countryCode: CountryCode | null;
};

export function Step1({
  meta,
  profile,
  prefill,
}: {
  meta: StepMeta;
  profile: ProfileRow;
  prefill: Step1Prefill;
}) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // country_code is written only by this step, so its presence is the one
  // reliable sign that the user has answered rather than been guessed at.
  const savedCountry = isSupportedCountry(profile.country_code)
    ? profile.country_code
    : null;
  const [countryIsGuess, setCountryIsGuess] = useState(savedCountry === null);

  const initialCountry = savedCountry ?? prefill.countryCode ?? "CA";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: profile.full_name?.trim() || prefill.fullName || "",
      countryCode: initialCountry,
      baseCurrency: savedCountry
        ? ((profile.base_currency as ClientInput["baseCurrency"]) ?? "CAD")
        : currencyForCountry(initialCountry),
      birthYear: profile.birth_year ?? undefined,
      employmentStatus:
        (profile.employment_status as ClientInput["employmentStatus"]) ?? "employed",
    },
  });

  // The browser's own clock is the better guess — a VPN moves the IP address
  // but not the timezone — and it only exists after mount, so the first paint
  // shows the edge network's answer and this corrects it a frame later.
  useEffect(() => {
    if (savedCountry) return;
    const guess = countryFromBrowser();
    if (!guess) return;
    setValue("countryCode", guess);
    setValue("baseCurrency", currencyForCountry(guess));
  }, [savedCountry, setValue]);

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
            note={countryIsGuess ? "حدس زدم" : undefined}
            error={errors.countryCode?.message}
          >
            <NativeSelect
              id="countryCode"
              className={countryIsGuess ? "border-dashed border-guess" : undefined}
              {...register("countryCode", {
                onChange: (event) => {
                  setCountryIsGuess(false);
                  // Picking a country is almost always picking its currency.
                  if (isSupportedCountry(event.target.value)) {
                    setValue("baseCurrency", currencyForCountry(event.target.value));
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
            note={countryIsGuess ? "از روی کشور" : undefined}
            hint="در این نسخه همه‌ی مبلغ‌ها با همین ارز ثبت می‌شوند."
            error={errors.baseCurrency?.message}
          >
            <NativeSelect
              id="baseCurrency"
              className={countryIsGuess ? "border-dashed border-guess" : undefined}
              {...register("baseCurrency", { onChange: () => setCountryIsGuess(false) })}
            >
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
