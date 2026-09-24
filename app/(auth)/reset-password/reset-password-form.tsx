"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/field";
import { useHydrated } from "@/components/use-hydrated";
import { PASSWORD_MIN_LENGTH_FA, type ResetPasswordInput, resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "../actions";

export function ResetPasswordForm() {
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  function onSubmit(values: ResetPasswordInput) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await resetPassword(values);
      if (result && "error" in result) setFormError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-question font-bold text-ink">رمز تازه</h1>
        <p className="mt-1 text-body text-ink-muted">
          یک رمز تازه بگذار تا واردت کنم.
        </p>
      </div>

      <form
        method="post"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormError>{formError}</FormError>

        <Field
          label="رمز تازه"
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
          {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره و ورود"}
        </Button>
      </form>
    </div>
  );
}
