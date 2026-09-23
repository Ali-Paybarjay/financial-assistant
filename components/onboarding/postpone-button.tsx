"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { postponeOnboarding } from "@/app/onboarding/actions";

/**
 * The way out of the flow that keeps the account: into the app now, the rest
 * from settings whenever. On every step after the name — the name is the one
 * answer the app cannot address anyone without, and step 1 collects it before
 * offering the same door.
 */
export function PostponeButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="link"
      disabled={isPending}
      onClick={() => startTransition(() => postponeOnboarding())}
    >
      {isPending ? "دارم می‌برمت به برنامه…" : "بقیه را بعداً از تنظیمات کامل می‌کنم"}
    </Button>
  );
}
