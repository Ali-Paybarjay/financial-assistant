"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { ManualForm } from "./manual-form";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryRow } from "@/lib/supabase/database.types";

/**
 * The floating action button and the sheet it opens. Bottom-end corner, which
 * in RTL is the bottom left — `end-4` rather than a physical side.
 *
 * The sheet holds only the manual form today; the text, voice and receipt tabs
 * arrive with the parsing routes in M6–M8.
 */
export function EntryLauncher({
  currency,
  categories,
  today,
  open,
  onOpenChange,
}: {
  currency: CurrencyCode;
  categories: CategoryRow[];
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmation, setConfirmation] = useState<string>();
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setConfirmation(undefined);
          onOpenChange(true);
        }}
        className="fixed bottom-[76px] end-4 z-30 flex h-14 items-center gap-2 rounded-full bg-lapis px-5 text-[15px] font-semibold text-white shadow-fab transition-colors hover:bg-lapis/90 active:bg-lapis-pressed min-[960px]:hidden"
      >
        <Plus size={20} weight="bold" />
        ثبت هزینه
      </button>

      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) router.refresh();
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
              onClick={() => setConfirmation(undefined)}
              className="text-caption font-medium text-lapis hover:underline"
            >
              یکی دیگر ثبت کن
            </button>
          </div>
        ) : (
          <ManualForm
            currency={currency}
            categories={categories}
            today={today}
            onSaved={setConfirmation}
          />
        )}
      </BottomSheet>
    </>
  );
}
