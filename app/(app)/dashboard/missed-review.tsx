"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, Warning } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/field";
import { Money } from "@/components/money";
import { formatMonthFa } from "@/lib/date";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import type { MissedRecurringRow } from "@/lib/supabase/database.types";
import {
  confirmMissedMonth,
  skipMissedMonth,
  stopRecurringBill,
} from "./missed-actions";

/**
 * The months the app could not fill in, asked one at a time.
 *
 * One question per screen and oldest first, because these are questions about
 * memory: «was June's rent paid?» is answerable, and a table of eleven
 * checkboxes is not. Going in order also means a bill you stopped paying is
 * reached at the month you stopped, which is the moment the second question
 * makes sense.
 *
 * Nothing is written until an answer is given, and every answer is a real
 * change to the data — including «no», which is why it is asked at all.
 */
export function MissedReview({
  missed,
  currency,
  open,
  onOpenChange,
}: {
  missed: MissedRecurringRow[];
  currency: CurrencyCode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [askingFuture, setAskingFuture] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current = missed[0];

  function run(action: () => Promise<{ error: string } | { ok: true }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setAskingFuture(false);
      router.refresh();
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setAskingFuture(false);
        onOpenChange(next);
      }}
      title="ماه‌های جامانده"
    >
      {!current ? (
        <p className="py-2 text-body text-ink-muted">
          چیزی برای بررسی نمانده. هر ماهی که اپ را باز کنی، هزینه‌های ثابتش خودش ساخته
          می‌شود.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <FormError>{error}</FormError>

          <p className="text-caption text-ink-muted">
            {faNumber(missed.length)} مورد مانده
          </p>

          <div className="rounded-card border border-hairline bg-paper p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                <ArrowsClockwise size={16} className="text-action" />
                {current.title}
              </span>
              <Money minor={current.amount} currency={currency} size="row" />
            </div>
            <p className="mt-1 text-caption text-ink-muted">
              {formatMonthFa(current.month)}
            </p>
          </div>

          {askingFuture ? (
            <>
              {/* The second question only exists because the first was
                  answered «no». A bill that went unpaid once is a gap; a bill
                  you have stopped paying is a wrong monthly total, every
                  month, until someone says so. */}
              <p className="text-body text-ink">
                این قبض را از این به بعد هم می‌دهی؟
              </p>
              <p className="-mt-2 text-caption text-ink-muted">
                اگر دیگر نمی‌دهی، از هزینه‌های ثابتت برداشته می‌شود و «آخر ماه چقدر
                برایت می‌ماند» بالا می‌رود.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    run(() => skipMissedMonth(current.recurring_expense_id, current.month))
                  }
                >
                  بله، فقط همین ماه نبود
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => run(() => stopRecurringBill(current.recurring_expense_id))}
                >
                  نه، دیگر نمی‌دهمش
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-body text-ink">
                این را در {formatMonthFa(current.month)} پرداخت کردی؟
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  disabled={isPending}
                  onClick={() =>
                    run(() =>
                      confirmMissedMonth(current.recurring_expense_id, current.month),
                    )
                  }
                >
                  {isPending ? "دارم ثبت می‌کنم…" : "بله، پرداخت شد"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setAskingFuture(true)}
                >
                  نه، پرداخت نشد
                </Button>
              </div>
              <p className="text-caption text-ink-muted">
                «بله» همان تراکنشی را می‌سازد که اول آن ماه ساخته می‌شد — با همان تاریخ،
                همان دسته و همان حساب.
              </p>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

/** The way in. Shown only while there is something to answer. */
export function MissedBanner({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-card border border-guess-border bg-guess-tint px-4 py-3 text-start hover:border-guess"
    >
      <Warning size={18} weight="fill" className="shrink-0 text-guess" />
      <span className="flex-1 text-caption text-guess-text">
        {faNumber(count)} هزینه‌ی ثابت از ماه‌های گذشته ساخته نشده، چون آن ماه‌ها اپ را
        باز نکرده‌ای. تا وقتی جواب ندهی، جمع آن ماه‌ها کمتر از واقعیت است.
      </span>
      <span className="shrink-0 text-caption font-semibold text-guess">بررسی</span>
    </button>
  );
}
