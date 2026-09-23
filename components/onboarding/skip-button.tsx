"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { skipStep } from "@/app/onboarding/actions";

/** Every step after the name. Postponing is a first-class answer, not a failure. */
export function SkipButton({ step }: { step: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={isPending}
      onClick={() => startTransition(() => skipStep(step))}
    >
      فعلاً رد کن
    </Button>
  );
}
