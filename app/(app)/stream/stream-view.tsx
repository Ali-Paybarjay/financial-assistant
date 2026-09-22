"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Receipt, X } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { faNumber, faPercent } from "@/lib/format";
import { formatDayMonthFa } from "@/lib/date";
import type { Insight, InsightPart } from "@/lib/insights";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryRow, TransactionRow } from "@/lib/supabase/database.types";
import { dismissInsight } from "./actions";
import { cn } from "@/lib/utils";

/**
 * The stream: what the app worked out, and what it is still unsure about.
 *
 * Three kinds of message and no more. An insight is something calculated; a
 * confirmation is something recorded; a guess is something recorded that the
 * app does not stand behind yet. They look different because they ask
 * different things of the reader — only the third one needs them to do
 * anything.
 *
 * An empty stream says «فعلاً چیزی نیست» and stops. There is no encouraging
 * message, because «everything looks fine» is not an insight and a page that
 * manufactures one teaches people to skim past the days it has something.
 */
export function StreamView({
  currency,
  today,
  insights,
  activity,
  categories,
  unconfirmedCount,
}: {
  currency: CurrencyCode;
  today: string;
  insights: Insight[];
  activity: TransactionRow[];
  categories: CategoryRow[];
  unconfirmedCount: number;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState<string[]>([]);
  const [, startClosing] = useTransition();

  const categoryById = new Map(categories.map((entry) => [entry.id, entry]));
  const visible = insights.filter((insight) => !closing.includes(insight.key));
  const unconfirmed = activity.filter((row) => !row.is_confirmed);
  const confirmed = activity.filter((row) => row.is_confirmed).slice(0, 8);
  const isEmpty =
    visible.length === 0 && unconfirmed.length === 0 && confirmed.length === 0;

  function close(key: string) {
    setClosing((current) => [...current, key]);
    startClosing(async () => {
      await dismissInsight(key);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[560px] min-[960px]:max-w-[1120px] min-[960px]:px-7 min-[960px]:py-6">
      <header className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3 min-[960px]:rounded-card min-[960px]:border">
        <h1 className="text-title font-semibold text-ink">جریان</h1>
        {unconfirmedCount > 0 && (
          <Link
            href="/transactions"
            className="flex items-center gap-1.5 rounded-full bg-guess-tint px-3 py-1.5 text-caption font-semibold text-guess-text"
          >
            <span
              aria-hidden
              className="h-0.5 w-3.5 shrink-0 border-t-2 border-dashed border-guess"
            />
            {faNumber(unconfirmedCount)} تأییدنشده
          </Link>
        )}
      </header>

      <div className="flex flex-col gap-3 p-4 min-[960px]:px-0">
        {isEmpty ? (
          <p className="rounded-card border border-hairline bg-surface p-6 text-center text-body text-ink-muted">
            فعلاً چیزی نیست.
          </p>
        ) : (
          <>
            <p className="text-center text-caption text-ink-faint">
              امروز، {formatDayMonthFa(today)}
            </p>

            {visible.map((insight) => (
              <article
                key={insight.key}
                className={cn(
                  "rounded-card px-3.5 py-3",
                  insight.tone === "warn"
                    ? "border border-guess-border bg-guess-tint"
                    : "bg-lapis-tint",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "flex-1 text-body",
                      insight.tone === "warn" ? "text-guess-text" : "text-ink",
                    )}
                  >
                    <Sentence parts={insight.parts} currency={currency} />
                  </p>
                  <button
                    type="button"
                    aria-label="بستن این پیام"
                    onClick={() => close(insight.key)}
                    className="-me-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* At most one action beside «بستن». A message offering four
                    things to do is a message nobody acts on. */}
                {insight.action && (
                  <Link
                    href={insight.action.href}
                    className="mt-2.5 inline-flex h-8 items-center rounded-full bg-surface px-3.5 text-caption font-semibold text-lapis"
                  >
                    {insight.action.label}
                  </Link>
                )}
              </article>
            ))}

            {/* What the app is not sure about. Brass and dashed, like every
                unconfirmed value in the product. */}
            {unconfirmed.map((row) => (
              <article
                key={row.id}
                className="rounded-card border border-guess-border bg-guess-tint px-3.5 py-3"
              >
                <div className="flex items-start gap-2">
                  <Receipt size={17} className="mt-0.5 shrink-0 text-guess" />
                  <p className="flex-1 text-body text-guess-text">
                    {sourceVerb(row)} {row.merchant ? `«${row.merchant}» ` : ""}را
                    خواندم ولی مبلغ <Money minor={row.amount} currency={currency} /> را
                    مطمئن نیستم.
                  </p>
                </div>
                <Link
                  href="/transactions"
                  className="mt-2.5 inline-flex h-8 items-center rounded-full bg-surface px-3.5 text-caption font-semibold text-lapis"
                >
                  بررسی کارت
                </Link>
              </article>
            ))}

            {/* What was recorded. No action: it is already done. */}
            {confirmed.map((row) => (
              <article
                key={row.id}
                className="flex items-start gap-2 rounded-card border border-hairline bg-surface px-3.5 py-3"
              >
                <CheckCircle size={17} className="mt-0.5 shrink-0 text-positive" />
                <p className="flex-1 text-body text-ink">
                  ثبت شد — <Money minor={row.amount} currency={currency} />
                  {row.category_id && categoryById.get(row.category_id) && (
                    <> در «{categoryById.get(row.category_id)?.name_fa}»</>
                  )}
                  .
                </p>
              </article>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * An insight's sentence.
 *
 * The parts come from a pure module that has no JSX in it, and the money ones
 * are rendered here through <Money> — which is the only path money takes in
 * this app, and the reason `lib/insights.ts` returns parts rather than a
 * finished string.
 */
function Sentence({
  parts,
  currency,
}: {
  parts: InsightPart[];
  currency: CurrencyCode;
}) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "money") {
          return (
            <Money
              key={index}
              minor={part.value}
              currency={currency}
              className="font-semibold"
            />
          );
        }
        if (part.kind === "percent") {
          return <span key={index}>{faPercent(part.value)}</span>;
        }
        return <span key={index}>{part.value}</span>;
      })}
    </>
  );
}

/** How the row arrived, in the words the message needs. */
function sourceVerb(row: TransactionRow): string {
  if (row.source === "receipt") return "عکس فاکتور";
  if (row.source === "statement") return "ردیف صورت‌حساب";
  return "متن";
}
