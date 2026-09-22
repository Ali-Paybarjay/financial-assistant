"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, Plus, Receipt, TextT } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { SegmentedControl } from "@/components/segmented-control";
import { ManualForm } from "./manual-form";
import { TextTab } from "./text-tab";
import { ReceiptTab } from "./receipt-tab";
import type { CurrencyCode } from "@/lib/money";
import type { AccountRow, CategoryRow, GoalRow } from "@/lib/supabase/database.types";

type Method = "form" | "text" | "receipt";

/**
 * The floating action button and the sheet it opens. Bottom-end corner, which
 * in RTL is the bottom left — `end-4` rather than a physical side.
 *
 * Three methods, not four: speech is dictated straight into the text tab with
 * the keyboard mic the user already has, so there is no recording to manage.
 */
export function EntryLauncher({
  currency,
  categories,
  accounts,
  goals,
  defaultAccountId,
  today,
  open,
  onOpenChange,
}: {
  currency: CurrencyCode;
  categories: CategoryRow[];
  accounts: AccountRow[];
  /** Active goals, so a purchase can say which one it spent, as it is recorded. */
  goals: GoalRow[];
  defaultAccountId: string | null;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [method, setMethod] = useState<Method>("form");
  const [confirmation, setConfirmation] = useState<string>();
  const router = useRouter();

  function reset() {
    setConfirmation(undefined);
    setMethod("form");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          onOpenChange(true);
        }}
        className="fixed bottom-[76px] end-4 z-30 flex h-14 items-center gap-2 rounded-full bg-action px-5 text-[15px] font-semibold text-white shadow-fab transition-colors hover:bg-action/90 active:bg-action-pressed min-[960px]:hidden"
      >
        <Plus size={20} weight="bold" />
        ثبت هزینه
      </button>

      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) {
            reset();
            router.refresh();
          }
        }}
        title="ثبت تراکنش"
      >
        {confirmation ? (
          <div className="flex flex-col gap-4 pb-2">
            <p className="rounded-control border border-positive/25 bg-positive-tint px-3 py-3 text-body font-medium text-positive">
              {confirmation}
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-caption font-medium text-action hover:underline"
            >
              یکی دیگر ثبت کن
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Ordered fastest and most certain first. */}
            <SegmentedControl<Method>
              label="روش ثبت"
              value={method}
              onChange={setMethod}
              segments={[
                { value: "form", label: "فرم", icon: <Keyboard size={15} /> },
                { value: "text", label: "متن", icon: <TextT size={15} /> },
                { value: "receipt", label: "عکس", icon: <Receipt size={15} /> },
              ]}
            />

            {method === "form" && (
              <ManualForm
                currency={currency}
                categories={categories}
                accounts={accounts}
                goals={goals}
                defaultAccountId={defaultAccountId}
                today={today}
                onSaved={setConfirmation}
              />
            )}
            {method === "text" && (
              <TextTab
                currency={currency}
                categories={categories}
                accounts={accounts}
                goals={goals}
                defaultAccountId={defaultAccountId}
                onSaved={setConfirmation}
              />
            )}
            {method === "receipt" && (
              <ReceiptTab
                currency={currency}
                categories={categories}
                accounts={accounts}
                goals={goals}
                defaultAccountId={defaultAccountId}
                onSaved={setConfirmation}
              />
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
