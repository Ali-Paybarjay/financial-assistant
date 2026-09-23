"use client";

import Link from "next/link";
import { Bank, CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { faNumber } from "@/lib/format";
import type { AccountRow } from "@/lib/supabase/database.types";

/**
 * The monthly nudge: "a new month started, check your accounts against the
 * bank".
 *
 * It lives in the app rather than arriving as a push notification, and that is
 * the point rather than a shortcut. The thing being asked for — find your
 * statement, upload it, look at what was missing — cannot be done from a
 * notification anyway; it can only be done here. A banner shown the moment the
 * user opens the app is the same reminder at the only moment it can be acted
 * on, and it costs no permission prompt, no service worker, and no scheduled
 * job that has to be right about time zones.
 *
 * It names the accounts rather than counting them: "خانه و پس‌انداز" is a
 * thing the user can picture, "۲ حساب" is a chore.
 */
export function ReconcileBanner({ due }: { due: AccountRow[] }) {
  if (due.length === 0) return null;

  const named = due.slice(0, 3).map((account) => account.title);
  const rest = due.length - named.length;

  const names =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join("، ")} و ${named[named.length - 1]}`;

  return (
    <Link
      href={due.length === 1 ? `/import?account=${due[0].id}` : "/accounts"}
      className="flex items-center gap-3 rounded-card border border-action/25 bg-action-tint p-3 transition-colors hover:border-action/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-action text-surface">
        <Bank size={18} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ink">
          ماه تازه شروع شده — وقتِ آپدیت حساب‌هاست
        </span>
        <span className="text-caption text-ink-muted">
          {names}
          {rest > 0 && ` و ${faNumber(rest)} حساب دیگر`} این ماه با بانک چک
          نشده‌اند. پرینت حساب را بده تا جاماندها را پیدا کنم.
        </span>
      </span>

      <CaretLeft size={16} className="shrink-0 text-action" />
    </Link>
  );
}
