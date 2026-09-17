"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Money } from "@/components/money";
import { faCount } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryRow } from "@/lib/supabase/database.types";
import type { ParsedTransaction } from "@/lib/ai/schemas";
import { FIELD_LABELS, type ReviewableField } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

export type DraftTransaction = ParsedTransaction & {
  /** Fields the user has since corrected or accepted. */
  resolved: ReviewableField[];
};

export function toDraft(transaction: ParsedTransaction): DraftTransaction {
  return { ...transaction, resolved: [] };
}

/**
 * Model output is never written without passing through here. Every field is
 * editable, and the ones the model inferred carry the dashed brass rule until
 * the user touches them — at which point it settles into solid ink.
 */
export function ConfirmCard({
  drafts,
  currency,
  categories,
  onChange,
  onSubmit,
  onCancel,
  isPending,
}: {
  drafts: DraftTransaction[];
  currency: CurrencyCode;
  categories: CategoryRow[];
  onChange: (index: number, next: DraftTransaction) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const guessCount = drafts.reduce(
    (total, draft) =>
      total +
      draft.needs_review.filter((field) => !draft.resolved.includes(field)).length,
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-card border border-hairline">
        <div className="flex items-baseline justify-between gap-2 bg-paper px-3 py-2.5">
          <span className="text-caption font-semibold text-ink">کارت تأیید</span>
          <span className="text-caption text-ink-muted">
            تا تأیید نکنی ذخیره نمی‌شود
          </span>
        </div>

        {drafts.map((draft, index) => (
          <DraftBlock
            key={index}
            index={index}
            draft={draft}
            currency={currency}
            categories={categories}
            showIndex={drafts.length > 1}
            onChange={(next) => onChange(index, next)}
          />
        ))}
      </div>

      {guessCount > 0 && (
        <p className="flex items-start gap-2 rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
          <span
            aria-hidden
            className="mt-1.5 h-0.5 w-4 shrink-0 border-t-2 border-dashed border-guess"
          />
          {guessCount === 1
            ? "یک فیلد خط‌چین‌دار را حدس زدم. رویش بزن تا عوض شود."
            : `${faCount(guessCount)} فیلد خط‌چین‌دار را حدس زدم. روی هرکدام بزن تا عوض شود.`}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="lg" className="flex-1" onClick={onSubmit} disabled={isPending}>
          {isPending
            ? "دارم ثبت می‌کنم…"
            : drafts.length === 1
              ? "ثبت تراکنش"
              : `ثبت ${faCount(drafts.length)} تراکنش`}
        </Button>
        <Button size="lg" variant="outline" onClick={onCancel} disabled={isPending}>
          انصراف
        </Button>
      </div>
    </div>
  );
}

function DraftBlock({
  index,
  draft,
  currency,
  categories,
  showIndex,
  onChange,
}: {
  index: number;
  draft: DraftTransaction;
  currency: CurrencyCode;
  categories: CategoryRow[];
  showIndex: boolean;
  onChange: (next: DraftTransaction) => void;
}) {
  const category = categories.find((entry) => entry.slug === draft.category_slug);
  const title = draft.merchant || draft.note || category?.name_fa || "تراکنش";

  function resolve(field: ReviewableField, patch: Partial<ParsedTransaction>) {
    onChange({
      ...draft,
      ...patch,
      resolved: draft.resolved.includes(field)
        ? draft.resolved
        : [...draft.resolved, field],
    });
  }

  return (
    <div className="border-t border-hairline p-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[15px] font-semibold text-ink">
          {showIndex && <span className="text-ink-muted">{index + 1} · </span>}
          {title}
        </span>
        <Money
          minor={draft.amount_minor}
          currency={currency}
          className="shrink-0 text-[18px] font-semibold"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
        <EditableField
          field="category"
          draft={draft}
          display={category?.name_fa ?? draft.category_slug}
          editor={(close) => (
            <NativeSelect
              autoFocus
              aria-label={FIELD_LABELS.category}
              defaultValue={draft.category_slug}
              onChange={(event) => {
                resolve("category", { category_slug: event.target.value });
                close();
              }}
              onBlur={close}
            >
              {categories
                .filter((entry) => entry.kind === draft.type)
                .map((entry) => (
                  <option key={entry.id} value={entry.slug}>
                    {entry.name_fa}
                  </option>
                ))}
            </NativeSelect>
          )}
        />

        <EditableField
          field="date"
          draft={draft}
          display={formatDateFa(draft.occurred_on)}
          editor={(close) => (
            <Input
              autoFocus
              type="date"
              dir="ltr"
              aria-label={FIELD_LABELS.date}
              defaultValue={draft.occurred_on}
              onChange={(event) => resolve("date", { occurred_on: event.target.value })}
              onBlur={close}
            />
          )}
        />

        <EditableField
          field="merchant"
          draft={draft}
          display={draft.merchant ?? "—"}
          editor={(close) => (
            <Input
              autoFocus
              aria-label={FIELD_LABELS.merchant}
              defaultValue={draft.merchant ?? ""}
              onChange={(event) =>
                resolve("merchant", { merchant: event.target.value || null })
              }
              onBlur={close}
            />
          )}
        />
      </div>
    </div>
  );
}

function EditableField({
  field,
  draft,
  display,
  editor,
}: {
  field: ReviewableField;
  draft: DraftTransaction;
  display: string;
  editor: (close: () => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const isGuess = draft.needs_review.includes(field) && !draft.resolved.includes(field);
  const justConfirmed = draft.resolved.includes(field);

  if (editing) {
    return <div className="min-w-[150px] flex-1">{editor(() => setEditing(false))}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex flex-col items-start gap-[3px] text-start"
    >
      <span
        className={cn(
          "text-caption font-medium",
          isGuess ? "text-guess" : "text-ink-muted",
        )}
      >
        {FIELD_LABELS[field]}
        {isGuess && " · حدس زدم"}
      </span>
      <span
        className={cn(
          "w-fit max-w-[180px] truncate border-b-2 pb-[2px] text-[14px] font-medium",
          isGuess
            ? "border-dashed border-guess text-guess-text"
            : "border-solid border-ink text-ink",
          justConfirmed && "confidence-settle",
        )}
      >
        {display}
      </span>
    </button>
  );
}
