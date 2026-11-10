"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { categoryIdsBySlug } from "@/lib/queries/categories";
import { getImport } from "@/lib/queries/statements";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { convertibleFrom, isCurrencyCode, toMinor } from "@/lib/money";
import { REVIEWABLE_FIELDS } from "@/lib/ai/schemas";
import type { StatementImportRow } from "@/lib/supabase/database.types";
import {
  ACCEPTED_MIME_TYPES,
  FILE_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILES_PER_IMPORT,
} from "@/lib/import/limits";

/**
 * The write side of statement import. Reading the file is a route handler, not
 * an action, because it can take two minutes; everything else is an action.
 *
 * Nothing here trusts the client about money. The amount written to a
 * transaction comes from the stored statement line, never from the request:
 * the user may correct a category or a date in the review card, and may choose
 * which rows to take, but not what a row is worth.
 */

const GENERIC_ERROR = "انجام نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

function refresh() {
  revalidatePath("/import");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  // The hub carries the same month and the same balances.
  revalidatePath("/");
}

/**
 * Open an import. The statement's own unit is chosen here rather than guessed,
 * because an Iranian bank prints rial while the account holder keeps this app
 * in toman, and reading one as the other is a ten-fold error on every row.
 */
export async function startStatementImport(input: {
  sourceCurrency: string;
  /** Which account this is a statement of. "" or absent means none. */
  accountId?: string | null;
}): Promise<{ error: string } | { ok: true; importId: string }> {
  const viewer = await requireViewer();

  if (
    !isCurrencyCode(input.sourceCurrency) ||
    !convertibleFrom(viewer.currency).includes(input.sourceCurrency)
  ) {
    return {
      error: "این واحد با ارز پایه‌ی حسابت نمی‌خواند. اول ارز پایه را در تنظیمات عوض کن.",
    };
  }

  const supabase = await createClient();

  // One open import per account, not one overall. Two half-finished reports
  // over the same account is a way to import the same money twice; over two
  // different accounts it is just the user working through their accounts at
  // the start of the month, which is exactly what they are being asked to do.
  const clearing = supabase
    .from("statement_imports")
    .update({ status: "discarded" })
    .eq("user_id", viewer.userId)
    .in("status", ["uploading", "parsing", "review"]);

  const { error: clearError } = input.accountId
    ? await clearing.eq("account_id", input.accountId)
    : await clearing.is("account_id", null);

  if (clearError) return { error: GENERIC_ERROR };

  const { data, error } = await supabase
    .from("statement_imports")
    .insert({
      user_id: viewer.userId,
      status: "uploading",
      // Naming the account does two things: every row written from this file
      // lands on it, and reconciliation stops looking at other accounts' rows.
      account_id: input.accountId || null,
      source_currency: input.sourceCurrency,
      target_currency: viewer.currency,
    })
    .select("id")
    .single();

  if (error || !data) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true, importId: data.id };
}

/**
 * A one-time upload target, the same shape the receipt path uses: the file
 * goes straight to Storage and never meets the platform's request body ceiling.
 */
export async function createStatementUpload(input: {
  importId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<
  { error: string } | { ok: true; mediaAssetId: string; path: string; token: string }
> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return { error: "این نوع فایل را نمی‌خوانم. PDF، CSV یا عکس صفحه بفرست." };
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_FILE_BYTES) {
    return { error: "فایل بزرگ‌تر از ۱۵ مگابایت است. ماه‌به‌ماه بفرست." };
  }

  const statementImport = await getImport(input.importId);
  if (!statementImport || statementImport.status !== "uploading") {
    return { error: GENERIC_ERROR };
  }
  if (statementImport.file_count >= MAX_FILES_PER_IMPORT) {
    return { error: `در هر بار حداکثر ${MAX_FILES_PER_IMPORT} فایل می‌گیرم.` };
  }

  const extension = FILE_EXTENSIONS[input.mimeType] ?? "bin";
  const path = `${viewer.userId}/${crypto.randomUUID()}.${extension}`;

  const { data: upload, error: uploadError } = await supabase.storage
    .from("statements")
    .createSignedUploadUrl(path);

  if (uploadError || !upload) return { error: "آپلود شروع نشد. دوباره بزن." };

  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .insert({
      user_id: viewer.userId,
      kind: input.mimeType.startsWith("image/") ? "image" : "document",
      storage_path: path,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      status: "uploaded",
      statement_import_id: input.importId,
    })
    .select("id")
    .single();

  if (assetError || !asset) return { error: "آپلود شروع نشد. دوباره بزن." };

  await supabase
    .from("statement_imports")
    .update({ file_count: statementImport.file_count + 1 })
    .eq("id", input.importId);

  return { ok: true, mediaAssetId: asset.id, path, token: upload.token };
}

const applySchema = z.object({
  importId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        rowIndex: z.number().int().min(0),
        categorySlug: z.string().min(1),
        merchant: z.string().trim().max(120).nullable(),
        occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        /** Fields the user looked at and accepted or corrected. */
        resolved: z.array(z.enum(REVIEWABLE_FIELDS)),
      }),
    )
    .min(1)
    .max(1000),
});

export type ApplyResult =
  | { error: string }
  | {
      ok: true;
      imported: number;
      skipped: number;
      /**
       * Everything the balance step needs, returned rather than re-read: the
       * rows just written changed the balance, so a page refresh would race
       * the write it is meant to be reporting on.
       */
      balance: {
        accountTitle: string;
        /** The account's balance now, with the imported rows in it. */
        ours: number;
        /** What the statement said, if it printed anything we trust. */
        theirs: number | null;
        theirsOn: string | null;
      } | null;
    };

