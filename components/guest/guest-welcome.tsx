"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/bottom-sheet";
import { useIsGuest } from "./guest-provider";

const SEEN_KEY = "guest-notice-seen";

/**
 * Said once, on the way in, before the guest has typed anything worth losing.
 *
 * It does not block: a wall in front of an app nobody has seen yet is a reason
 * to close the tab, and the banner underneath repeats the point on every screen
 * afterwards. What it must do is arrive *first*, because the alternative — the
 * user finds out after entering a month of spending — is the version of this
 * feature that makes people angry.
 *
 * Session storage, not a profile column: it is a fact about this visit, and a
 * guest who returns in a new tab has not been told anything yet.
 */
export function GuestWelcome() {
  const isGuest = useIsGuest();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isGuest) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private mode and locked-down browsers throw here. Showing the notice
      // again is a far smaller failure than not showing it at all.
    }
    setOpen(true);
  }, [isGuest]);

  if (!isGuest) return null;

  return (
    <BottomSheet open={open} onOpenChange={setOpen} title="به‌عنوان مهمان وارد شدی">
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink-muted">
          همه‌ی نرم‌افزار باز است و می‌توانی راحت امتحانش کنی. فقط این را بدان:
          اطلاعاتی که وارد می‌کنی موقتی است. وقتی از حساب مهمان خارج شوی پاک
          می‌شود و راهی برای برگشتن به آن نداری.
        </p>
        {/* The sentence that decides whether anyone ever makes an account: the
            upgrade is an update to this same user, so nothing they type before
            it is thrown away. If that were not true, asking them to sign up
            later would be asking them to start over. */}
        <p className="rounded-well bg-action-tint px-3 py-2.5 text-caption text-action">
          هر وقت خواستی اطلاعاتت بماند، حساب بساز — هر چیزی که تا آن لحظه وارد
          کرده‌ای سر جایش می‌ماند.
        </p>

        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" onClick={() => setOpen(false)}>
            باشه، شروع می‌کنم
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => {
              setOpen(false);
              router.push("/save-account");
            }}
          >
            همین حالا حساب می‌سازم
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
