"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CaretRight, EnvelopeSimple, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/field";
import { PASSWORD_MIN_LENGTH_FA, type SignupInput, signupSchema } from "@/lib/validation/auth";
import { linkGuestToGoogle, upgradeGuestAccount } from "../actions";

/**
 * Same three fields as signup, and deliberately not the same page. Signup reads
 * as "start over"; this has to read as "keep what you already have", because
 * that is what it actually does — the user id never changes, so the rows the
 * guest created stay theirs.
 */
export function SaveAccountForm() {
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();

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
      const result = await upgradeGuestAccount(values);
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
          فرستادم. تا رویش نزنی، حسابت هنوز مهمان حساب می‌شود — پس همین حالا بازش
          کن.
        </p>
        {/* Until the link is clicked the session is still anonymous, so the
            banner is still up and the purge still applies. Saying so here is
            cheaper than letting them discover it from the banner and assume the
            form failed. */}
        <p className="text-caption text-ink-muted">
          نگران اطلاعاتت نباش؛ سر جایشان هستند. رمزی که گذاشتی هم ثبت شد.
        </p>
        <Button asChild size="lg" variant="outline">
          <Link href="/">برگرد به نرم‌افزار</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-question font-bold text-ink">
          اطلاعاتت را نگه دار
        </h1>
        <p className="mt-1 text-body text-ink-muted">
          یک ایمیل و رمز بگذار تا حساب مهمانت دائمی شود.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-card bg-positive-tint px-3 py-2.5 text-caption text-positive">
        <ShieldCheck size={16} weight="fill" className="mt-0.5 shrink-0" />
        هر چیزی که تا اینجا وارد کرده‌ای — تراکنش‌ها، حساب‌ها، هدف‌ها و دنگ‌ها —
        همین‌جا می‌ماند. چیزی از نو شروع نمی‌شود.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "دارم حسابت را می‌سازم…" : "ساخت حساب"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-caption text-ink-muted">یا</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      {/* Links Google to the account that is already signed in rather than
          signing in with it. The difference is the whole page: signing in
          would mint a new user and leave every row this guest has entered
          behind on the old one. */}
      <form
        action={() => {
          setFormError(undefined);
          startGoogleTransition(async () => {
            const result = await linkGuestToGoogle();
            if (result && "error" in result) setFormError(result.error);
          });
        }}
      >
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={isGooglePending || isPending}
        >
          {isGooglePending ? "دارم می‌برمت به گوگل…" : "ادامه با گوگل"}
        </Button>
      </form>

      <Link
        href="/"
        className="flex items-center justify-center gap-1 text-caption text-ink-muted hover:text-action"
      >
        <CaretRight size={14} />
        فعلاً نه، برگرد به نرم‌افزار
      </Link>
    </div>
  );
}
