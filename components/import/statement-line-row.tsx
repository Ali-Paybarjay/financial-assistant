"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Money } from "@/components/money";
import { formatDateFa } from "@/lib/date";
import { FIELD_LABELS, type ReviewableField } from "@/lib/ai/schemas";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryRow, StatementLineRow } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/** What the user may change about a line before it is written. */
export type LineDraft = {
  rowIndex: number;
  selected: boolean;
  categorySlug: string;
  merchant: string | null;
  occurredOn: string;
  /** Fields the user has since corrected or accepted. */
  resolved: ReviewableField[];
};

export function draftFor(line: StatementLineRow, categories: CategoryRow[]): LineDraft {
  const category = categories.find((entry) => entry.id === line.category_id);
  return {
    rowIndex: line.row_index,
    // Everything new is taken by default. The user came here to import what is
    // missing, not to tick forty boxes.
    selected: true,
    categorySlug:
      category?.slug ?? (line.direction === "in" ? "other-income" : "misc"),
    merchant: line.merchant,
    occurredOn: line.occurred_on,
    resolved: [],
  };
}

/**
 * One row of the statement, in the review list.
 *
 * The bank's own wording is always on screen — it is the evidence the user
 * checks the app against — and the category sits under the signature dashed
 * rule until they touch it, because a category read off a bank description is
 * always an inference.
 */
export function StatementLineRowItem({
  line,
  draft,
  categories,
  currency,
  onChange,
}: {
  line: StatementLineRow;
  draft: LineDraft;
  categories: CategoryRow[];
  currency: CurrencyCode;
  onChange: (next: LineDraft) => void;
}) {
  const [editing, setEditing] = useState<"category" | "date" | "merchant" | null>(null);
  const category = categories.find((entry) => entry.slug === draft.categorySlug);
  const incoming = line.direction === "in";

  function resolve(field: ReviewableField, patch: Partial<LineDraft>) {
    onChange({
      ...draft,
      ...patch,
      resolved: draft.resolved.includes(field)
        ? draft.resolved
        : [...draft.resolved, field],
    });
  }

  function isGuess(field: ReviewableField): boolean {
    return line.needs_review.includes(field) && !draft.resolved.includes(field);
  }

  return (
    <div className="border-b border-hairline p-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={draft.selected}
          onChange={(event) => onChange({ ...draft, selected: event.target.checked })}
          aria-label={`ثبت ${line.description ?? "این ردیف"}`}
          className="mt-1 size-[18px] shrink-0 accent-[var(--color-lapis)]"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[15px] font-semibold text-ink">
              {draft.merchant || line.description || category?.name_fa || "تراکنش"}
            </span>
            <Money
              minor={incoming ? line.amount : -line.amount}
              currency={currency}
              tone="auto"
              signed
              className="shrink-0 text-[15px] font-semibold"
            />
          </div>

          {/* Verbatim, so the user can always see what the bank actually said. */}
          {line.description && (
            <p className="mt-1 truncate text-micro text-ink-faint" title={line.description}>
              {line.description}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2.5">
            {editing === "category" ? (
              <div className="min-w-[150px] flex-1">
                <NativeSelect
                  autoFocus
                  aria-label={FIELD_LABELS.category}
                  defaultValue={draft.categorySlug}
                  onChange={(event) => {
                    resolve("category", { categorySlug: event.target.value });
                    setEditing(null);
                  }}
                  onBlur={() => setEditing(null)}
                >
                  {categories
                    .filter((entry) => entry.kind === (incoming ? "income" : "expense"))
                    .map((entry) => (
                      <option key={entry.id} value={entry.slug}>
                        {entry.name_fa}
                      </option>
                    ))}
                </NativeSelect>
              </div>
            ) : (
              <EditableValue
                label={FIELD_LABELS.category}
                value={category?.name_fa ?? draft.categorySlug}
                isGuess={isGuess("category")}
                justConfirmed={draft.resolved.includes("category")}
                onEdit={() => setEditing("category")}
              />
            )}

            {editing === "date" ? (
              <div className="min-w-[150px] flex-1">
                <Input
                  autoFocus
                  type="date"
                  dir="ltr"
                  aria-label={FIELD_LABELS.date}
                  defaultValue={draft.occurredOn}
                  onChange={(event) =>
                    resolve("date", { occurredOn: event.target.value })
                  }
                  onBlur={() => setEditing(null)}
                />
              </div>
            ) : (
              <EditableValue
                label={FIELD_LABELS.date}
                value={formatDateFa(draft.occurredOn)}
                isGuess={isGuess("date")}
                justConfirmed={draft.resolved.includes("date")}
                onEdit={() => setEditing("date")}
              />
            )}

            {editing === "merchant" ? (
              <div className="min-w-[150px] flex-1">
                <Input
                  autoFocus
                  aria-label={FIELD_LABELS.merchant}
                  defaultValue={draft.merchant ?? ""}
                  onChange={(event) =>
                    resolve("merchant", { merchant: event.target.value || null })
                  }
                  onBlur={() => setEditing(null)}
                />
              </div>
            ) : (
              <EditableValue
                label={FIELD_LABELS.merchant}
                value={draft.merchant ?? "—"}
                isGuess={isGuess("merchant")}
                justConfirmed={draft.resolved.includes("merchant")}
                onEdit={() => setEditing("merchant")}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableValue({
  label,
  value,
  isGuess,
  justConfirmed,
  onEdit,
}: {
  label: string;
  value: string;
  isGuess: boolean;
  justConfirmed: boolean;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex flex-col items-start gap-[3px] text-start"
    >
      <span
        className={cn(
          "text-caption font-medium",
          isGuess ? "text-guess" : "text-ink-muted",
        )}
      >
        {label}
        {isGuess && " · حدس زدم"}
      </span>
      <span
        className={cn(
          "w-fit max-w-[180px] truncate border-b-2 pb-[2px] text-[14px] font-medium",
          isGuess
            ? "border-dashed border-guess text-guess-text"
            : "border-solid border-ink text-ink",
          justConfirmed && !isGuess && "confidence-settle",
        )}
      >
        {value}
      </span>
    </button>
  );
}

/** A row that reconciliation found already in the ledger. Read-only. */
export function MatchedLineRow({
  line,
  currency,
}: {
  line: StatementLineRow;
  currency: CurrencyCode;
}) {
  const incoming = line.direction === "in";

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline px-3 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-ink-muted">
          {line.merchant || line.description || "تراکنش"}
        </span>
        <span className="block text-micro text-ink-faint">
          {formatDateFa(line.occurred_on)}
          {line.match_day_gap ? ` · ${line.match_day_gap} روز اختلاف تاریخ` : ""}
        </span>
      </span>
      <Money
        minor={incoming ? line.amount : -line.amount}
        currency={currency}
        signed
        className="shrink-0 text-[14px] text-ink-muted"
      />
    </div>
  );
}