/**
 * Write the rows the user chose.
 *
 * One RPC, because the four writes this used to make were four commits with no
 * transaction around them — and the first of them was "mark these lines
 * imported". A failure after it left lines claimed with no transaction behind
 * them, and the retry, which only looks at rows still marked new, found nothing
 * to do and reported the import applied with zero rows imported. See migration
 * 0030 and F05.
 *
 * Still safe to call twice, and now for a better reason: the claim and the
 * insert share a commit, so a second call sees either both or neither.
 */
export async function applyStatementImport(raw: unknown): Promise<ApplyResult> {
  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) return { error: GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  const statementImport = await getImport(parsed.data.importId);
  if (!statementImport) return { error: GENERIC_ERROR };
  if (statementImport.status !== "review") {
    return { error: "این گزارش دیگر باز نیست. صفحه را تازه کن." };
  }
  // The base currency changed between reading the file and applying it. Every
  // stored amount is in the old one, so writing them now would be silent junk.
  if (statementImport.target_currency !== viewer.currency) {
    return {
      error: "از وقتی این صورت‌حساب را خواندم ارز پایه عوض شده. دوباره آپلودش کن.",
    };
  }

  // Slugs are resolved to ids out here, because the review card speaks slugs
  // and the ledger speaks ids. Read before the write rather than between two
  // halves of it: this is the read whose failure used to strand claimed lines.
  const categories = await categoryIdsBySlug();

  const { data, error } = await supabase.rpc("apply_statement_lines", {
    p_import_id: statementImport.id,
    p_lines: parsed.data.lines.map((line) => ({
      row_index: line.rowIndex,
      category_id: categories.get(line.categorySlug) ?? null,
      merchant: line.merchant,
      occurred_on: line.occurredOn,
      resolved: line.resolved,
    })),
  });

  if (error) return { error: GENERIC_ERROR };

  const outcome = data?.[0];
  if (!outcome) return { error: GENERIC_ERROR };

  refresh();

  return {
    ok: true,
    imported: outcome.imported,
    skipped: outcome.skipped,
    balance: await balanceStep(statementImport),
  };
}

/**
 * The state the balance step opens on: what the app now thinks the account
 * holds, beside what the bank said it holds. Null when the statement was not
 * filed against an account, which is every import made before accounts
 * existed and any made from the general import page.
 */
async function balanceStep(
  statementImport: StatementImportRow,
): Promise<Extract<ApplyResult, { ok: true }>["balance"]> {
  if (!statementImport.account_id) return null;

  const accounts = await listAccountsWithBalances();
  const account = accounts.find((entry) => entry.id === statementImport.account_id);
  if (!account) return null;

  return {
    accountTitle: account.title,
    ours: account.balance,
    theirs: statementImport.closing_balance,
    theirsOn: statementImport.closing_balance_on,
  };
}

/** Walk away from an import. The lines stay; nothing was written from them. */
export async function discardStatementImport(
  importId: string,
): Promise<{ error: string } | { ok: true }> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("statement_imports")
    .update({ status: "discarded" })
    .eq("id", importId)
    .in("status", ["uploading", "parsing", "review", "failed"]);

  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { ok: true };
}

/**
 * Accept what the statement said the account holds.
 *
 * This is the other half of an update, and the more important one: importing
 * the missing rows closes the gap the app knows about, and this closes the gap
 * it does not. Whatever difference is left after the rows were added — a fee
 * nobody itemised, a row the model dropped, a purchase from before the account
 * existed — is absorbed by moving the anchor rather than hunted for.
 *
 * The amount comes from the request rather than from the stored import, and
 * deliberately: the report shows the bank's figure as a guess the user can
 * correct, the same as every other thing read off a page. What it cannot do is
 * change anything already recorded.
 */
export async function applyStatementBalance(input: {
  importId: string;
  balance: string;
  balanceOn: string;
}): Promise<{ error: string } | { ok: true }> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.balanceOn)) return { error: GENERIC_ERROR };

  const statementImport = await getImport(input.importId);
  if (!statementImport?.account_id) return { error: GENERIC_ERROR };
  if (statementImport.target_currency !== viewer.currency) {
    return { error: "از وقتی این صورت‌حساب را خواندم ارز پایه عوض شده. دوباره آپلودش کن." };
  }

  let balance: number;
  try {
    balance = toMinor(input.balance, viewer.currency);
  } catch {
    return { error: "موجودی عدد نیست. فقط رقم بنویس، مثل ۱۲۰۰۰۰۰." };
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      opening_balance: balance,
      opening_balance_on: input.balanceOn,
      /**
       * A statement's closing figure is the end of its last day: that day's
       * transactions are already inside it.
       *
       * This used to be written with no basis at all, so it inherited the
       * start-of-day reading the account form uses — and the balance function
       * then subtracted the anchor day's rows a second time. An account at 100
       * with a 20 expense on 30 September and a printed closing balance of 80
       * came out at 60 the moment the user confirmed that the bank agreed with
       * them. F02.
       */
      opening_balance_basis: "end_of_day" as const,
    })
    .eq("id", statementImport.account_id);

  if (error) return { error: GENERIC_ERROR };

  await supabase
    .from("statement_imports")
    .update({ balance_applied: true })
    .eq("id", statementImport.id);

  refresh();
  return { ok: true };
}
