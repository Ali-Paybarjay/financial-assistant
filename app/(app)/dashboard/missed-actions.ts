"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";

/**
 * Answering the three questions a skipped month raises.
 *
 * The app cannot settle any of them on its own: whether last June's rent left
 * the account is something only the person who paid it knows, and guessing
 * either way puts a wrong number in a ledger that nothing will correct.
 *
 * What the app *can* do is act on the answer properly — which is why «no» is
 * not simply silence. A bill that is no longer paid should stop being counted
 * in what a month costs, and that flows straight through to the savings plan.
 */

export type MissedResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ثبت نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/income");
  // The month's fixed costs feed the surplus the whole plan is built on.
  revalidatePath("/goals");
}

/** «It was paid» — generate the row that month should have had. */
export async function confirmMissedMonth(
  recurringExpenseId: string,
  month: string,
): Promise<MissedResult> {
  await requireViewer();
  const supabase = await createClient();

  // The same generator the first of the month uses, aimed at one bill. Going
  // through it rather than building the row here is what keeps a confirmed
  // month identical to an automatic one — same date rule, same account, same
  // idempotency index behind it.
  const { error } = await supabase.rpc("post_recurring_for_month", {
    p_month: month,
    p_only: recurringExpenseId,
  });

  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}

/**
 * «It was not paid, but the bill goes on» — record the answer so the question
 * stops coming back, and leave the bill alone.
 */
export async function skipMissedMonth(
  recurringExpenseId: string,
  month: string,
): Promise<MissedResult> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from("recurring_skipped_months").insert({
    user_id: viewer.userId,
    recurring_expense_id: recurringExpenseId,
    month,
  });

  // Already answered, by a second tab or a double tap. That is the answer we
  // wanted, so it is not a failure.
  if (error && error.code !== "23505") return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}

/**
 * «I do not pay this any more» — stop the bill.
 *
 * Deactivating is what makes this more than a way to dismiss a prompt: the
 * bill leaves the monthly fixed costs, so «what's left at the end of the
 * month» rises, and every goal's plan is recomputed against the truth. The
 * row is kept, not deleted, because the months it *was* paid in are real and
 * their transactions still point at it.
 *
 * The outstanding months need no skip rows: the finder only asks about active
 * bills, so they stop being asked the moment this lands.
 */
export async function stopRecurringBill(
  recurringExpenseId: string,
): Promise<MissedResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("recurring_expenses")
    .update({ is_active: false })
    .eq("id", recurringExpenseId);

  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}
