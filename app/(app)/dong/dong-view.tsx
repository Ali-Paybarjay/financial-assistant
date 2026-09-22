"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretLeft, Plus, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { PageSheet } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import type { AccountRow } from "@/lib/supabase/database.types";
import type { DongGroupWithTotals } from "@/lib/queries/dong";
import { GroupSheet } from "./group-sheet";

export function DongView({
  groups,
  accounts,
  defaultAccountId,
  defaultCurrency,
  today,
}: {
  groups: DongGroupWithTotals[];
  accounts: AccountRow[];
  defaultAccountId: string | null;
  defaultCurrency: CurrencyCode;
  today: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const open = groups.filter((group) => !group.settled_at);
  const done = groups.filter((group) => group.settled_at);

  return (
    <PageSheet className="px-4 py-4 min-[960px]:px-7 min-[960px]:py-6">
      <header className="mb-4">
        <h1 className="text-title font-semibold text-ink">دنگ و دونگ</h1>
        <p className="mt-1 text-caption text-ink-muted">
          سفر، دورهمی، خانه‌ی مشترک — هر خرید را با اسم کسی که پولش را داده ثبت کن؛
          آخرش خودش می‌گوید هرکس به چه کسی چقدر بدهکار است.
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-well border border-dashed border-hairline-strong/45 bg-surface px-4 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-paper text-ink-faint">
            <UsersThree size={24} />
          </span>
          <p className="text-body text-ink">هنوز دوره‌ای نساخته‌ای.</p>
          <p className="max-w-[42ch] text-caption text-ink-muted">
            یک دوره بساز — مثل «سفر شمال» — آدم‌هایش را اضافه کن، و از آن به بعد فقط
            خریدها را وارد کن. حساب و کتاب آخرش با خودش است.
          </p>
          <Button size="lg" onClick={() => setSheetOpen(true)}>
            <Plus size={18} />
            اولین دوره را بساز
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-hidden">
            {open.map((group) => (
              <GroupRow key={group.id} group={group} />
            ))}
            {open.length === 0 && (
              <p className="px-4 py-6 text-center text-caption text-ink-muted">
                همه‌ی دوره‌ها بسته شده‌اند.
              </p>
            )}
          </div>

          {done.length > 0 && (
            <>
              <h2 className="mt-5 mb-2 text-label font-medium text-ink-muted">
                دوره‌های بسته‌شده
              </h2>
              <div className="overflow-hidden">
                {done.map((group) => (
                  <GroupRow key={group.id} group={group} />
                ))}
              </div>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-4 w-full"
            onClick={() => setSheetOpen(true)}
          >
            <Plus size={18} />
            افزودن دوره
          </Button>
        </>
      )}

      <GroupSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        group={null}
        accounts={accounts}
        defaultCurrency={defaultCurrency}
        defaultAccountId={defaultAccountId}
        today={today}
      />
    </PageSheet>
  );
}

function GroupRow({ group }: { group: DongGroupWithTotals }) {
  return (
    <Link
      href={`/dong/${group.id}`}
      className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0 hover:bg-paper"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium text-ink">{group.title}</span>
        <span className="mt-0.5 truncate text-caption text-ink-muted">
          {faNumber(group.memberCount)} نفر ·{" "}
          {group.expenseCount === 0
            ? "بدون خرید"
            : `${faNumber(group.expenseCount)} خرید`}{" "}
          · {formatDateFa(group.lastActivityOn ?? group.started_on)}
        </span>
      </span>

      <Money minor={group.totalSpent} currency={group.currency} size="row" />
      <CaretLeft size={16} className="shrink-0 text-ink-faint" />
    </Link>
  );
}
