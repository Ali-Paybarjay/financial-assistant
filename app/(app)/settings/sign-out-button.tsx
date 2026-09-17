"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { logout } from "@/app/(auth)/actions";

export function SignOutButton() {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          // Clear the client cache before the session goes, so the next account
          // to sign in on this device never sees the previous one's numbers.
          queryClient.clear();
          return logout();
        })
      }
      className="flex h-14 w-full items-center gap-3 px-4 text-start hover:bg-paper disabled:opacity-50"
    >
      <SignOut size={20} className="text-ink-muted" />
      <span className="flex-1 text-[14px] text-ink">
        {isPending ? "دارم خارجت می‌کنم…" : "خروج از حساب"}
      </span>
    </button>
  );
}
