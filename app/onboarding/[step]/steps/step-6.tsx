"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/field";
import { StepShell } from "@/components/onboarding/step-shell";
import { OptionCard } from "@/components/onboarding/option-card";
import { SkipButton } from "@/components/onboarding/skip-button";
import { RISK_QUESTIONS, type StepMeta } from "@/lib/onboarding/config";
import { faNumber } from "@/lib/format";
import { saveStep6 } from "../../actions";

/** One question per screen, per the design: never a 15-field form. */
export function Step6({ meta }: { meta: StepMeta }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | undefined)[]>(
    Array.from({ length: RISK_QUESTIONS.length }),
  );
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const question = RISK_QUESTIONS[index];
  const selected = answers[index];
  const isLast = index === RISK_QUESTIONS.length - 1;

  function choose(value: string) {
    setAnswers((current) => {
      const next = [...current];
      next[index] = Number(value);
      return next;
    });
  }

  function advance() {
    if (selected === undefined) return;
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveStep6({ answers });
      if (result && "error" in result) setFormError(result.error);
    });
  }

  return (
    <StepShell
      step={meta.step}
      kicker={`${meta.kicker} · سؤال ${faNumber(index + 1)} از ${faNumber(RISK_QUESTIONS.length)}`}
      title={question.prompt}
      subtitle={meta.subtitle}
      footer={
        <>
          <Button
            type="button"
            size="lg"
            onClick={advance}
            disabled={selected === undefined || isPending}
          >
            {isPending ? "دارم ذخیره می‌کنم…" : isLast ? "تمام" : "سؤال بعدی"}
          </Button>
          {index === 0 ? (
            <SkipButton step={meta.step} />
          ) : (
            <Button type="button" variant="ghost" onClick={() => setIndex(index - 1)}>
              سؤال قبلی
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <FormError>{formError}</FormError>
        {question.options.map((option, optionIndex) => (
          <OptionCard
            key={option}
            name={question.id}
            value={String(optionIndex + 1)}
            checked={selected === optionIndex + 1}
            onSelect={choose}
          >
            {option}
          </OptionCard>
        ))}
      </div>
    </StepShell>
  );
}
