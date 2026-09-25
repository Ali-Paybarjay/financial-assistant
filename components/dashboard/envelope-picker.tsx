"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/field";
import {
  createEnvelopeCategory,
  setEnvelopeOnBoard,
} from "@/app/(app)/dashboard/budget-actions";
import type { CategoryRow, CostKind } from "@/lib/supabase/database.types";

/**
 * Adding a packet: pick one of the categories that is not on the board yet,
 * or name a new one.
 *
 * The list is the app's own categories, not a board-only vocabulary, so a
 * packet someone invents here is a category everything else can file under —
 * the entry form, the ledger filter, a receipt the model reads. A board full
 * of labels nothing could be recorded against would look like a feature and
 * behave like a decoration.
 */
export function EnvelopePicker({
  available,
  open,
  onOpenChange,
}: {
  /** Expense categories not currently on the board. */
  available: CategoryRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [costKind, setCostKind] = useState<CostKind>("variable");
  const [error, setError] = useState<string>();
  const [isSaving, startSaving] = useTransition();

  function add(run: () => Promise<{ error: string } | { ok: true }>) {
    setError(undefined);
    startSaving(async () => {
      const result = await run();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setName("");
      setCostKind("variable");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="پاکت تازه"
      description="یکی از دسته‌ها را بردار، یا پاکت خودت را بساز."
    >
      <div className="flex flex-col gap-4">
        <FormError>{error}</FormError>

        {available.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {available.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => add(() => setEnvelopeOnBoard(category.id, true))}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-hairline-strong px-3.5 text-caption font-medium text-ink transition-colors hover:border-action hover:bg-action-tint hover:text-action disabled:opacity-50"
                >
                  <Plus size={13} weight="bold" />
                  {category.name_fa}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-ink-muted">
            همه‌ی دسته‌ها روی بورد هستند. پاکت خودت را بساز.
          </p>
        )}

        <div className="border-t border-hairline pt-4">
          <Field
            label="یا یک پاکت با نام خودت"
            htmlFor="new-envelope"
            hint="این یک دسته‌ی واقعی می‌شود، پس می‌توانی خرج‌ها را هم به آن بزنی."
          >
            <Input
              id="new-envelope"
              value={name}
              placeholder="مثلاً: سفر تابستان"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim().length >= 2) {
                  event.preventDefault();
                  add(() => createEnvelopeCategory(name, costKind));
                }
              }}
            />
          </Field>

          {/* Asked here because nothing else can answer it: «قسط ماشین» is
              exactly as fixed as the rent, and without the question the app
              would turn round and ask for a ceiling on it. */}
          <div className="mt-3">
            <SegmentedControl
              label="جنس این هزینه"
              value={costKind}
              onChange={setCostKind}
              segments={[
                { value: "variable", label: "متغیر" },
                { value: "fixed", label: "ثابت" },
              ]}
            />
            <p className="mt-1.5 text-caption text-ink-muted">
              {costKind === "variable"
                ? "مبلغش دست خودت است، پس می‌توانی برایش سقف بگذاری."
                : "مبلغ و تاریخش معلوم است و باید پرداخت شود — سقف نمی‌خواهد."}
            </p>
          </div>

          <Button
            size="lg"
            className="mt-3 w-full"
            disabled={isSaving || name.trim().length < 2}
            onClick={() => add(() => createEnvelopeCategory(name, costKind))}
          >
            {isSaving ? "دارم می‌سازم…" : "بساز و بگذار روی بورد"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
