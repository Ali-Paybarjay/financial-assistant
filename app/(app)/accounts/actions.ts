"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { toMinor } from "@/lib/money";
import { accountFormSchema } from "@/lib/validation/accounts";

export type AccountResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

/**
 * The balance sits on the dashboard and on every row of the accounts page, and
 * a transaction written anywhere moves it, so a change here has to reach the
 * whole app.
 */
function refresh() {
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/import");
  // The hub carries the same month and the same balances.
  revalidatePath("/");
}

export async function saveAccount(raw: unknown): Promise<AccountResult> {
  const parsed = accountFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  let openingBalance: number;
  try {
    // Negative is legal here and nowhere else in the app: a credit card holds
    // debt, and refusing to say so would force the user to lie about it.
    openingBalance = toMinor(parsed.data.balance, viewer.currency);
  } catch {
    return { error: "موجودی عدد نیست. فقط رقم بنویس، مثل ۱۲۰۰۰۰۰." };
  }

  const payload = {
    user_id: viewer.userId,
    title: parsed.data.title,
    kind: parsed.data.kind,
    currency: viewer.currency,
    opening_balance: openingBalance,
    opening_balance_on: parsed.data.balanceOn,
    institution: parsed.data.institution || null,
    reference: parsed.data.reference || null,
    is_default: parsed.data.isDefault,
  };

  // The unique index allows one default per user, so the old one has to step
  // down before the new one is written or the insert fails on its own index.
  if (payload.is_default) {
    const stepDown = supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("user_id", viewer.userId)
      .eq("is_default", true);

    const { error } = parsed.data.id
      ? await stepDown.neq("id", parsed.data.id)
      : await stepDown;

    if (error) return { error: GENERIC_ERROR };
  }

  const { error } = parsed.data.id
    ? await supabase.from("accounts").update(payload).eq("id", parsed.data.id)
    : await supabase.from("accounts").insert(payload);

  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}

/**
 * Restating the balance rather than editing the account.
 *
 * This is what a user does when the app and the bank disagree: they read the
 * real number off their phone and say "it is this, today". Everything already
 * recorded stays exactly where it is — only the anchor the balance is counted
 * from moves, so the difference is absorbed rather than hunted for.
 */
export async function restateBalance(input: {
  id: string;
  balance: string;
  balanceOn: string;
}): Promise<AccountResult> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.balanceOn)) return { error: GENERIC_ERROR };

  let openingBalance: number;
  try {
    openingBalance = toMinor(input.balance, viewer.currency);
  } catch {
    return { error: "موجودی عدد نیست. فقط رقم بنویس، مثل ۱۲۰۰۰۰۰." };
  }

  const { error } = await supabase
    .from("accounts")
    .update({ opening_balance: openingBalance, opening_balance_on: input.balanceOn })
    .eq("id", input.id);

  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}

/** Closing an account keeps it: its transactions are still part of history. */
export async function setAccountActive(
  id: string,
  isActive: boolean,
): Promise<AccountResult> {
  await requireViewer();
  const supabase = await createClient();

  // A closed account must not stay the one the entry form preselects.
  const patch = isActive ? { is_active: true } : { is_active: false, is_default: false };

  const { error } = await supabase.from("accounts").update(patch).eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}

/**
 * Deleting is only offered while the account is empty. Once anything has been
 * posted to it, the FK would set those rows' account_id to null — the money
 * would stay in the ledger but silently leave every balance it was part of.
 * Closing is the answer to "I don't use this any more"; this is the answer to
 * "I typed it wrong".
 */
export async function deleteAccount(id: string): Promise<AccountResult> {
  await requireViewer();
  const supabase = await createClient();

  // Both legs: a transfer that only arrived here still belongs to this
  // account, and hard-deleting would drop it out of the other account's
  // balance too.
  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`account_id.eq.${id},to_account_id.eq.${id}`)
    .is("deleted_at", null);

  if (countError) return { error: GENERIC_ERROR };
  if ((count ?? 0) > 0) {
    return {
      error: "این حساب تراکنش دارد و پاک نمی‌شود. به‌جایش ببندش تا تاریخچه سر جایش بماند.",
    };
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}
