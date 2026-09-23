"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretDown, X } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { faNumber, faPercent } from "@/lib/format";
import type { Insight, InsightPart } from "@/lib/insights";
import type { CurrencyCode } from "@/lib/money";
import { dismissInsight } from "@/app/(app)/dashboard/insight-actions";
import { cn } from "@/lib/utils";

/**
 * What the app worked out, on the board the figures came from.
 *
 * These had a tab of their own. It went, because the most visible thing on it
 * was an echo of what the composer had just recorded — «ثبت شد — بنزین £60» —
 * which the composer already says and the ledger already holds. Strip the
 * echo and a whole tab was left carrying a handful of sentences that are
 * about the board's own numbers, several days a month. They belong here.
 *
 * The first one is always open and the rest fold away. Stacking five cards
 * above the envelopes would push «چقدر مانده» below the fold, and answering
 * that in under five seconds is the measure the whole screen is built to.
 */
export function InsightList({
  insights,
  currency,
}: {
  insights: Insight[];
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState<string[]>([]);
  const [, startClosing] = useTransition();

  const visible = insights.filter((insight) => !closing.includes(insight.key));
  if (visible.length === 0) return null;

  const [first, ...rest] = visible;
  const shown = expanded ? visible : [first];

  function close(key: string) {
    setClosing((current) => [...current, key]);
    startClosing(async () => {
      await dismissInsight(key);
      router.refresh();
    });
  }

  return (
    <section aria-label="نکته‌ها" className="flex flex-col gap-2">
      {shown.map((insight) => (
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
              aria-label="بستن این نکته"
              onClick={() => close(insight.key)}
              className="-me-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>

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

      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex items-center justify-center gap-1.5 text-caption font-medium text-ink-muted hover:text-ink"
        >
          {expanded
            ? "کمترش کن"
            : `${faNumber(rest.length)} نکتهٔ دیگر`}
          <CaretDown
            size={13}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>
      )}
    </section>
  );
}

/**
 * An insight's sentence.
 *
 * The parts come from a pure module with no JSX in it, and the money ones are
 * rendered here through <Money> — the only path money takes in this app, and
 * the reason `lib/insights.ts` returns parts rather than a finished string.
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
