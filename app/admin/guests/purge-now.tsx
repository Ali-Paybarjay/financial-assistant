"use client";

import { useState, useTransition } from "react";
import { Broom } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/bottom-sheet";
import { FormError } from "@/components/field";
import { faNumber } from "@/lib/format";
import { purgeStaleGuestsNow } from "@/lib/admin/actions";

/**
 * Runs the nightly sweep now.
 *
 * The confirmation names the number, because that number is the whole decision:
 * «purge stale guests» with nothing stale is a no-op worth no dialogue, and with
 * nine of them it is nine accounts going. Same code path as the cron — see
 * purgeStaleGuestsNow — so this cannot delete on a different rule than 03:17
 * does.
 */
export function PurgeNowButton({
  stale,
  retentionDays,
}: {
  stale: number;
  retentionDays: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await purgeStaleGuestsNow();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
      setOpen(false);
    });
  };

  return (
    <>
      <div className="rounded-card border border-hairline bg-surface p-4">
        <h2 className="text-section font-semibold text-ink">الان پاک کن</h2>
        <p className="mt-1 text-caption text-ink-muted">
          همان کاری که هر شب ۰۳:۱۷ انجام می‌شود، همین حالا: حساب‌های مهمانی که
          بیش از {faNumber(retentionDays)} روز برنگشته‌اند، و فایل‌هایشان. در گزارش
          اقدام‌ها ثبت می‌شود.
        </p>

        {done && (
          <p className="mt-3 rounded-control border border-positive/25 bg-positive-tint px-3 py-2 text-caption font-medium text-positive">
            انجام شد. نتیجه‌اش در فهرست جاروب‌ها است.
          </p>
        )}

        <Button
          type="button"
          variant={stale > 0 ? "destructive" : "outline"}
          className="mt-3"
          disabled={stale === 0}
          onClick={() => setOpen(true)}
        >
          <Broom size={16} />
          {stale === 0
            ? "چیزی برای پاک کردن نیست"
            : `${faNumber(stale)} مهمان کهنه را پاک کن`}
        </Button>
      </div>

      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(undefined);
        }}
        title={`${faNumber(stale)} حساب مهمان پاک می‌شود`}
        description="تراکنش‌ها و فایل‌هایشان هم می‌روند. برگشتی ندارد."
      >
        <div className="flex flex-col gap-3">
          <FormError>{error}</FormError>
          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              بیخیال
            </Button>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="flex-1"
              disabled={isPending}
              onClick={submit}
            >
              {isPending ? "دارم پاک می‌کنم…" : "پاک کن"}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
