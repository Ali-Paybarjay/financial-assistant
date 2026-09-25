"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

/**
 * Says what happened and what to do — the same heading as the app's boundary,
 * because tests/e2e/smoke.spec.ts greps for that exact sentence to tell a page
 * that rendered from a page that threw. A different wording here would make
 * every admin route look healthy to the one gate that opens them.
 *
 * The hint is the panel's own: a report raising «admin only» is what a stale
 * token looks like once past the layout's check, and it is fixed by signing in
 * again rather than by retrying.
 */
export default function AdminError({
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
        دوباره بزن. اگر باز هم نشد، خارج شو و دوباره وارد شو — گزارش‌ها به توکن
        تازه نیاز دارند.
      </p>

      <Button size="lg" onClick={reset}>
        دوباره تلاش کن
      </Button>
    </div>
  );
}
