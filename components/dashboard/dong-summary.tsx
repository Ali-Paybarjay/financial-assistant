"use client";

import Link from "next/link";
import { CaretLeft, Plus, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { faNumber } from "@/lib/format";
import { standing } from "@/lib/dong";
import type { DongDashboardGroup } from "@/lib/queries/dong";

/**
 * «دنگ و دونگ» on the dashboard, and the only way into it on a phone: the tab
 * bar holds four items by design and the sidebar carrying the rest starts at
 * 960px, which left the feature buried under Settings.
 *
 * It renders with nothing in it too — an entry point that appears only once
 * you have found the thing it leads to is not an entry point — and it is given
 * the same weight as the cards around it, because a one-line dashed strip
 * reads as a footnote rather than as a part of the app.
 *
 * Nothing is summed across groups: each carries its own currency and this app
 * converts nothing, so one total would be adding tomans to euros.
 */
export function DongSummary({ groups }: { groups: DongDashboardGroup[] }) {
  if (groups.length === 0) return <DongInvitation />;

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface">
      <Link
        href="/dong"
        className="flex items-center gap-3 border-b border-hairline p-4 hover:bg-paper"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lapis-tint text-lapis">
          <UsersThree size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold text-ink">دنگ و دونگ</span>
          <span className="text-caption text-ink-muted">
            {faNumber(groups.length)} دوره‌ی باز
          </span>
        </span>
        <CaretLeft size={16} className="shrink-0 text-ink-faint" />
      </Link>

      {/* Three at most, so the card keeps its shape whether there is one group
          or nine; the page itself has the rest. */}
      <ul>
        {groups.slice(0, 3).map((group) => (
          <li key={group.id} className="border-b border-hairline last:border-b-0">
            <Link
              href={`/dong/${group.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-paper"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-medium text-ink">
                  {group.title}
                </span>
                <span className="text-caption text-ink-muted">
                  {faNumber(group.memberCount)} نفر
                </span>
              </span>

              {group.net === null ? (
                <span className="text-caption text-ink-faint">—</span>
              ) : (
                <span className="flex shrink-0 flex-col items-end">
                  <Money
                    minor={group.net}
                    currency={group.currency}
                    size="row"
                    signed
                    tone={group.net === 0 ? "none" : "auto"}
                  />
                  <span className="mt-0.5 text-micro text-ink-muted">
                    {standing(group.net) === "owed"
                      ? "طلبکاری"
                      : standing(group.net) === "owes"
                        ? "بدهکاری"
                        : "صاف"}
                  </span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {groups.length > 3 && (
        <Link
          href="/dong"
          className="block px-4 py-2.5 text-caption font-medium text-lapis hover:bg-paper"
        >
          و {faNumber(groups.length - 3)} دوره‌ی دیگر
        </Link>
      )}
    </section>
  );
}

/** What the card is before the first group exists. */
function DongInvitation() {
  return (
    <section className="rounded-card border border-hairline bg-surface p-5">
      <span className="flex size-11 items-center justify-center rounded-full bg-lapis-tint text-lapis">
        <UsersThree size={22} />
      </span>

      <h2 className="mt-3 text-[17px] font-semibold text-ink">دنگ و دونگ</h2>
      <p className="mt-1.5 text-body text-ink-muted">
        سفر، دورهمی، خانه‌ی مشترک — هر خرید را با اسم کسی که پولش را داده ثبت کن.
        آخرش خودش می‌گوید هرکس به چه کسی چقدر بدهکار است، با کمترین تعداد پرداخت.
      </p>

      <Button asChild size="lg" variant="outline" className="mt-4 w-full">
        <Link href="/dong">
          <Plus size={18} />
          ساختن اولین دوره
        </Link>
      </Button>
    </section>
  );
}
