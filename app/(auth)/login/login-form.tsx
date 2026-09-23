"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/field";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { continueAsGuest, login, signInWithGoogle } from "../actions";

/**
 * Two doors for people who have decided — Google, and email for as long as
 * `showPassword` says so — and one below them for people who have not.
 *
 * With email switched off (lib/auth-methods.ts) Google is the only real door,
 * so it takes the primary style the password button used to have, and the
 * sign-up and forgot-password links leave with the form they belonged to.
 */
export function LoginForm({ showPassword }: { showPassword: boolean }) {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isGuestPending, startGuestTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginInput) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await login(values);
      if (result && "error" in result) setFormError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-question font-bold text-ink">خوش آمدی</h1>
        <p className="mt-1 text-body text-ink-muted">
          {showPassword ? "وارد شو تا ادامه بدهیم." : "با گوگل وارد شو تا ادامه بدهیم."}
        </p>
      </div>

      {/* One place for every door's failure, so a Google refusal has somewhere
          to land when the password form is not on the page. */}
      <FormError>{formError}</FormError>

      {showPassword && (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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

            <Field label="رمز" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
            </Field>

            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "دارم واردت می‌کنم…" : "ورود"}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-caption text-ink-muted">یا</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
        </>
      )}

      <form
        action={() => {
          startGoogleTransition(async () => {
            const result = await signInWithGoogle();
            if (result && "error" in result) setFormError(result.error);
          });
        }}
      >
        <Button
          type="submit"
          variant={showPassword ? "outline" : "default"}
          size="lg"
          className="w-full"
          disabled={isGooglePending}
        >
          {isGooglePending ? "دارم می‌برمت به گوگل…" : "ورود با گوگل"}
        </Button>
      </form>

      {/* Below Google, not beside it: this is the door for someone who has not
          decided yet, and it should not compete with the doors for people who
          have. The line under it is the whole bargain, said before the tap
          rather than after — nobody should discover the terms from inside. */}
      <form
        action={() => {
          startGuestTransition(async () => {
            const result = await continueAsGuest();
            if (result && "error" in result) setFormError(result.error);
          });
        }}
        className="flex flex-col gap-1.5"
      >
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={isGuestPending}
        >
          {isGuestPending ? "دارم واردت می‌کنم…" : "ورود به‌عنوان مهمان"}
        </Button>
        <p className="text-center text-caption text-ink-muted">
          بدون ایمیل و بدون ثبت‌نام؛ اطلاعاتت ذخیره نمی‌ماند.
        </p>
      </form>

      {showPassword && (
        <div className="flex flex-col gap-2 text-caption text-ink-muted">
          <Link href="/forgot-password" className="text-action hover:underline">
            رمزت را فراموش کرده‌ای؟
          </Link>
          <p>
            حساب نداری؟{" "}
            <Link href="/signup" className="font-medium text-action hover:underline">
              بساز
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
