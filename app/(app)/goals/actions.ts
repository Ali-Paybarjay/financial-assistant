"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { toMinor } from "@/lib/money";
import { goalFormSchema } from "@/lib/validation/records";

export type GoalResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

export async function saveGoal(raw: unknown): Promise<GoalResult> {
  const parsed = goalFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  let targetAmount: number;
  let savedAmount: number;
  try {
    targetAmount = toMinor(parsed.data.targetAmount, viewer.currency);
    savedAmount = parsed.data.savedAmount.trim()
      ? toMinor(parsed.data.savedAmount, viewer.currency)
      : 0;
  } catch {
    return { error: "مبلغ عدد نیست. فقط رقم بنویس، مثل ۱۰۰۰۰." };
  }

  if (targetAmount <= 0) return { error: "مبلغ هدف باید بزرگ‌تر از صفر باشد." };

  const payload = {
    user_id: viewer.userId,
    title: parsed.data.title,
    type: parsed.data.type,
    target_amount: targetAmount,
    saved_amount: savedAmount,
    target_date: parsed.data.targetDate || null,
  };

  const { error } = parsed.data.id
    ? await supabase.from("goals").update(payload).eq("id", parsed.data.id)
    : await supabase.from("goals").insert(payload);

  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<GoalResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: true };
}
