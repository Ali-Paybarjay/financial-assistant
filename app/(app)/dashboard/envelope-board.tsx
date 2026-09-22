"use client";

import { useState } from "react";
import Link from "next/link";
import { EnvelopeCard, UnsetEnvelopeCard } from "@/components/dashboard/envelope-card";
import { BudgetSheet } from "@/components/dashboard/budget-sheet";
import { envelopeState, type EnvelopeRow } from "@/lib/envelopes";
import type { CurrencyCode, Minor } from "@/lib/money";

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
}: {
  envelopes: EnvelopeRow[];
  /** categoryId -> the median of the last three months, where there is one. */
  suggestions: Record<string, Minor>;
  slugById: Record<string, string>;
  currency: CurrencyCode;
  daysLeft: number;
}) {
  const [editing, setEditing] = useState<EnvelopeRow | null>(null);

  // `envelope_status()` already sorts the unset ones last; this splits them
  // out because they are laid out differently, not to reorder them.
  const withBudget = envelopes.filter(
    (envelope) => envelopeState(envelope.budget_minor, envelope.spent_minor) !== "unset",
  );
  const unset = envelopes.filter(
    (envelope) => envelopeState(envelope.budget_minor, envelope.spent_minor) === "unset",
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-title font-semibold text-ink">پاکت‌های این ماه</h2>
        <Link href="/settings" className="text-caption font-medium text-lapis">
          سقف‌ها
        </Link>
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
          suggestion={suggestions[envelope.category_id] ?? null}
          currency={currency}
          onSetBudget={() => setEditing(envelope)}
        />
      ))}

      <BudgetSheet
        envelope={editing}
        suggestion={editing ? (suggestions[editing.category_id] ?? null) : null}
        currency={currency}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </section>
  );
}
