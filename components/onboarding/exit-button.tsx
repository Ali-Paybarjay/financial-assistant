"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/bottom-sheet";
import { useIsGuest } from "@/components/guest/guest-provider";
import { logout } from "@/app/(auth)/actions";

/**
 * On every onboarding screen, because a seven-step flow with no visible way out
 * is a trap: the only other exits are the browser's back button and force-
 * quitting the app. This ends the session, not the account — the answers
 * already given stay where they are, which is what the sheet promises.
 *
 * For a guest the promise is the opposite one, and the sheet says so. Leaving
 * really does delete their answers, because there is no email on the account to
 * sign back in with, so this is the last useful moment to offer them a way to
 * keep what they have entered.
 */
export function ExitButton() {
  const [open, setOpen] = useState(false);
  const isGuest = useIsGuest();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {/* Every step renders this inside its <form>, so the type matters: a
          button with no type submits. */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-10"
        onClick={() => setOpen(true)}
      >
        <SignOut size={16} />
        خروج
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={(next) => !next && setOpen(false)}
        title={isGuest ? "با خروج، اطلاعاتت پاک می‌شود" : "از ثبت‌نام بیرون بروی؟"}
        description={
          isGuest
            ? "مهمان هستی و ایمیلی روی حسابت نیست، پس راهی برای برگشتن نداری. هر چه تا اینجا زده‌ای حذف می‌شود."
            : "هر چه تا اینجا زده‌ای ذخیره شده. دفعه‌ی بعد که وارد شوی، از همین گام ادامه می‌دهی."
        }
      >
        <div className="flex flex-col gap-2">
          {isGuest && (
            <Button asChild size="lg" className="w-full">
              <Link href="/save-account">اول حساب بسازم</Link>
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              variant={isGuest ? "outline" : "default"}
              className="flex-1"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              ادامه‌ی ثبت‌نام
            </Button>
            <Button
              type="button"
              size="lg"
              variant={isGuest ? "destructive" : "outline"}
              className="flex-1"
              disabled={isPending}
              onClick={() =>
                startTransition(() => {
                  // Same rule as the sign-out row in settings: clear the client
                  // cache before the session goes, so the next account on this
                  // device never sees the previous one's numbers.
                  queryClient.clear();
                  return logout();
                })
              }
            >
              {isPending
                ? "دارم خارجت می‌کنم…"
                : isGuest
                  ? "خروج و حذف"
                  : "خروج از حساب"}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
