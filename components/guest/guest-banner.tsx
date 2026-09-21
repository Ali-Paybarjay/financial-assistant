"use client";

import Link from "next/link";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { useIsGuest } from "./guest-provider";

/**
 * The standing reminder, on every screen a guest can reach.
 *
 * The one-time notice at sign-in is the honest thing to do; this is the thing
 * that works. People dismiss a modal to get to the app and have forgotten it by
 * the third transaction they type in, and the moment they find out otherwise
 * must not be the moment their data goes. It uses the same amber the app
 * already uses for a figure it guessed rather than knows — the meaning is the
 * same, this is provisional.
 */
export function GuestBanner() {
  const isGuest = useIsGuest();
  if (!isGuest) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-guess-border bg-guess-tint px-4 py-2 text-caption text-guess-text">
      <Warning size={15} weight="fill" className="shrink-0 text-guess" />
      <p className="min-w-0">
        مهمان هستی؛ اطلاعاتت ذخیره نمی‌ماند.{" "}
        <Link
          href="/save-account"
          className="font-semibold text-guess-text underline underline-offset-2 hover:text-ink"
        >
          حساب بساز
        </Link>
      </p>
    </div>
  );
}
