"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

/** Says what happened and what to do. No apology, no error code the user
 *  cannot act on. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-start gap-4 p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-negative-tint">
        <WarningCircle size={24} className="text-negative" />
      </span>

      <h1 className="font-display text-question font-bold text-ink">
        این صفحه بالا نیامد
      </h1>
      <p className="text-body text-ink-muted">
        داده‌هایت جایشان امن است. دوباره بزن؛ اگر باز هم نشد، چند دقیقه بعد
        امتحان کن.
      </p>

      <Button size="lg" onClick={reset}>
        دوباره تلاش کن
      </Button>
    </div>
  );
}
