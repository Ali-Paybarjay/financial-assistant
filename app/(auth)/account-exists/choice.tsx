"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { signInToExistingGoogleAccount } from "../actions";

/**
 * Two doors, and the one that loses something is behind a confirmation.
 *
 * Going into the old account means leaving the guest one, and this app purges
 * a guest whenever it is left — so the rows entered while trying it go with
 * it. That is said here in the same words and with the same weight as the
 * guest sign-out sheet says it, because it is the same loss; it would be a
 * strange promise that held everywhere except on the screen where the button
 * is easiest to press by mistake.
 *
 * Pressing it is still not the moment of loss: nothing is taken down until the
 * other account is really signed in, so backing out at Google’s own screen
 * brings the guest back untouched. The sheet agrees to a trade rather than
 * performing one, and its button says so.
 *
 * When there is nothing to lose — a guest who signed in five minutes ago and
 * entered nothing — the sheet is skipped. A confirmation that guards an empty
 * account teaches people to click through confirmations.
 */
export function AccountExistsChoice({
  guestData,
  returnError,
}: {
  guestData: { label: string; count: number }[];
  /** Set when a previous attempt came back from Google without finishing. */
  returnError?: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>(returnError);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasData = guestData.length > 0;
  const summary = guestData.map((entry) => `${entry.count} ${entry.label}`).join(" و ");

  const go = () =>
    startTransition(async () => {
      setError(undefined);
      queryClient.clear();
      const result = await signInToExistingGoogleAccount();
      if (result && "error" in result) {
        setConfirming(false);
        setError(result.error);
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <FormError>{error}</FormError>

      {hasData && (
        <p className="flex items-start gap-2 rounded-card bg-guess-tint px-3 py-2.5 text-caption text-guess-text">
          <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
          {summary} که به‌عنوان مهمان ثبت کرده‌ای به آن حساب منتقل نمی‌شود و با
          خروج پاک می‌شود. اگر لازمش داری، اول با ایمیل نگهش دار.
        </p>
      )}

      <Button
        type="button"
        size="lg"
        disabled={isPending}
        onClick={() => (hasData ? setConfirming(true) : go())}
      >
        {isPending ? "دارم می‌برمت به گوگل…" : "وارد حساب قبلی‌ام شو"}
      </Button>

      <Button asChild size="lg" variant="outline">
        <Link href="/save-account">
          {hasData ? "نه، همین اطلاعات را نگه دار" : "برگرد"}
        </Link>
      </Button>

      <BottomSheet
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title="اطلاعات مهمان پاک می‌شود"
        description={`به‌محض اینکه وارد حساب قبلی‌ات شوی، ${summary} که اینجا ثبت کرده‌ای حذف می‌شود و به آن حساب منتقل نمی‌شود. اگر وسط کار منصرف شوی، چیزی از دست نمی‌رود.`}
      >
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="w-full">
            <Link href="/save-account">اول این اطلاعات را نگه دارم</Link>
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={isPending}
              onClick={() => setConfirming(false)}
            >
              بیخیال
            </Button>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="flex-1"
              disabled={isPending}
              onClick={go}
            >
              {isPending ? "دارم می‌برمت…" : "ادامه بده"}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
