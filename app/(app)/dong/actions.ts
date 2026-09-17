"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { MoneyParseError, toMinor, type CurrencyCode } from "@/lib/money";
import { splitByUnits, splitEqually, splitGap, type Share } from "@/lib/dong";
import {
  dongExpenseFormSchema,
  dongGroupFormSchema,
  dongMemberFormSchema,
  dongPaymentFormSchema,
  type DongShareInput,
} from "@/lib/validation/dong";

export type DongResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";
const AMOUNT_ERROR = "مبلغ عدد نیست. فقط رقم بنویس، مثل ۱۲۰۰۰۰۰.";

function refresh(groupId?: string) {
  revalidatePath("/dong");
  if (groupId) revalidatePath(`/dong/${groupId}`);
}

/**
 * The group's currency, and proof the viewer may touch it. RLS already blocks
 * the write; reading the row first is what lets the amount be parsed in the
 * right currency — a toman has no decimals and a euro has two, so the same
 * typed string means different integers.
 */
async function groupCurrency(
  groupId: string,
): Promise<{ currency: CurrencyCode } | { error: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dong_groups")
    .select("currency")
    .eq("id", groupId)
    .maybeSingle();

  if (!data) return { error: "این دوره پیدا نشد." };
  return { currency: data.currency as CurrencyCode };
}

/* --------------------------------------------------------------- groups -- */

export async function saveDongGroup(raw: unknown): Promise<DongResult> {
  const parsed = dongGroupFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  const payload = {
    user_id: viewer.userId,
    title: parsed.data.title,
    currency: parsed.data.currency,
    started_on: parsed.data.startedOn,
    note: parsed.data.note || null,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("dong_groups")
      .update(payload)
      .eq("id", parsed.data.id);

    if (error) return { error: GENERIC_ERROR };
    refresh(parsed.data.id);
    return { ok: true };
  }

  const { data: group, error } = await supabase
    .from("dong_groups")
    .insert(payload)
    .select("id")
    .single();

  if (error || !group) return { error: GENERIC_ERROR };

  // A group always contains the person who made it. Without this the first
  // thing the user meets is an empty people list and an expense form with
  // nobody to pay for it.
  const { error: memberError } = await supabase.from("dong_members").insert({
    group_id: group.id,
    user_id: viewer.userId,
    name: viewer.profile.full_name?.trim() || "من",
    is_me: true,
    sort_order: 0,
  });

  if (memberError) {
    // Leaving a group with no members behind would be worse than not having
    // made it: every later screen assumes at least one person.
    await supabase.from("dong_groups").delete().eq("id", group.id);
    return { error: GENERIC_ERROR };
  }

  refresh(group.id);
  return { ok: true };
}

/** Archiving, and bringing back. The rows stay either way. */
export async function setDongGroupSettled(
  id: string,
  settled: boolean,
): Promise<DongResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("dong_groups")
    .update({ settled_at: settled ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { error: GENERIC_ERROR };
  refresh(id);
  return { ok: true };
}

/**
 * Unlike an account, a group really is deleted, with its people, purchases and
 * payments. Nothing outside it refers to any of that, and a trip somebody
 * typed by mistake should not have to be lived with.
 */
export async function deleteDongGroup(id: string): Promise<DongResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from("dong_groups").delete().eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  refresh(id);
  return { ok: true };
}

/* --------------------------------------------------------------- people -- */

export async function saveDongMember(raw: unknown): Promise<DongResult> {
  const parsed = dongMemberFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  // One member per group is the viewer, enforced by a partial unique index.
  // The old holder has to step down first or the write fails on that index.
  if (parsed.data.isMe) {
    const stepDown = supabase
      .from("dong_members")
      .update({ is_me: false })
      .eq("group_id", parsed.data.groupId)
      .eq("is_me", true);

    const { error } = parsed.data.id
      ? await stepDown.neq("id", parsed.data.id)
      : await stepDown;

    if (error) return { error: GENERIC_ERROR };
  }

  const payload = {
    group_id: parsed.data.groupId,
    user_id: viewer.userId,
    name: parsed.data.name,
    is_me: parsed.data.isMe,
  };

  const { error } = parsed.data.id
    ? await supabase.from("dong_members").update(payload).eq("id", parsed.data.id)
    : await supabase.from("dong_members").insert(payload);

  if (error) {
    // The only constraint a user can walk into from this form.
    if (error.code === "23505") {
      return { error: "کسی با همین اسم در این دوره هست. یک اسم دیگر بگذار." };
    }
    return { error: GENERIC_ERROR };
  }

  refresh(parsed.data.groupId);
  return { ok: true };
}

/**
 * The kitty, as a member. Created on demand rather than with every group,
 * because most groups never use one and an unexplained extra person in the
 * list is a question the user has to stop and answer.
 */
export async function addDongFund(groupId: string): Promise<DongResult> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from("dong_members").insert({
    group_id: groupId,
    user_id: viewer.userId,
    name: "صندوق دوره",
    is_fund: true,
    sort_order: 99,
  });

  if (error) return { error: GENERIC_ERROR };
  refresh(groupId);
  return { ok: true };
}

/**
 * Removing a person is refused once anything points at them, by the foreign
 * keys rather than by a count done here: deleting the payer of an expense
 * would delete the expense, and deleting someone's share would leave the bill
 * uncovered. The message says which, because "نمی‌شود" is not actionable.
 */
