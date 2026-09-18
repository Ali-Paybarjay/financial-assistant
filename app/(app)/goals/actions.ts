"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { toMinor } from "@/lib/money";
import { goalFormSchema, goalFundingFormSchema } from "@/lib/validation/records";

export type GoalResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

export async function saveGoal(raw: unknown): Promise<GoalResult> {
  const parsed = goalFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  let targetAmount: number;
  let openingSaved: number;
  try {
    targetAmount = toMinor(parsed.data.targetAmount, viewer.currency);
    openingSaved = parsed.data.savedAmount.trim()
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
    // The starting figure only. What has been set aside since comes from the
    // transfers tagged to this goal, so editing it here cannot silently
    // contradict money that actually moved.
    opening_saved: openingSaved,
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

/**
 * Move this month's share into the savings account.
 *
 * The transfer is the point. Setting money aside is not a spend — it is the
 * user's money either way — so nothing here touches the month's expenses; what
 * changes is which account the money sits in, and a goal that can be spent
 * from by accident was never really funded. It becomes a spend on the day it
 * is spent on the goal, which is an expense carrying the same goal_id.
 */
export async function fundGoal(raw: unknown): Promise<GoalResult> {
  const parsed = goalFundingFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  let amount: number;
  try {
    amount = toMinor(parsed.data.amount, viewer.currency);
  } catch {
    return { error: "مبلغ عدد نیست. فقط رقم بنویس، مثل ۱۰۰۰۰." };
  }

  if (amount <= 0) return { error: "مبلغ باید بزرگ‌تر از صفر باشد." };
  if (parsed.data.fromAccountId === parsed.data.toAccountId) {
    return { error: "مبدأ و مقصد یکی است. یکی‌شان را عوض کن." };
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: viewer.userId,
    type: "transfer",
    amount,
    currency: viewer.currency,
    account_id: parsed.data.fromAccountId,
    to_account_id: parsed.data.toAccountId,
    goal_id: parsed.data.goalId,
    occurred_on: parsed.data.occurredOn,
    source: "form",
  });

  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { ok: true };
}

/**
 * Close a goal, or reopen it.
 *
 * Deleting is the wrong way to finish something: it takes the goal off the
 * page along with the record of having reached it, and — now that transfers
 * carry a goal_id — quietly unlabels every payment that funded it. Closing
 * leaves all of that alone and only stops the goal claiming a share of next
 * month.
 */
export async function setGoalStatus(
  id: string,
  status: "active" | "achieved" | "paused",
): Promise<GoalResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from("goals").update({ status }).eq("id", id);
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

/**
 * Move a goal one place up or down its list.
 *
 * Order is not decoration any more: the savings plan hands out each month's
 * spare money in this order, so a user who cannot change it cannot say what
 * their own money is for.
 */
export async function reorderGoal(id: string, direction: -1 | 1): Promise<GoalResult> {
  await requireViewer();
  const supabase = await createClient();

  const { data: goals, error: readError } = await supabase
    .from("goals")
    .select("id")
    .order("priority")
    .order("created_at");

  if (readError || !goals) return { error: GENERIC_ERROR };

  const index = goals.findIndex((goal) => goal.id === id);
  const target = index + direction;
  // Already at the end it was asked to move towards. Nothing to do, and
  // nothing went wrong.
  if (index < 0 || target < 0 || target >= goals.length) return { ok: true };

  const order = goals.map((goal) => goal.id);
  [order[index], order[target]] = [order[target], order[index]];

  // Every priority is renumbered rather than the two being swapped. Onboarding
  // writes them once and nothing has edited them since, so most lists are all
  // zeros — swapping two of those would swap nothing — and renumbering also
  // closes the gaps a deleted goal leaves behind.
  const writes = await Promise.all(
    order.map((goalId, position) =>
      supabase.from("goals").update({ priority: position }).eq("id", goalId),
    ),
  );

  if (writes.some((write) => write.error)) return { error: GENERIC_ERROR };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: true };
}
