"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { toMinor } from "@/lib/money";
import { monthRange } from "@/lib/date";
import { categoryBudgetFormSchema } from "@/lib/validation/records";

export type BudgetResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

/**
 * Set or clear the ceiling on one category, from this month onwards.
 *
 * Always an upsert on (user_id, category_id, effective_from) with
 * effective_from pinned to the current month, never an update of whatever row
 * happens to be newest. Editing in October has to leave September alone —
 * otherwise a number the user already read and made decisions against changes
 * underneath them, and every figure derived from it stops being trustworthy.
 *
 * An empty amount deletes this month's row rather than writing a zero. Zero is
 * not expressible anyway (the column checks amount_minor > 0), and «no ceiling»
 * is a different statement from «a ceiling of nothing»: the board draws the
 * first as an open decision and the second would read as permanently over.
 */
export async function setCategoryBudget(raw: unknown): Promise<BudgetResult> {
  const parsed = categoryBudgetFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const { month } = monthRange(viewer.timeZone);

  if (!parsed.data.amount) {
    const { error } = await supabase
      .from("category_budgets")
      .delete()
      .eq("category_id", parsed.data.categoryId)
      .eq("effective_from", month);

    if (error) return { error: GENERIC_ERROR };
  } else {
    let amountMinor: number;
    try {
      amountMinor = toMinor(parsed.data.amount, viewer.currency);
    } catch {
      return { error: "مبلغ عدد نیست. فقط رقم بنویس، مثل ۵۰۰." };
    }
    if (amountMinor <= 0) return { error: "سقف باید بزرگ‌تر از صفر باشد." };

    const { error } = await supabase.from("category_budgets").upsert(
      {
        user_id: viewer.userId,
        category_id: parsed.data.categoryId,
        amount_minor: amountMinor,
        currency: viewer.currency,
        effective_from: month,
      },
      { onConflict: "user_id,category_id,effective_from" },
    );

    if (error) return { error: GENERIC_ERROR };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { ok: true };
}
