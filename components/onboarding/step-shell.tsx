"use client";

import Link from "next/link";
import { CaretRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { TOTAL_STEPS } from "@/lib/onboarding/config";
import { ExitButton } from "@/components/onboarding/exit-button";
import { faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type StepShellProps = {
  step: number;
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function StepShell({
  step,
  kicker,
  title,
  subtitle,
  children,
  footer,
}: StepShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface px-4 pb-6 pt-4">
      <header className="flex items-center justify-between gap-2">
        {step > 1 ? (
          <Link
            href={`/onboarding/${step - 1}`}
            aria-label="گام قبلی"
            className="flex size-10 items-center justify-center rounded-control text-ink-muted hover:bg-lapis-tint hover:text-lapis"
          >
            {/* Back points right in an RTL reading order. */}
            <CaretRight size={20} />
          </Link>
        ) : (
          <span className="size-10" />
        )}
        <span className="flex-1 text-center text-label font-semibold text-ink-muted">
          گام {faNumber(step)} از {faNumber(TOTAL_STEPS)}
        </span>
        <ExitButton />
      </header>

      <div
        className="mt-3 flex gap-1"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={`گام ${faNumber(step)} از ${faNumber(TOTAL_STEPS)}`}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full",
              index < step ? "bg-lapis" : "bg-hairline",
            )}
          />
        ))}
      </div>

      <p className="mt-6 text-caption font-semibold tracking-[0.1em] text-lapis">
        {kicker}
      </p>
      <h1 className="mt-2 font-display text-display-l font-bold text-pretty text-ink">
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-body text-ink-muted">{subtitle}</p>}

      <div className="mt-6 flex-1">{children}</div>

      <div className="mt-8 flex flex-col gap-3">{footer}</div>
    </div>
  );
}

/** Stated on every step, because "I lost my progress" is the fear that makes
 *  people abandon a multi-step form. */
export function SaveReassurance() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-caption text-ink-muted">
      <CheckCircle size={16} className="text-positive" />
      هر گام را همان لحظه ذخیره می‌کنم؛ می‌توانی بعداً ادامه بدهی.
    </p>
  );
}
