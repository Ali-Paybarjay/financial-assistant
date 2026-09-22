"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/field";
import { OptionCard } from "@/components/onboarding/option-card";
import { RISK_QUESTIONS } from "@/lib/onboarding/config";
import { faNumber } from "@/lib/format";
import { saveRiskAnswers } from "./actions";

/** The same five questions as onboarding step 6, reachable again from settings. */
export function RiskQuiz() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | undefined)[]>(
    Array.from({ length: RISK_QUESTIONS.length }),
  );
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const question = RISK_QUESTIONS[index];
  const selected = answers[index];
  const isLast = index === RISK_QUESTIONS.length - 1;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface px-4 pb-6 pt-4">
      <header className="flex items-center justify-between">
        <Link
          href="/settings"
          aria-label="بازگشت به تنظیمات"
          className="flex size-10 items-center justify-center rounded-control text-ink-muted hover:bg-lapis-tint hover:text-lapis"
        >
          <CaretRight size={20} />
        </Link>
        <span className="text-label font-semibold text-ink-muted">
          سؤال {faNumber(index + 1)} از {faNumber(RISK_QUESTIONS.length)}
        </span>
      </header>

      <p className="mt-6 text-caption font-semibold tracking-[0.1em] text-lapis">
        ریسک‌پذیری
      </p>
      <h1 className="mt-2 font-display text-display-l font-bold text-pretty text-ink">
        {question.prompt}
      </h1>
      <p className="mt-2 text-body text-ink-muted">
        جواب درست و غلط ندارد؛ فقط می‌خواهم بدانم با نوسان چطور کنار می‌آیی.
      </p>

      <div className="mt-6 flex flex-1 flex-col gap-2.5">
        <FormError>{error}</FormError>
        {question.options.map((option, optionIndex) => (
          <OptionCard
            key={option}
            name={question.id}
            value={String(optionIndex + 1)}
            checked={selected === optionIndex + 1}
            onSelect={(value) =>
              setAnswers((current) => {
                const next = [...current];
                next[index] = Number(value);
                return next;
              })
            }
          >
            {option}
          </OptionCard>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <Button
          size="lg"
          disabled={selected === undefined || isPending}
          onClick={() => {
            if (!isLast) {
              setIndex(index + 1);
              return;
            }
            setError(undefined);
            startTransition(async () => {
              const result = await saveRiskAnswers(answers);
              if (result && "error" in result) setError(result.error);
            });
          }}
        >
          {isPending ? "دارم ذخیره می‌کنم…" : isLast ? "ذخیره" : "سؤال بعدی"}
        </Button>
        {index > 0 && (
          <Button variant="ghost" onClick={() => setIndex(index - 1)}>
            سؤال قبلی
          </Button>
        )}
      </div>
    </div>
  );
}
