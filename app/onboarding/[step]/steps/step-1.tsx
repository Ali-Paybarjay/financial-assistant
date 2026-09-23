"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Field, FormError } from "@/components/field";
import { StepShell } from "@/components/onboarding/step-shell";
import { useOnboardingCompleted } from "@/components/onboarding/onboarding-provider";
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
import {
  step1FormSchema,
  type Step1FormInput,
  type Step1FormOutput,
} from "@/lib/validation/onboarding";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { saveStep1 } from "../../actions";

export type Step1Prefill = {
  /** The name on the account they signed in with, if the provider sent one. */
  fullName: string | null;
  /** What the edge network made of their IP address. */
  countryCode: CountryCode | null;
};

/**
 * The only step with a required answer, and the only one whose way out has to
 * go through the form: the app cannot address someone it has no name for, so
 * «بقیه را بعداً» saves this screen first and then opens the app.
 *
 * The timezone is read from the browser at submit time, so it is not part of
 * what the form itself validates. The server still checks the full schema.
 */
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
  const completed = useOnboardingCompleted();

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
  } = useForm<Step1FormInput, unknown, Step1FormOutput>({
    resolver: zodResolver(step1FormSchema),
    defaultValues: {
      fullName: profile.full_name?.trim() || prefill.fullName || "",
      countryCode: initialCountry,
      baseCurrency: savedCountry
        ? ((profile.base_currency as Step1FormInput["baseCurrency"]) ?? "CAD")
        : currencyForCountry(initialCountry),
      // The DOM hands these over as strings, and "" is what an untouched
      // optional field looks like; the form schema turns it into null.
      birthYear: profile.birth_year ?? "",
      employmentStatus: profile.employment_status ?? "",
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

  function submit(values: Step1FormOutput, finish: boolean) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveStep1(
        {
          ...values,
          // The browser knows the timezone; asking the user for it would be a
          // question with no good answer.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        { finish },
      );
      if (result && "error" in result) setFormError(result.error);
    });
  }

  // The way out from the very first screen. It goes through the same
  // validation as «ادامه», not around it — a missing name is the one thing it
  // must not let past. Someone back from settings already has the header's
  // way back and does not need a second one.
  const postpone = completed ? null : (
    <Button
      type="button"
      variant="ghost"
      disabled={isPending}
      onClick={handleSubmit((values) => submit(values, true))}
    >
      بقیه را بعداً کامل می‌کنم
    </Button>
  );

  return (
    <form onSubmit={handleSubmit((values) => submit(values, false))} noValidate>
      <StepShell
        step={meta.step}
        kicker={meta.kicker}
        title={meta.title}
        subtitle={meta.subtitle}
        footer={
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "دارم ذخیره می‌کنم…" : "ادامه"}
          </Button>
        }
        postpone={postpone}
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

          <Field
            label="سال تولد"
            htmlFor="birthYear"
            optional
            error={errors.birthYear?.message}
          >
            <Input
              id="birthYear"
              dir="ltr"
              inputMode="numeric"
              placeholder="1990"
              className="tabular-nums"
              {...register("birthYear")}
            />
          </Field>

          <Field
            label="وضعیت اشتغال"
            htmlFor="employmentStatus"
            optional
            error={errors.employmentStatus?.message}
          >
            <NativeSelect id="employmentStatus" {...register("employmentStatus")}>
              <option value="">بعداً می‌گویم</option>
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
