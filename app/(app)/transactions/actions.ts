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
  // Every balance on that page is derived from these rows.
  revalidatePath("/accounts");
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

  const isTransfer = parsed.data.type === "transfer";

  const payload = {
    user_id: viewer.userId,
    type: parsed.data.type,
    amount,
    currency: viewer.currency,
    // A transfer has no category: moving your own money is not a spend, and
    // giving it one would put it in the donut beside things that were.
    category_id: isTransfer
      ? null
      : (categories.get(parsed.data.categorySlug ?? "") ?? null),
    // "" is the user choosing no account, and is stored as such. RLS is what
    // stops an id belonging to someone else being written here.
    account_id: parsed.data.accountId || null,
    to_account_id: isTransfer ? parsed.data.toAccountId || null : null,
    merchant: isTransfer ? null : parsed.data.merchant || null,
    note: parsed.data.note || null,
    occurred_on: parsed.data.occurredOn,
    // Income is never goal money, so changing a row's type to income has to
    // drop the goal with it rather than leave a tag the database would refuse.
    goal_id: parsed.data.type === "income" ? null : parsed.data.goalId || null,
    is_confirmed: true,
    needs_review: [],
  };

  // `source` is where a row came from, and editing a row does not change that.
  // Writing "form" on update erased it: correcting a receipt's merchant, or
  // reclassifying an imported outflow as a transfer, would leave a row that
  // claims the user typed it by hand — and statement_line_id still pointing at
  // the statement it now denies. It is set once, when the row is created.
  const { error } = parsed.data.id
    ? await supabase.from("transactions").update(payload).eq("id", parsed.data.id)
    : await supabase
        .from("transactions")
        .insert({ ...payload, source: "form" as const });

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

/**
 * A one-time upload target for a receipt. The client PUTs the compressed image
 * straight to Storage with this token, so the file never passes through a
 * route handler and never meets the platform's request body ceiling.
 */
export async function createReceiptUpload(input: {
  mimeType: string;
  sizeBytes: number;
}): Promise<
  { error: string } | { ok: true; mediaAssetId: string; path: string; token: string }
> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowed.includes(input.mimeType)) {
    return { error: "این نوع فایل را نمی‌خوانم. عکس JPG یا PNG بفرست." };
  }
  if (input.sizeBytes > 5 * 1024 * 1024) {
    return { error: "عکس بزرگ‌تر از ۵ مگابایت است. دوباره از فاکتور عکس بگیر." };
  }

  const extension = input.mimeType.split("/")[1].replace("jpeg", "jpg");
  const path = `${viewer.userId}/${crypto.randomUUID()}.${extension}`;

  const { data: upload, error: uploadError } = await supabase.storage
    .from("receipts")
    .createSignedUploadUrl(path);

  if (uploadError || !upload) return { error: "آپلود شروع نشد. دوباره بزن." };

  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .insert({
      user_id: viewer.userId,
      kind: "image",
      storage_path: path,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (assetError || !asset) return { error: "آپلود شروع نشد. دوباره بزن." };

  return { ok: true, mediaAssetId: asset.id, path, token: upload.token };
}

/**
 * Writes what the user confirmed in the confirm card. Rows keep is_confirmed
 * false when the user accepted a field the model had guessed, so the
 * confidence rule still marks them in the list and in the month's total.
 */
export async function saveParsedTransactions(input: {
  transactions: {
    type: "expense" | "income";
    amountMinor: number;
    categorySlug: string;
    merchant: string | null;
    note: string | null;
    occurredOn: string;
    confidence: number;
    needsReview: string[];
  }[];
  source: "text" | "receipt";
  mediaAssetId?: string;
  /** Chosen once in the confirm card and applied to every row of it. */
  accountId?: string | null;
  /** Likewise: one photographed receipt is one purchase, for one goal. */
  goalId?: string | null;
}): Promise<SaveTransactionResult> {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const categories = await categoryIdsBySlug();

  if (input.transactions.length === 0) return { error: GENERIC_ERROR };

  const rows = input.transactions.map((transaction) => ({
    user_id: viewer.userId,
    type: transaction.type,
    amount: transaction.amountMinor,
    currency: viewer.currency,
    category_id: categories.get(transaction.categorySlug) ?? null,
    account_id: input.accountId || null,
    // Income is never goal money, and the database refuses it there. A parse
    // that returns a mix of rows keeps the goal on the spends only.
    goal_id: transaction.type === "income" ? null : input.goalId || null,
    merchant: transaction.merchant,
    note: transaction.note,
    occurred_on: transaction.occurredOn,
    source: input.source,
    media_asset_id: input.mediaAssetId ?? null,
    ai_confidence: transaction.confidence,
    is_confirmed: transaction.needsReview.length === 0,
    needs_review: transaction.needsReview,
  }));

  if (rows.some((row) => row.amount <= 0)) return { error: GENERIC_ERROR };

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) return { error: GENERIC_ERROR };

  refresh();

  const { from, to } = monthRange(viewer.timeZone, rows[0].occurred_on);
  const totals = await monthTotals(from, to);
  return {
    ok: true,
    balanceText: formatMoney(totals.income - totals.expense, viewer.currency, {
      signed: true,
    }),
  };
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
