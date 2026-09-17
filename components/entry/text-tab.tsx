"use client";

import { useState, useTransition } from "react";
import { Microphone } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/field";
import { ConfirmCard, toDraft, type DraftTransaction } from "./confirm-card";
import { faCount } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import type { AccountRow, CategoryRow } from "@/lib/supabase/database.types";
import { saveParsedTransactions } from "@/app/(app)/transactions/actions";

export function TextTab({
  currency,
  categories,
  accounts,
  defaultAccountId,
  onSaved,
}: {
  currency: CurrencyCode;
  categories: CategoryRow[];
  accounts: AccountRow[];
  defaultAccountId: string | null;
  onSaved: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<DraftTransaction[] | null>(null);
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [error, setError] = useState<string>();
  const [isReading, startReading] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function read() {
    setError(undefined);
    startReading(async () => {
      try {
        const response = await fetch("/api/parse/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const result = await response.json();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDrafts(result.transactions.map(toDraft));
      } catch {
        setError("اتصال قطع شد. متن را نگه داشتم؛ دوباره بزن.");
      }
    });
  }

  function save() {
    if (!drafts) return;
    startSaving(async () => {
      const result = await saveParsedTransactions({
        source: "text",
        accountId,
        transactions: drafts.map((draft) => ({
          type: draft.type,
          amountMinor: draft.amount_minor,
          categorySlug: draft.category_slug,
          merchant: draft.merchant,
          note: draft.note,
          occurredOn: draft.occurred_on,
          confidence: draft.confidence,
          // A field the user corrected is no longer under review.
          needsReview: draft.needs_review.filter(
            (field) => !draft.resolved.includes(field),
          ),
        })),
      });
      if ("error" in result) setError(result.error);
      else onSaved(`ثبت شد. ${result.balanceText} برایت مانده.`);
    });
  }

  if (drafts) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-control border border-hairline bg-paper px-3 py-2.5">
          <p className="text-caption text-ink-muted">چیزی که نوشتی</p>
          <p className="mt-1 text-body text-ink">{text}</p>
        </div>
        <FormError>{error}</FormError>
        <ConfirmCard
          drafts={drafts}
          currency={currency}
          categories={categories}
          accounts={accounts}
          accountId={accountId}
          onAccountChange={setAccountId}
          isPending={isSaving}
          onChange={(index, next) =>
            setDrafts(drafts.map((draft, i) => (i === index ? next : draft)))
          }
          onSubmit={save}
          onCancel={() => setDrafts(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError>{error}</FormError>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        autoFocus
        placeholder="مثلاً: امروز ۴۵ دلار خرید از سوپرمارکت و ۱۲ دلار قهوه"
        className="w-full resize-none rounded-control border border-hairline-strong bg-surface p-3 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-faint focus-visible:border-lapis focus-visible:ring-2 focus-visible:ring-lapis/20"
      />

      {/* Dictation is the "voice" method: every phone already has it, it needs
          no account, and the text lands editable instead of behind a transcript. */}
      <p className="flex items-center gap-1.5 text-caption text-ink-muted">
        <Microphone size={14} className="shrink-0 text-lapis" />
        به‌جای تایپ می‌توانی میکروفون کیبوردت را بزنی و بگویی.
      </p>

      <Button size="lg" onClick={read} disabled={isReading || text.trim().length < 3}>
        {isReading ? "دارم متن را می‌خوانم…" : "بخوانش"}
      </Button>

      <p className="text-center text-caption text-ink-muted">
        تا {faCount(10)} تراکنش را در یک جمله می‌فهمم.
      </p>
    </div>
  );
}
