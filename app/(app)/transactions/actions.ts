"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { categoryIdsBySlug } from "@/lib/queries/categories";
import { formatMoney, toMinor } from "@/lib/money";
import { monthRange } from "@/lib/date";
import { monthTotals } from "@/lib/queries/transactions";
import { transactionFormSchema } from "@/lib/validation/transactions";

export type SaveTransactionResult =
  | { error: string }
  /** The confirmation always states the new balance — that is what the user
   *  came to find out. */
  | { ok: true; balanceText: string };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function saveTransaction(raw: unknown): Promise<SaveTransactionResult> {
  const parsed = transactionFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const categories = await categoryIdsBySlug();

  let amount: number;
  try {
    amount = toMinor(parsed.data.amount, viewer.currency);
  } catch {
    return { error: "مبلغ عدد نیست. فقط رقم بنویس، مثل ۴۵٫۵۰." };
  }
  if (amount <= 0) return { error: "مبلغ باید بزرگ‌تر از صفر باشد." };

  const payload = {
    user_id: viewer.userId,
    type: parsed.data.type,
    amount,
    currency: viewer.currency,
    category_id: categories.get(parsed.data.categorySlug) ?? null,
    merchant: parsed.data.merchant || null,
    note: parsed.data.note || null,
    occurred_on: parsed.data.occurredOn,
    source: "form" as const,
    is_confirmed: true,
    needs_review: [],
  };

  const { error } = parsed.data.id
    ? await supabase.from("transactions").update(payload).eq("id", parsed.data.id)
    : await supabase.from("transactions").insert(payload);

  if (error) return { error: GENERIC_ERROR };

  refresh();

  const { from, to } = monthRange(viewer.timeZone, parsed.data.occurredOn);
  const totals = await monthTotals(from, to);
  return {
    ok: true,
    balanceText: formatMoney(totals.income - totals.expense, viewer.currency, {
      signed: true,
    }),
  };
}

/** Soft delete. The row stays until the undo window closes on its own. */
export async function softDeleteTransaction(
  id: string,
): Promise<{ error: string } | { ok: true }> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "حذف نشد. دوباره بزن." };
  refresh();
  return { ok: true };
}

export async function restoreTransaction(
  id: string,
): Promise<{ error: string } | { ok: true }> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) return { error: "برنگشت. دوباره بزن." };
  refresh();
  return { ok: true };
}

/** Accepting the model's guess for a whole row: the confidence rule goes solid. */
export async function confirmTransaction(
  id: string,
): Promise<{ error: string } | { ok: true }> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ is_confirmed: true, needs_review: [] })
    .eq("id", id);

  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}