export async function deleteDongMember(
  id: string,
  groupId: string,
): Promise<DongResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from("dong_members").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "این نفر در خریدها یا پرداخت‌های این دوره سهم دارد و حذف نمی‌شود. اول ردیف‌هایش را بردار.",
      };
    }
    return { error: GENERIC_ERROR };
  }

  refresh(groupId);
  return { ok: true };
}

/* ------------------------------------------------------------- expenses -- */

/**
 * Turn what the form holds into the amounts that will be stored.
 *
 * The three modes differ only in where the numbers come from; all three end as
 * an explicit amount per member that adds up to the bill, because that is the
 * only thing the database will accept.
 */
function resolveShares(
  amount: number,
  mode: "equal" | "shares" | "exact",
  inputs: readonly DongShareInput[],
  currency: CurrencyCode,
): { shares: Share[] } | { error: string } {
  const included = inputs.filter((input) => input.included);
  if (included.length === 0) {
    return { error: "دست‌کم یک نفر باید در این خرید سهیم باشد." };
  }

  if (mode === "equal") {
    return { shares: splitEqually(amount, included.map((input) => input.memberId)) };
  }

  if (mode === "shares") {
    return {
      shares: splitByUnits(
        amount,
        included.map((input) => ({ memberId: input.memberId, units: input.units })),
      ),
    };
  }

  const shares: Share[] = [];
  for (const input of included) {
    try {
      shares.push({
        memberId: input.memberId,
        units: 1,
        amount: toMinor(input.amount || "0", currency),
      });
    } catch (error) {
      if (error instanceof MoneyParseError) return { error: AMOUNT_ERROR };
      throw error;
    }
  }

  const gap = splitGap(amount, shares);
  if (gap !== 0) {
    // Said here in the user's terms. The database would refuse it too, at
    // commit, with a message written for whoever is reading the logs.
    return {
      error:
        gap > 0
          ? "جمع سهم‌ها از مبلغ خرید کمتر است. تا آخر پخشش کن."
          : "جمع سهم‌ها از مبلغ خرید بیشتر است.",
    };
  }

  return { shares };
}

export async function saveDongExpense(raw: unknown): Promise<DongResult> {
  const parsed = dongExpenseFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  await requireViewer();
  const supabase = await createClient();

  const group = await groupCurrency(parsed.data.groupId);
  if ("error" in group) return group;

  let amount: number;
  try {
    amount = toMinor(parsed.data.amount, group.currency);
  } catch {
    return { error: AMOUNT_ERROR };
  }
  if (amount <= 0) return { error: "مبلغ خرید باید بیشتر از صفر باشد." };

  const resolved = resolveShares(
    amount,
    parsed.data.splitMode,
    parsed.data.shares,
    group.currency,
  );
  if ("error" in resolved) return resolved;

  // One call, one transaction: the expense and its shares are checked against
  // each other at commit, so they cannot be written in two round trips.
  const { error } = await supabase.rpc("dong_save_expense", {
    p_group_id: parsed.data.groupId,
    p_title: parsed.data.title,
    p_amount: amount,
    p_paid_by: parsed.data.paidBy,
    p_occurred_on: parsed.data.occurredOn,
    p_split_mode: parsed.data.splitMode,
    p_shares: resolved.shares.map((share) => ({
      member_id: share.memberId,
      units: share.units,
      amount: share.amount,
    })),
    p_tag: parsed.data.tag || null,
    p_note: parsed.data.note || null,
    p_id: parsed.data.id ?? null,
  });

  if (error) return { error: GENERIC_ERROR };

  refresh(parsed.data.groupId);
  return { ok: true };
}

export async function deleteDongExpense(
  id: string,
  groupId: string,
): Promise<DongResult> {
  await requireViewer();
  const supabase = await createClient();

  // The shares go with it by cascade, which is what keeps the invariant true
  // through a delete: an expense that is gone has no bill left to cover.
  const { error } = await supabase.from("dong_expenses").delete().eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  refresh(groupId);
  return { ok: true };
}

/* ------------------------------------------------------------- payments -- */

export async function saveDongPayment(raw: unknown): Promise<DongResult> {
  const parsed = dongPaymentFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  const group = await groupCurrency(parsed.data.groupId);
  if ("error" in group) return group;

  let amount: number;
  try {
    amount = toMinor(parsed.data.amount, group.currency);
  } catch {
    return { error: AMOUNT_ERROR };
  }
  if (amount <= 0) return { error: "مبلغ پرداخت باید بیشتر از صفر باشد." };

  const payload = {
    group_id: parsed.data.groupId,
    user_id: viewer.userId,
    from_member_id: parsed.data.fromMemberId,
    to_member_id: parsed.data.toMemberId,
    amount,
    kind: parsed.data.kind,
    occurred_on: parsed.data.occurredOn,
    note: parsed.data.note || null,
  };

  const { error } = parsed.data.id
    ? await supabase.from("dong_payments").update(payload).eq("id", parsed.data.id)
    : await supabase.from("dong_payments").insert(payload);

  if (error) return { error: GENERIC_ERROR };

  refresh(parsed.data.groupId);
  return { ok: true };
}

export async function deleteDongPayment(
  id: string,
  groupId: string,
): Promise<DongResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase.from("dong_payments").delete().eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  refresh(groupId);
  return { ok: true };
}
