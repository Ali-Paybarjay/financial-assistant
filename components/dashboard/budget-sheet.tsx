"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/bottom-sheet";
import { AmountInput } from "@/components/amount-input";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/field";
import { Money } from "@/components/money";
import { toMajor, toMinor, type CurrencyCode, type Minor } from "@/lib/money";
import { setCategoryBudget } from "@/app/(app)/dashboard/budget-actions";
import type { EnvelopeRow } from "@/lib/envelopes";

/**
 * Setting the ceiling on one envelope.
 *
 * The sheet and the amount field are the ones the rest of the app uses — a
 * second amount input is a second set of rules about what a number means.
 *
 * What is new here is the consequence line. A ceiling is the one figure a user
 * types without knowing what it does, and finding out a month later that they
 * were already over it is the version of this feature nobody wants. So the
 * sheet says it while they are still typing.
 */
export function BudgetSheet({
  envelope,
  suggestion,
  currency,
  open,
  onOpenChange,
}: {
  /** The envelope being given a ceiling, or null when the sheet is closed. */
  envelope: EnvelopeRow | null;
  suggestion: Minor | null;
  currency: CurrencyCode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [isSaving, startSaving] = useTransition();

  // Reopening on a different envelope must not carry the last one's figure.
  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setAmount(
      envelope?.budget_minor ? String(toMajor(envelope.budget_minor, currency)) : "",
    );
  }, [open, envelope, currency]);

  if (!envelope) return null;

  const typed = safeMinor(amount, currency);
  const over = typed !== null && typed > 0 ? envelope.spent_minor - typed : null;

  function save() {
    if (!envelope) return;
    setError(undefined);
    startSaving(async () => {
      const result = await setCategoryBudget({
        categoryId: envelope.category_id,
        amount,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`سقف «${envelope.name_fa}»`}
      description="از این ماه به بعد. ماه‌های گذشته دست‌نخورده می‌مانند."
    >
      <div className="flex flex-col gap-4">
        <FormError>{error}</FormError>

        <Field
          label="سقف ماهانه"
          htmlFor="budget-amount"
          hint={
            suggestion !== null
              ? undefined
              : "هنوز دو ماه سابقه نداری، پس پیشنهادی ندارم — خودت بگو."
          }
        >
          <AmountInput
            id="budget-amount"
            size="hero"
            currency={currency}
            value={amount}
            autoFocus
            placeholder="۵۰۰"
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        {suggestion !== null && (
          <button
            type="button"
            onClick={() => setAmount(String(toMajor(suggestion, currency)))}
            className="w-fit rounded-full bg-lapis-tint px-3 py-1.5 text-caption font-semibold text-lapis"
          >
            میانهٔ ۳ ماه: <Money minor={suggestion} currency={currency} />
          </button>
        )}

        {/* Said now, not next month. */}
        {over !== null && over > 0 && (
          <p className="rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
            با این سقف، همین ماه <Money minor={over} currency={currency} /> رد شده‌ای.
            پاکت از امروز قرمز می‌آید.
          </p>
        )}

        <div className="flex gap-2">
          <Button size="lg" onClick={save} disabled={isSaving} className="flex-1">
            {isSaving ? "دارم ذخیره می‌کنم…" : "سقف را بگذار"}
          </Button>
          {envelope.budget_minor !== null && (
            <Button
              size="lg"
              variant="ghost"
              disabled={isSaving}
              onClick={() => {
                setAmount("");
                startSaving(async () => {
                  const result = await setCategoryBudget({
                    categoryId: envelope.category_id,
                    amount: "",
                  });
                  if ("error" in result) {
                    setError(result.error);
                    return;
                  }
                  onOpenChange(false);
                  router.refresh();
                });
              }}
            >
              بردار
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

/** What the user has typed so far, or null while it is not yet a number. */
function safeMinor(text: string, currency: CurrencyCode): Minor | null {
  if (!text.trim()) return null;
  try {
    return toMinor(text, currency);
  } catch {
    return null;
  }
}
