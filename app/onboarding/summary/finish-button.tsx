"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { finishOnboarding } from "../actions";

export function FinishButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      disabled={isPending}
      onClick={() => startTransition(() => finishOnboarding())}
    >
      {isPending ? "دارم آماده می‌کنم…" : "برو به داشبورد"}
    </Button>
  );
}
