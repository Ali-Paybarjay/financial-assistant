"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/field";
import { Money } from "@/components/money";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import type {
  CategoryRow,
  StatementImportRow,
  StatementLineRow,
} from "@/lib/supabase/database.types";
import {
  draftFor,
  MatchedLineRow,
  StatementLineRowItem,
  type LineDraft,
} from "./statement-line-row";
import {
  applyStatementImport,
  discardStatementImport,
} from "@/app/(app)/import/actions";

/**
 * The report.
 *
 * It shows the rows that are already recorded as well as the ones that are
 * not. Reconciliation can be wrong in both directions, and only one of those
 * is visible by itself: a row wrongly called new sits in the list where the
 * user can untick it, while a row wrongly called already-recorded would
 * disappear in silence. So both are on screen, and both can be overridden.
 */
export function StatementReport({
  statementImport,
  lines,
  categories,
  currency,
  onApplied,
}: {
  statementImport: StatementImportRow;
  lines: StatementLineRow[];
  categories: CategoryRow[];
  currency: CurrencyCode;
  onApplied: (result: { imported: number; skipped: number }) => void;
}) {
  const router = useRouter();

  const fresh = useMemo(
    () => lines.filter((line) => line.match_status === "new"),
    [lines],
  );
  const matched = useMemo(
    () => lines.filter((line) => line.match_status === "matched"),
    [lines],
  );

  const [drafts, setDrafts] = useState<Map<number, LineDraft>>(
    () => new Map(fresh.map((line) => [line.row_index, draftFor(line, categories)])),
  );
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const selected = fresh.filter((line) => drafts.get(line.row_index)?.selected);

  const totals = selected.reduce(
    (sums, line) => {
      if (line.direction === "in") sums.income += line.amount;
      else sums.expense += line.amount;
      return sums;
    },
    { income: 0, expense: 0 },
  );

  function update(next: LineDraft) {
    setDrafts(new Map(drafts).set(next.rowIndex, next));
  }

  function setAllSelected(value: boolean) {
    const next = new Map(drafts);
    for (const [key, draft] of next) next.set(key, { ...draft, selected: value });
    setDrafts(next);
  }

  function apply() {
    startTransition(async () => {
      setError(undefined);

      const result = await applyStatementImport({
        importId: statementImport.id,
        lines: selected.map((line) => {
          const draft = drafts.get(line.row_index)!;
          return {
            rowIndex: draft.rowIndex,
            categorySlug: draft.categorySlug,
            merchant: draft.merchant,
            occurredOn: draft.occurredOn,
            // Ticking "I checked these" is an informed acceptance of every
            // category, which is exactly what confirming a field means.
            resolved: reviewed
              ? [...new Set([...draft.resolved, "category" as const])]
              : draft.resolved,
          };
        }),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      onApplied(result);
      router.refresh();
    });
  }

  function discard() {
    startTransition(async () => {
      await discardStatementImport(statementImport.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError>{error}</FormError>

      {statementImport.error_message && (
        <p className="flex items-start gap-2 rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
          <Warning size={16} className="mt-0.5 shrink-0" />
          {statementImport.error_message}
        </p>
      )}

      <section className="rounded-card border border-hairline bg-surface p-4">
        <h2 className="text-[17px] font-semibold text-ink">گزارش صورت‌حساب</h2>
        {statementImport.period_from && statementImport.period_to && (
          <p className="mt-1 text-caption text-ink-muted">
            از {formatDateFa(statementImport.period_from)} تا{" "}
            {formatDateFa(statementImport.period_to)}
          </p>
        )}

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <Tile label="ردیف خوانده‌شده" value={faNumber(lines.length)} />
          <Tile label="قبلاً ثبت شده" value={faNumber(matched.length)} />
          <Tile label="ثبت‌نشده" value={faNumber(fresh.length)} emphasis />
        </dl>

        {fresh.length > 0 && (
          <p className="mt-3 text-caption text-ink-muted">
            از این‌ها {faNumber(selected.length)} ردیف را انتخاب کرده‌ای:{" "}
            <Money minor={totals.income} currency={currency} className="text-[13px]" /> ورودی
            و{" "}
            <Money minor={totals.expense} currency={currency} className="text-[13px]" />{" "}
            خروجی.
          </p>
        )}
      </section>

      {fresh.length === 0 ? (
        <p className="flex items-start gap-2 rounded-control border border-positive/25 bg-positive-tint px-3 py-3 text-body font-medium text-positive">
          <CheckCircle size={20} className="mt-0.5 shrink-0" />
          همه‌ی ردیف‌های این صورت‌حساب از قبل ثبت شده بودند. چیزی برای اضافه‌کردن نیست.
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink">
              ثبت‌نشده‌ها ({faNumber(fresh.length)})
            </h3>
            <button
              type="button"
              onClick={() => setAllSelected(selected.length !== fresh.length)}
              className="text-caption font-medium text-lapis hover:underline"
            >
              {selected.length === fresh.length ? "هیچ‌کدام" : "همه"}
            </button>
          </div>

          <div className="overflow-hidden rounded-card border border-hairline bg-surface">
            {fresh.map((line) => (
              <StatementLineRowItem
                key={line.id}
                line={line}
                draft={drafts.get(line.row_index)!}
                categories={categories}
                currency={currency}
                onChange={update}
              />
            ))}
          </div>

          <label className="flex items-start gap-2.5 rounded-control border border-guess-border bg-guess-tint px-3 py-2.5">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
              className="mt-0.5 size-[18px] shrink-0 accent-[var(--color-guess)]"
            />
            <span className="text-caption font-medium text-guess-text">
              دسته‌ها را خودم نگاه کردم و درست‌اند.
              <span className="mt-0.5 block font-normal">
                دسته را از روی شرح بانک حدس زده‌ام. تا این را نزنی، این ردیف‌ها با خط‌چین
                «حدس زدم» ثبت می‌شوند تا بعداً یادت بماند سر بزنی.
              </span>
            </span>
          </label>
        </section>
      )}

      {matched.length > 0 && (
        <details className="overflow-hidden rounded-card border border-hairline bg-surface">
          <summary className="cursor-pointer px-3 py-2.5 text-caption font-medium text-ink-muted">
            {faNumber(matched.length)} ردیف که قبلاً ثبت شده بود
          </summary>
          <div className="border-t border-hairline">
            {matched.map((line) => (
              <MatchedLineRow key={line.id} line={line} currency={currency} />
            ))}
          </div>
          <p className="flex items-start gap-2 border-t border-hairline px-3 py-2.5 text-micro text-ink-faint">
            <Warning size={14} className="mt-0.5 shrink-0" />
            این‌ها را با مبلغ و جهت یکسان و تاریخ تا سه روز اختلاف پیدا کردم. اگر یکی از
            این‌ها واقعاً تراکنش جداگانه‌ای است، دستی ثبتش کن.
          </p>
        </details>
      )}

      <div className="flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          onClick={apply}
          disabled={isPending || selected.length === 0}
        >
          {isPending
            ? "دارم ثبت می‌کنم…"
            : selected.length === 0
              ? "ردیفی انتخاب نشده"
              : `ثبت ${faNumber(selected.length)} تراکنش`}
        </Button>
        <Button size="lg" variant="outline" onClick={discard} disabled={isPending}>
          بی‌خیال
        </Button>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-control bg-paper px-3 py-2.5">
      <dt className="text-micro text-ink-muted">{label}</dt>
      <dd
        className={
          emphasis
            ? "mt-0.5 text-[20px] font-semibold text-lapis"
            : "mt-0.5 text-[20px] font-semibold text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
