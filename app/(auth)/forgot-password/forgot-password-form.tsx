"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/field";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordInput) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if ("error" in result) setFormError(result.error);
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-display-l font-bold text-ink">فرستادم</h1>
        <p className="text-body text-ink-muted">
          اگر حسابی با این ایمیل باشد، لینک بازیابی رمز به آن رسیده. رویش بزن تا
          رمز تازه بگذاری.
        </p>
        <Link href="/login" className="text-caption font-medium text-lapis hover:underline">
          برگرد به ورود
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-display-l font-bold text-ink">بازیابی رمز</h1>
        <p className="mt-1 text-body text-ink-muted">
          ایمیلت را بنویس تا لینک ساختن رمز تازه را برایت بفرستم.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

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

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "دارم می‌فرستم…" : "لینک را بفرست"}
        </Button>
      </form>

      <Link href="/login" className="text-caption font-medium text-lapis hover:underline">
        برگرد به ورود
      </Link>
    </div>
  );
}
