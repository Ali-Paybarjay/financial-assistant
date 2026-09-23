"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/bottom-sheet";
import { useIsGuest } from "@/components/guest/guest-provider";
import { logout } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

/**
 * Signing out, written once for the three places that offer it: the hub, the
 * row in settings, and the way out of onboarding.
 *
 * The cache clear is the half that is easy to leave out and impossible to see
 * missing — React Query still holds the previous account's numbers in memory,
 * and on a shared device the next person to sign in would be shown them.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const signOut = () =>
    startTransition(() => {
      queryClient.clear();
      return logout();
    });

  return { signOut, isPending };
}

/**
 * The confirmation a guest gets, and only a guest: signing out of a real
 * account is undone by signing back in, while signing out of an anonymous one
 * takes the data with it. So it is asked the same way deleting an account is,
 * and it leads with the way to avoid the loss rather than with the loss.
 */
export function GuestSignOutSheet({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="با خروج، همه‌چیز پاک می‌شود"
      description="تراکنش‌ها، حساب‌ها، هدف‌ها و دنگ‌هایت حذف می‌شوند و برگشتی در کار نیست."
    >
      <div className="flex flex-col gap-2">
        <Button asChild size="lg" className="w-full">
          <Link href="/save-account">اول حساب بسازم</Link>
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="flex-1"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            بیخیال
          </Button>
          <Button
            type="button"
            size="lg"
            variant="destructive"
            className="flex-1"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "دارم پاک می‌کنم…" : "خروج و حذف"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/**
 * The way out, from anywhere.
 *
 * It used to be in exactly two places — the hub and a row near the bottom of
 * settings — which meant leaving took a trip to a particular page from
 * wherever you happened to be. The shell is on every signed-in screen, so
 * this sits in it: beside the workspace switch on a phone, and in the
 * sidebar's footer on a desktop.
 *
 * A guest still gets the confirmation, and still gets it here: making the
 * exit easier to reach must not make it easier to lose everything by
 * accident.
 */
export function SignOutButton({ className }: { className?: string }) {
  const isGuest = useIsGuest();
  const [confirming, setConfirming] = useState(false);
  const { signOut, isPending } = useSignOut();

  return (
    <>
      <button
        type="button"
        aria-label="خروج"
        title="خروج"
        disabled={isPending}
        onClick={() => (isGuest ? setConfirming(true) : signOut())}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-action-tint hover:text-action disabled:opacity-50",
          className,
        )}
      >
        <SignOut size={18} />
      </button>

      <GuestSignOutSheet
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        isPending={isPending}
        onConfirm={signOut}
      />
    </>
  );
}

/**
 * The way out of the hub.
 *
 * The hub is the one signed-in screen the shell gives no nav at all — see
 * <AppShell> for why — which also left it the one screen with no route to
 * settings, and so no way to sign out without first entering a workspace you
 * had not come here for. On the screen that exists to be the place you stand
 * between the two sides of the app, that made leaving the longest trip in it.
 */
export function HubSignOutButton() {
  const isGuest = useIsGuest();
  const [confirming, setConfirming] = useState(false);
  const { signOut, isPending } = useSignOut();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => (isGuest ? setConfirming(true) : signOut())}
      >
        <SignOut size={16} />
        {isPending ? "دارم خارجت می‌کنم…" : "خروج"}
      </Button>

      <GuestSignOutSheet
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        isPending={isPending}
        onConfirm={signOut}
      />
    </>
  );
}
