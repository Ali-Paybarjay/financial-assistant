"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Camera, Spinner } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Money } from "@/components/money";
import { TabBar } from "@/components/app-shell/tab-bar";
import { ManualForm } from "./manual-form";
import { ReceiptTab } from "./receipt-tab";
import { ConfirmCard, toDraft, type DraftTransaction } from "./confirm-card";
import { quickParse } from "@/lib/entry/quick-parse";
import type { CurrencyCode } from "@/lib/money";
import type { EnvelopeRow } from "@/lib/envelopes";
import type { WorkspaceId } from "@/lib/workspaces";
import type { AccountRow, CategoryRow, GoalRow } from "@/lib/supabase/database.types";
import { saveParsedTransactions } from "@/app/(app)/transactions/actions";
import { cn } from "@/lib/utils";

/**
 * The bar at the bottom of every page, and the tab bar inside it.
 *
 * It replaces the floating button, and the reason is arithmetic rather than
 * taste: recording a purchase used to be a tap to open the sheet, a tap to
 * pick a method, and then typing. Now it is typing. The app's own measure is
 * «a purchase recorded in under ten seconds», and two of those seconds were
 * spent getting to the field.
 *
 * The tab bar lives inside this bar rather than beside it because they are
 * both fixed to the bottom of a phone, and two stacked fixed strips eat a
 * fifth of the screen. One strip, 120px: a 42px field, the four tabs, and
 * whatever the device reserves at the bottom edge.
 *
 * There is no microphone button. Dictation is the keyboard's own, inside this
 * same field — rule 8 — which costs nothing, needs no permission, and lands
 * as editable text rather than behind a transcript.
 */
export function Composer({
  workspace,
  currency,
  categories,
  accounts,
  goals,
  envelopes,
  defaultAccountId,
  today,
}: {
  workspace: WorkspaceId;
  currency: CurrencyCode;
  categories: CategoryRow[];
  accounts: AccountRow[];
  goals: GoalRow[];
  /** This month's envelopes, for the sentence the confirm card ends with. */
  envelopes: EnvelopeRow[];
  defaultAccountId: string | null;
  today: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [error, setError] = useState<string>();
  const [isDropping, setIsDropping] = useState(false);
  const [isReading, startReading] = useTransition();

  function submit() {
    const typed = text.trim();
    if (!typed) return;
    setError(undefined);

    // The gate, before any request. «قهوه ۵» needs no model — it needs two
    // fields filled in, which is faster and free.
    const quick = quickParse(typed);
    if (quick.kind === "manual") {
      setSheet({
        kind: "manual",
        reason: quick.reason,
        amount: quick.amount,
        merchant: quick.merchant,
      });
      setText("");
      return;
    }

    startReading(async () => {
      try {
        const response = await fetch("/api/parse/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: typed }),
        });
        const result = await response.json();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSheet({
          kind: "confirm",
          source: typed,
          drafts: result.transactions.map(toDraft),
        });
        setText("");
      } catch {
        setError("اتصال قطع شد. متن را نگه داشتم؛ دوباره بزن.");
      }
    });
  }

  return (
    <>
      {/* Fixed on a phone; from 960px it sits in the flow above the board,
          where there is room for it and nothing to cover — and where a
          receipt can be dropped onto it, which is how a scan arrives on a
          desktop. A phone has no drag and drop and has the camera button
          instead, so the handlers cost it nothing. */}
      <div
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setIsDropping(true);
        }}
        onDragLeave={() => setIsDropping(false)}
        onDrop={(event) => {
          const file = event.dataTransfer.files?.[0];
          setIsDropping(false);
          if (!file) return;
          event.preventDefault();
          // Anything else dropped here is a mistake worth naming rather than
          // an upload worth attempting.
          if (!file.type.startsWith("image/")) {
            setError("این را نخواندم — عکس فاکتور بده.");
            return;
          }
          setError(undefined);
          setSheet({ kind: "receipt", file });
        }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] transition-colors",
          "min-[960px]:static min-[960px]:z-auto min-[960px]:rounded-card min-[960px]:border",
          isDropping && "min-[960px]:border-action min-[960px]:bg-action-tint",
        )}
      >
        <div className="mx-auto flex max-w-[560px] items-center gap-2 px-4 py-2.5 min-[960px]:max-w-none min-[960px]:px-3">
          <button
            type="button"
            aria-label="عکس فاکتور"
            onClick={() => fileInput.current?.click()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-paper text-ink-muted transition-colors hover:text-action"
          >
            <Camera size={20} />
          </button>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setSheet({ kind: "receipt", file });
              event.target.value = "";
            }}
          />

          <label htmlFor="composer-text" className="sr-only">
            چه خریدی؟
          </label>
          <input
            id="composer-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="بنویس یا دیکته کن"
            // 16px, because anything smaller makes iOS zoom the page on
            // focus and the user lands on a viewport they did not ask for.
            className="h-[42px] min-w-0 flex-1 rounded-full border border-hairline-strong bg-surface px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-faint focus-visible:border-action"
          />

          <button
            type="button"
            aria-label="ثبت"
            onClick={submit}
            disabled={isReading || text.trim().length === 0}
            className={cn(
              // text-surface, not text-white: on --action this is near-white
              // in the light theme and near-black in the dark one, where the
              // accent lightens and white on it stops being readable.
              "flex size-11 shrink-0 items-center justify-center rounded-full text-surface transition-colors",
              "bg-action hover:bg-action/90 active:bg-action-pressed",
              "disabled:bg-hairline-strong disabled:text-surface",
            )}
          >
            {isReading ? (
              <Spinner size={20} className="animate-spin" />
            ) : (
              <ArrowUp size={20} weight="bold" />
            )}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mx-auto max-w-[560px] px-4 pb-2 text-caption font-medium text-negative"
          >
            {error}
          </p>
        )}

        {/* Inside the bar, so the phone carries one fixed strip and not two. */}
        <TabBar workspace={workspace} />
      </div>

      <ComposerSheet
        state={sheet}
        onClose={() => {
          setSheet(null);
          router.refresh();
        }}
        currency={currency}
        categories={categories}
        accounts={accounts}
        goals={goals}
        envelopes={envelopes}
        defaultAccountId={defaultAccountId}
        today={today}
      />
    </>
  );
}

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
const SAVED_VISIBLE_MS = 2200;

type SheetState =
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

function ComposerSheet({
  state,
  onClose,
  currency,
  categories,
  accounts,
  goals,
  envelopes,
  defaultAccountId,
  today,
}: {
  state: SheetState;
  onClose: () => void;
  currency: CurrencyCode;
  categories: CategoryRow[];
  accounts: AccountRow[];
  goals: GoalRow[];
  envelopes: EnvelopeRow[];
  defaultAccountId: string | null;
  today: string;
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
