"use client";

import Link from "next/link";
import { CaretLeft, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import { standing } from "@/lib/dong";
import type { DongDashboardGroup } from "@/lib/queries/dong";

/**
 * «دنگ و دونگ» on the dashboard.
 *
 * This card is the only way into the feature on a phone: the tab bar holds
 * four items by design and the sidebar that carries the rest does not exist
 * below 960px, which left the whole thing buried under Settings. So it renders
 * even with nothing in it — an entry point that appears only once you have
 * already found the thing it leads to is not an entry point.
 *
 * No total across groups. Each group carries its own currency and this app
 * converts nothing, so a single summed figure would be adding tomans to euros.
 */
export function DongSummary({ groups }: { groups: DongDashboardGroup[] }) {
  if (groups.length === 0) {
    return (
      <Link
        href="/dong"
        className="flex items-center gap-3 rounded-card border border-dashed border-hairline-strong bg-surface px-4 py-3 hover:bg-paper"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lapis-tint text-lapis">
          <UsersThree size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-medium text-ink">دنگ و دونگ</span>
          <span className="truncate text-caption text-ink-muted">
            سفر یا دورهمی در پیش داری؟ خرج مشترک را اینجا تقسیم کن.
          </span>
        </span>
        <CaretLeft size={14} className="shrink-0 text-ink-faint" />
      </Link>
    );
  }

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface">
      <Link
        href="/dong"
        className="flex items-center justify-between gap-2 p-4 pb-2.5 hover:bg-paper"
      >
        <span className="flex items-center gap-2">
          <UsersThree size={18} className="text-lapis" />
          <h2 className="text-[15px] font-semibold text-ink">دنگ و دونگ</h2>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-caption text-ink-muted">
            {faNumber(groups.length)} دوره‌ی باز
          </span>
          <CaretLeft size={14} className="text-ink-faint" />
        </span>
      </Link>

      {/* Three at most, so the card keeps its shape whether the user has one
          group or nine; the page itself has the rest. */}
      <ul className="px-4 pb-3">
        {groups.slice(0, 3).map((group) => (
          <li
            key={group.id}
            className="flex items-baseline justify-between gap-2 border-t border-hairline py-2 first:border-t-0"
          >
            <Link
              href={`/dong/${group.id}`}
              className="min-w-0 flex-1 truncate text-caption text-ink-muted hover:text-lapis"
            >
              {group.title}
            </Link>

            {group.net === null ? (
              <span className="text-caption text-ink-faint">—</span>
            ) : (
              <span className="flex shrink-0 items-baseline gap-1.5">
                <span className="text-micro text-ink-muted">
                  {standing(group.net) === "owed"
                    ? "طلبکاری"
                    : standing(group.net) === "owes"
                      ? "بدهکاری"
                      : "صاف"}
                </span>
                <Money
                  minor={group.net}
                  currency={group.currency}
                  size="inherit"
                  signed
                  className={
                    group.net === 0
                      ? "text-[13px] font-medium text-ink"
                      : group.net < 0
                        ? "text-[13px] font-medium text-negative"
                        : "text-[13px] font-medium text-positive"
                  }
                />
              </span>
            )}
          </li>
        ))}
        {groups.length > 3 && (
          <li className="border-t border-hairline pt-2 text-caption text-ink-muted">
            و {faNumber(groups.length - 3)} دوره‌ی دیگر
          </li>
        )}
      </ul>
    </section>
  );
}
