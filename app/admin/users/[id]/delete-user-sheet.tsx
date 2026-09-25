"use client";

import { useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { faNumber } from "@/lib/format";
import { deleteUser } from "@/lib/admin/actions";

/**
 * Deleting somebody's account, with the numbers in front of the operator.
 *
 * The counts are shown *inside* the confirmation rather than only on the page
 * behind it. «This account has 318 transactions and 27 files» is the one fact
 * that changes whether this is routine or a mistake, and it has to be readable
 * at the moment of typing rather than a scroll away.
 *
 * The confirmation is the identifier itself — an address, or the id's first
 * octet for a guest who has none — matching what the user's own «delete my
 * account» asks for. A typed identifier cannot be produced by a stray tap.
 */
export function DeleteUserSheet({
  userId,
  email,
  expected,
  counts,
}: {
  userId: string;
  email: string | null;
  /** What has to be typed: the address, or the first eight of the id. */
  expected: string;
  counts: { transactions: number; media: number; accounts: number; goals: number };
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const hasContent =
    counts.transactions + counts.media + counts.accounts + counts.goals > 0;

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      // On success the action redirects, so nothing after this runs.
      const result = await deleteUser(userId, typed);
      if (result && "error" in result) setError(result.error);
    });
  };

  return (
    <>
      <div className="rounded-card border border-negative/25 bg-negative-tint p-4">
        <h2 className="text-section font-semibold text-negative">حذف این حساب</h2>
        <p className="mt-1 text-caption text-ink-muted">
          حساب، تراکنش‌ها، حساب‌های بانکی، هدف‌ها، دوره‌های دنگ و فایل‌های آپلودی
          پاک می‌شوند. برگشتی ندارد و در گزارش اقدام‌ها ثبت می‌شود.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          <Trash size={16} />
          حذف حساب
        </Button>
      </div>

      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setTyped("");
            setError(undefined);
          }
        }}
        title="مطمئنی؟"
        description={email ?? `مهمان ${expected}`}
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-well bg-paper px-3 py-2.5">
            {hasContent ? (
              <p className="text-caption text-ink">
                این حساب <b className="tabular-nums">{faNumber(counts.transactions)}</b>{" "}
                تراکنش، <b className="tabular-nums">{faNumber(counts.accounts)}</b> حساب
                بانکی و <b className="tabular-nums">{faNumber(counts.media)}</b> فایل دارد
                — خالی نیست.
              </p>
            ) : (
              <p className="text-caption text-ink-muted">
                این حساب خالی است: نه تراکنشی، نه حسابی، نه هدفی، نه فایلی.
              </p>
            )}
          </div>

          <Field
            label={email ? "برای تأیید، ایمیل کاربر را تایپ کن" : "هشت نویسهٔ اول شناسه را تایپ کن"}
            htmlFor="delete-confirm"
            error={error}
          >
            <Input
              id="delete-confirm"
              dir="ltr"
              autoComplete="off"
              value={typed}
              placeholder={expected}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>

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
              disabled={isPending || typed.trim() !== expected}
              onClick={submit}
            >
              {isPending ? "دارم پاک می‌کنم…" : "حذف کن"}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
