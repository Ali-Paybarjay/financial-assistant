"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { categoryIdsBySlug } from "@/lib/queries/categories";
import { getImport } from "@/lib/queries/statements";
import { convertibleFrom, isCurrencyCode } from "@/lib/money";
import { REVIEWABLE_FIELDS } from "@/lib/ai/schemas";
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
}

/**
 * Open an import. The statement's own unit is chosen here rather than guessed,
 * because an Iranian bank prints rial while the account holder keeps this app
 * in toman, and reading one as the other is a ten-fold error on every row.
 */
export async function startStatementImport(input: {
  sourceCurrency: string;
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

  // Only one import may be open at a time: two half-finished reports of
  // overlapping periods is a way to import the same money twice.
  await supabase
    .from("statement_imports")
    .update({ status: "discarded" })
    .eq("user_id", viewer.userId)
    .in("status", ["uploading", "parsing", "review"]);

  const { data, error } = await supabase
    .from("statement_imports")
    .insert({
      user_id: viewer.userId,
      status: "uploading",
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
  | { ok: true; imported: number; skipped: number };

/**
 * Write the rows the user chose.
 *
 * The line's status is what makes this safe to call twice: flipping it from
 * "new" to "imported" is a conditional update, so a second request finds
 * nothing left to claim and writes nothing. The unique index on
 * transactions.statement_line_id is the backstop under that.
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

  const edits = new Map(parsed.data.lines.map((line) => [line.rowIndex, line]));

  // Claim the rows. Whatever comes back is what this request is responsible
  // for; anything already imported by an earlier attempt is not in it.
  const { data: claimed, error: claimError } = await supabase
    .from("statement_lines")
    .update({ match_status: "imported" })
    .eq("import_id", statementImport.id)
    .eq("match_status", "new")
    .in("row_index", [...edits.keys()])
    .select("*");

  if (claimError) return { error: GENERIC_ERROR };

  const categories = await categoryIdsBySlug();

  const rows = (claimed ?? []).map((line) => {
    const edit = edits.get(line.row_index)!;
    const needsReview = line.needs_review.filter(
      (field) => !edit.resolved.includes(field as (typeof REVIEWABLE_FIELDS)[number]),
    );

    return {
      user_id: viewer.userId,
      type: line.direction === "in" ? ("income" as const) : ("expense" as const),
      // From the stored line, never from the request.
      amount: line.amount,
      currency: statementImport.target_currency,
      category_id: categories.get(edit.categorySlug) ?? null,
      merchant: edit.merchant || line.merchant,
      // The bank's own wording is the note, so the row can always be traced
      // back to the statement it came from.
      note: line.description,
      occurred_on: edit.occurredOn,
      source: "statement" as const,
      statement_line_id: line.id,
      ai_confidence: line.ai_confidence,
      is_confirmed: needsReview.length === 0,
      needs_review: needsReview,
    };
  });

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("transactions").insert(rows);
    if (insertError) {
      // Hand the rows back so the user can try again rather than losing them.
      await supabase
        .from("statement_lines")
        .update({ match_status: "new" })
        .eq("import_id", statementImport.id)
        .in(
          "row_index",
          (claimed ?? []).map((line) => line.row_index),
        );
      return { error: GENERIC_ERROR };
    }
  }

  // Everything still unclaimed is a row the user chose to leave.
  const { data: skipped } = await supabase
    .from("statement_lines")
    .update({ match_status: "skipped" })
    .eq("import_id", statementImport.id)
    .eq("match_status", "new")
    .select("row_index");

  await supabase
    .from("statement_imports")
    .update({
      status: "applied",
      imported_count: rows.length,
      applied_at: new Date().toISOString(),
    })
    .eq("id", statementImport.id);

  refresh();
  return { ok: true, imported: rows.length, skipped: skipped?.length ?? 0 };
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
