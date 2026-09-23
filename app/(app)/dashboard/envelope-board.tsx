"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EnvelopeCard, UnsetEnvelopeCard } from "@/components/dashboard/envelope-card";
import { BudgetSheet } from "@/components/dashboard/budget-sheet";
import { BudgetInvite } from "@/components/dashboard/budget-invite";
import { EnvelopePicker } from "@/components/dashboard/envelope-picker";
import { dismissInsight } from "@/app/(app)/stream/actions";
import { envelopeState, type EnvelopeRow } from "@/lib/envelopes";
import type { CurrencyCode, Minor } from "@/lib/money";
import type { CategoryRow } from "@/lib/supabase/database.types";

/**
 * The board, and the sheet that gives an envelope its ceiling.
 *
 * Client-side only because of the sheet: the cards themselves are static, and
 * a board of links would not need to be. The split is here rather than deeper
 * so that a card can open the sheet without every card carrying its own copy
 * of it.
 */
export function EnvelopeBoard({
  envelopes,
  suggestions,
  slugById,
  currency,
  daysLeft,
  invite,
  available,
}: {
  envelopes: EnvelopeRow[];
  /** categoryId -> the median of the last three months, where there is one. */
  suggestions: Record<string, Minor>;
  slugById: Record<string, string>;
  currency: CurrencyCode;
  daysLeft: number;
  /**
   * What to offer someone who has set no ceiling at all, and the key that
   * remembers them saying no. null once any ceiling exists, or once they have.
   */
  invite: { candidates: EnvelopeRow[]; key: string } | null;
  /** Expense categories not on the board, for the picker. */
  available: CategoryRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<EnvelopeRow | null>(null);
  const [inviteClosed, setInviteClosed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [, startDismissing] = useTransition();

  // `envelope_status()` already sorts the unset ones last; this splits them
  // out because they are laid out differently, not to reorder them.
  const withBudget = envelopes.filter(
    (envelope) => envelopeState(envelope.budget_minor, envelope.spent_minor) !== "unset",
  );
  const unset = envelopes.filter(
    (envelope) => envelopeState(envelope.budget_minor, envelope.spent_minor) === "unset",
  );

  return (
    // Named, so it is a landmark someone can jump to rather than an
    // anonymous <section> that assistive technology skips over entirely.
    <section aria-labelledby="envelope-board" className="flex flex-col gap-3">
      {invite && !inviteClosed && (
        <BudgetInvite
          candidates={invite.candidates}
          observedMedians={suggestions}
          currency={currency}
          onSetBudget={setEditing}
          onDismiss={() => {
            setInviteClosed(true);
            // Reuses the dismissal table the stream already has: the same
            // «I have seen this» fact, keyed the same way, rather than a
            // second column on the profile that means almost the same thing.
            startDismissing(async () => {
              await dismissInsight(invite.key);
              router.refresh();
            });
          }}
        />
      )}

      <div className="flex items-baseline justify-between gap-2">
        <h2 id="envelope-board" className="text-title font-semibold text-ink">
          پاکت‌های این ماه
        </h2>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="text-caption font-semibold text-lapis hover:underline"
        >
          + پاکت
        </button>
      </div>

      {withBudget.length > 0 && (
        <div className="grid grid-cols-2 gap-3 min-[960px]:grid-cols-3">
          {withBudget.map((envelope) => (
            <EnvelopeCard
              key={envelope.category_id}
              envelope={envelope}
              currency={currency}
              daysLeft={daysLeft}
              href={`/transactions?category=${slugById[envelope.category_id] ?? ""}`}
            />
          ))}
        </div>
      )}

      {/* Full width and last, because an envelope with no ceiling is an open
          decision rather than an envelope, and sitting it in the grid beside
          the real ones would say otherwise. */}
      {unset.map((envelope) => (
        <UnsetEnvelopeCard
          key={envelope.category_id}
          envelope={envelope}
          observedMedian={suggestions[envelope.category_id] ?? null}
          currency={currency}
          href={`/transactions?category=${slugById[envelope.category_id] ?? ""}`}
          onSetBudget={() => setEditing(envelope)}
        />
      ))}

      <EnvelopePicker
        available={available}
        open={picking}
        onOpenChange={setPicking}
      />

      <BudgetSheet
        envelope={editing}
        observedMedian={editing ? (suggestions[editing.category_id] ?? null) : null}
        currency={currency}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </section>
  );
}
