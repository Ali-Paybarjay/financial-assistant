"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { Money } from "@/components/money";
import { ManualForm } from "./manual-form";
import { ReceiptTab } from "./receipt-tab";
import { ConfirmCard, type DraftTransaction } from "./confirm-card";
import type { CurrencyCode } from "@/lib/money";
import type { EnvelopeRow } from "@/lib/envelopes";
import type { AccountRow, CategoryRow, GoalRow } from "@/lib/supabase/database.types";
import { saveParsedTransactions } from "@/app/(app)/transactions/actions";

/**
 * Everything a purchase needs to be written down, read once in the layout.
 *
 * Both surfaces that record one — the bar docked to every page, and the
 * capture screen at «/» — take the same bag, because they are the same act in
 * two sizes.
 */
export type CaptureData = {
  currency: CurrencyCode;
  categories: CategoryRow[];
  accounts: AccountRow[];
  goals: GoalRow[];
  /** This month's envelopes, for the sentence the confirm card ends with. */
  envelopes: EnvelopeRow[];
  defaultAccountId: string | null;
  today: string;
};

/**
 * What the composer says when it opens the form rather than reading the text.
 *
 * Each one names the missing piece, because «a form appeared» on its own
 * reads as the model having failed rather than as there being nothing to
 * read.
 */
const MANUAL_REASON: Record<string, string> = {
  "no-amount": "مبلغی ننوشتی. عددش را بگذار تا ثبت کنم.",
  "amount-only": "مبلغ را گرفتم. چی خریدی؟ دسته‌اش را انتخاب کن.",
  "too-short": "خیلی کوتاه بود. این‌جا کاملش کن.",
};

/** Long enough to read the line once; short enough to stay out of the way. */
export const SAVED_VISIBLE_MS = 2200;

export type SheetState =
  | null
  /** The gate decided this needed no model; the form opens part-filled. */
  | {
      kind: "manual";
      reason: "too-short" | "no-amount" | "amount-only";
      amount?: string;
      merchant?: string;
    }
  /** The model read it; the user confirms before anything is written. */
  | { kind: "confirm"; source: string; drafts: DraftTransaction[] }
  | { kind: "receipt"; file: File };

