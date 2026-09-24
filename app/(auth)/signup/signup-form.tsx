"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/field";
import { useHydrated } from "@/components/use-hydrated";
import { PASSWORD_MIN_LENGTH_FA, type SignupInput, signupSchema } from "@/lib/validation/auth";
import { signup } from "../actions";

export function SignupForm() {
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  function onSubmit(values: SignupInput) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await signup(values);
      if ("error" in result) setFormError(result.error);
      else setSentTo(values.email);
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-action-tint">
          <EnvelopeSimple size={24} className="text-action" />
        </div>
        <h1 className="font-display text-question font-bold text-ink">ایمیلت را باز کن</h1>
        <p className="text-body text-ink-muted">
          یک لینک تأیید به{" "}
          <span dir="ltr" className="font-medium text-ink">
            {sentTo}
          </span>{" "}
          فرستادم. رویش بزن تا حسابت فعال شود.
        </p>
        <p className="text-caption text-ink-muted">
          نیامد؟ پوشه‌ی اسپم را ببین، یا چند دقیقه صبر کن و دوباره ثبت‌نام کن.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-question font-bold text-ink">حساب بساز</h1>
        <p className="mt-1 text-body text-ink-muted">
          چند ثانیه طول می‌کشد. بعدش تصویر مالی‌ات را با هم می‌سازیم.
        </p>
      </div>

      <form
        method="post"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormError>{formError}</FormError>

        <Field label="نام" htmlFor="fullName" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            {...register("fullName")}
          />
        </Field>

        <Field label="ایمیل" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field
          label="رمز"
          htmlFor="password"
          hint={`دست‌کم ${PASSWORD_MIN_LENGTH_FA} نویسه`}
          error={errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <Button type="submit" size="lg" disabled={isPending || !hydrated}>
          {isPending ? "دارم حسابت را می‌سازم…" : "ثبت‌نام"}
        </Button>
      </form>

      <p className="text-caption text-ink-muted">
        حساب داری؟{" "}
        <Link href="/login" className="font-medium text-action hover:underline">
          وارد شو
        </Link>
      </p>
    </div>
  );
}
