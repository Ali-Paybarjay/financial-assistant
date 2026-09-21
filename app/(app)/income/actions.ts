"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { categoryIdsBySlug } from "@/lib/queries/categories";
import { toMinor } from "@/lib/money";
import {
  incomeSourceFormSchema,
  recurringExpenseFormSchema,
} from "@/lib/validation/records";

export type RecordResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";
const AMOUNT_ERROR = "مبلغ عدد نیست. فقط رقم بنویس، مثل ۱۲۰۰.";

function refresh() {
  revalidatePath("/income");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  // The hub carries the same month and the same balances.
  revalidatePath("/");
}

export async function saveIncomeSource(raw: unknown): Promise<RecordResult> {
  const parsed = incomeSourceFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  let amount: number;
  try {
    amount = toMinor(parsed.data.amount, viewer.currency);
  } catch {
    return { error: AMOUNT_ERROR };
  }

  const payload = {
    user_id: viewer.userId,
    title: parsed.data.title,
    type: parsed.data.type,
    amount,
    currency: viewer.currency,
    frequency: parsed.data.frequency,
  };

  const { error } = parsed.data.id
    ? await supabase.from("income_sources").update(payload).eq("id", parsed.data.id)
    : await supabase.from("income_sources").insert(payload);

  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}

export async function saveRecurringExpense(raw: unknown): Promise<RecordResult> {
  const parsed = recurringExpenseFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const categories = await categoryIdsBySlug();

  let amount: number;
  try {
    amount = toMinor(parsed.data.amount, viewer.currency);
  } catch {
    return { error: AMOUNT_ERROR };
  }

  const payload = {
    user_id: viewer.userId,
    title: parsed.data.title,
    category_id: categories.get(parsed.data.categorySlug) ?? null,
    account_id: parsed.data.accountId || null,
    amount,
    currency: viewer.currency,
    frequency: parsed.data.frequency,
    due_day: parsed.data.dueDay,
    // A monthly bill is due every month, so naming one would be meaningless.
    // The database enforces the same pairing; dropping it here is what keeps
    // a frequency changed from yearly to monthly from carrying its old month
    // along and being refused.
    due_month: parsed.data.frequency === "monthly" ? null : parsed.data.dueMonth,
    auto_post: parsed.data.autoPost,
  };

  const { error } = parsed.data.id
    ? await supabase.from("recurring_expenses").update(payload).eq("id", parsed.data.id)
    : await supabase.from("recurring_expenses").insert(payload);

  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}

/** Deactivating keeps the row: history must survive turning something off. */
export async function setRecordActive(
  table: "income_sources" | "recurring_expenses",
  id: string,
  isActive: boolean,
): Promise<RecordResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from(table).update({ is_active: isActive }).eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}

export async function deleteRecord(
  table: "income_sources" | "recurring_expenses",
  id: string,
): Promise<RecordResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}