export function CaptureSheet({
  state,
  onClose,
  currency,
  categories,
  accounts,
  goals,
  envelopes,
  defaultAccountId,
  today,
}: CaptureData & {
  state: SheetState;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [goalId, setGoalId] = useState("");
  const [drafts, setDrafts] = useState<DraftTransaction[] | null>(null);
  const [saved, setSaved] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSaving, startSaving] = useTransition();

  // close() is redefined every render; the effect wants the latest one
  // without taking it as a dependency and restarting the timer each time.
  const closeRef = useRef<() => void>(() => {});

  const open = state !== null;
  const rows = drafts ?? (state?.kind === "confirm" ? state.drafts : null);

  /**
   * The success message closes itself.
   *
   * It says one thing, offers nothing to do, and is the last step of an
   * action the user already finished — so making them dismiss it charges a
   * tap for reading a receipt. Long enough to read «ثبت شد. ۱٬۲۰۰ برایت
   * مانده.» once, short enough not to sit in the way of the next entry.
   *
   * The ✕ still works, and the timer is cleared when it is used, so an early
   * close cannot fire a second one under whatever opened next.
   */
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => closeRef.current(), SAVED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  function close() {
    setDrafts(null);
    setSaved(undefined);
    setError(undefined);
    onClose();
  }
  closeRef.current = close;

  function save() {
    if (!rows) return;
    startSaving(async () => {
      const result = await saveParsedTransactions({
        source: "text",
        accountId,
        goalId,
        transactions: rows.map((draft) => ({
          type: draft.type,
          amountMinor: draft.amount_minor,
          categorySlug: draft.category_slug,
          merchant: draft.merchant,
          note: draft.note,
          occurredOn: draft.occurred_on,
          confidence: draft.confidence,
        })),
      });
      if ("error" in result) setError(result.error);
      else setSaved(`ثبت شد. ${result.balanceText} برایت مانده.`);
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={state?.kind === "receipt" ? "عکس فاکتور" : "ثبت تراکنش"}
    >
      {saved ? (
        <p className="rounded-control border border-positive/25 bg-positive-tint px-3 py-3 text-body font-medium text-positive">
          {saved}
        </p>
      ) : state?.kind === "receipt" ? (
        <ReceiptTab
          currency={currency}
          categories={categories}
          accounts={accounts}
          goals={goals}
          defaultAccountId={defaultAccountId}
          initialFile={state.file}
          onSaved={setSaved}
        />
      ) : state?.kind === "manual" ? (
        <div className="flex flex-col gap-3">
          {/* Why the form opened instead of the app just doing it. Without
              this the fast path looks like the model failing. */}
          <p className="rounded-control bg-paper px-3 py-2.5 text-caption text-ink-muted">
            {MANUAL_REASON[state.reason]}
          </p>
          <ManualForm
            currency={currency}
            categories={categories}
            accounts={accounts}
            goals={goals}
            defaultAccountId={defaultAccountId}
            today={today}
            initialAmount={state.amount}
            initialMerchant={state.merchant}
            onSaved={setSaved}
          />
        </div>
      ) : rows ? (
        <div className="flex flex-col gap-3">
          {state?.kind === "confirm" && (
            <div className="rounded-control border border-hairline bg-paper px-3 py-2.5">
              <p className="text-caption text-ink-muted">چیزی که نوشتی</p>
              <p className="mt-1 text-body text-ink">{state.source}</p>
            </div>
          )}

          {/* The consequence, before the row exists. Finding out a purchase
              put an envelope over its ceiling belongs at the moment of
              recording it, not on the board a day later. */}
          <EnvelopeEffect
            drafts={rows}
            envelopes={envelopes}
            categories={categories}
            currency={currency}
          />

          <ConfirmCard
            drafts={rows}
            currency={currency}
            categories={categories}
            accounts={accounts}
            accountId={accountId}
            goals={goals}
            goalId={goalId}
            onGoalChange={setGoalId}
            onAccountChange={setAccountId}
            isPending={isSaving}
            onChange={(index, next) =>
              setDrafts(rows.map((draft, i) => (i === index ? next : draft)))
            }
            onSubmit={save}
            onCancel={close}
          />

          {error && (
            <p role="alert" className="text-caption font-medium text-negative">
              {error}
            </p>
          )}
        </div>
      ) : null}
    </BottomSheet>
  );
}

/**
 * What this purchase does to its envelope, said before it is recorded.
 *
 * Only speaks when the answer is «it goes over», because that is the only
 * case where the user might do something differently. «Still $400 left» is
 * true and changes nothing.
 *
 * The amount is a <Money> inside the sentence rather than a formatted string,
 * because rule 1 gives money exactly one rendering path — and this is a place
 * where it would have been easy to reach for the formatter instead.
 */
function EnvelopeEffect({
  drafts,
  envelopes,
  categories,
  currency,
}: {
  drafts: DraftTransaction[];
  envelopes: EnvelopeRow[];
  categories: CategoryRow[];
  currency: CurrencyCode;
}) {
  const idBySlug = new Map(categories.map((entry) => [entry.slug, entry.id]));
  const byCategory = new Map(envelopes.map((row) => [row.category_id, row]));

  const over: { name: string; by: number }[] = [];
  for (const draft of drafts) {
    if (draft.type !== "expense") continue;
    const categoryId = idBySlug.get(draft.category_slug);
    const envelope = categoryId ? byCategory.get(categoryId) : undefined;
    if (!envelope?.budget_minor) continue;

    const after = envelope.spent_minor + draft.amount_minor;
    if (after <= envelope.budget_minor) continue;
    over.push({ name: envelope.name_fa, by: after - envelope.budget_minor });
  }

  if (over.length === 0) return null;

  return (
    <div className="rounded-control border border-guess-border bg-guess-tint px-3 py-2.5">
      {over.map((envelope) => (
        <p
          key={envelope.name}
          className="text-caption font-medium text-guess-text"
        >
          با این ثبت، پاکت «{envelope.name}»{" "}
          <Money minor={envelope.by} currency={currency} /> از سقف رد می‌شود.
        </p>
      ))}
    </div>
  );
}
