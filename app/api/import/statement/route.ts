import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCategories, categoryIdsBySlug } from "@/lib/queries/categories";
import { listTransactions } from "@/lib/queries/transactions";
import { addDays, todayInTimeZone } from "@/lib/date";
import { isCurrencyCode } from "@/lib/money";
import { readStatementFile } from "@/lib/ai/statement";
import type { NormalisedLine } from "@/lib/import/normalise";
import type { MediaStatus } from "@/lib/supabase/database.types";
import {
  MATCH_WINDOW_DAYS,
  reconcile,
  summarise,
  type ReconcilableLine,
} from "@/lib/import/reconcile";

/**
 * Read an uploaded statement and work out what of it is new.
 *
 * A route handler rather than a server action because it is slow: several
 * model calls, each generating hundreds of rows of JSON. Everything it decides
 * is written to statement_lines, and the page renders the report from there —
 * so a user who closes the tab mid-read comes back to a finished report rather
 * than to nothing.
 */
export const maxDuration = 300;

const bodySchema = z.object({ importId: z.string().uuid() });

const GENERIC_ERROR = "خواندن صورت‌حساب انجام نشد. دوباره بزن.";

export async function POST(request: NextRequest) {
  const viewer = await requireViewer();

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 400 });
  }

  const supabase = await createClient();

  // Read through the user's own client: RLS, not this code, is what stops one
  // user pointing at another's import.
  const { data: statementImport } = await supabase
    .from("statement_imports")
    .select("*")
    .eq("id", parsedBody.data.importId)
    .maybeSingle();

  if (!statementImport) {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 404 });
  }
  if (statementImport.status !== "uploading" && statementImport.status !== "failed") {
    return NextResponse.json(
      { ok: false, error: "این صورت‌حساب قبلاً خوانده شده. صفحه را تازه کن." },
      { status: 409 },
    );
  }
  if (
    !isCurrencyCode(statementImport.source_currency) ||
    statementImport.target_currency !== viewer.currency
  ) {
    return NextResponse.json(
      { ok: false, error: "ارز پایه عوض شده. صورت‌حساب را دوباره آپلود کن." },
      { status: 409 },
    );
  }

  const { data: assets } = await supabase
    .from("media_assets")
    .select("id, storage_path, mime_type")
    .eq("statement_import_id", statementImport.id)
    .order("created_at", { ascending: true });

  if (!assets?.length) {
    return await fail(statementImport.id, "هیچ فایلی آپلود نشده بود.");
  }

  await supabase
    .from("statement_imports")
    .update({ status: "parsing", error_message: null })
    .eq("id", statementImport.id);

  const categories = await listCategories();
  const today = todayInTimeZone(viewer.timeZone);
  const admin = createAdminClient();

  const collected: NormalisedLine[] = [];
  let truncated = false;
  let firstError: string | undefined;

  for (const asset of assets) {
    // The bucket is private, so downloading needs the service role. The row
    // itself was already read through the user's client above.
    const { data: file, error: downloadError } = await admin.storage
      .from("statements")
      .download(asset.storage_path);

    if (downloadError || !file) {
      firstError ??= "یکی از فایل‌ها باز نشد. دوباره آپلودش کن.";
      await markAsset(asset.id, "failed", firstError);
      continue;
    }

    await markAsset(asset.id, "processing", null);

    const outcome = await readStatementFile({
      userId: viewer.userId,
      timeZone: viewer.timeZone,
      today,
      statementCurrency: statementImport.source_currency,
      baseCurrency: viewer.currency,
      categories,
      file: {
        filename: asset.storage_path.split("/").pop() ?? "statement",
        mimeType: asset.mime_type,
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
      },
    });

    if (!outcome.ok) {
      firstError ??= outcome.error;
      await markAsset(asset.id, "failed", outcome.error);
      continue;
    }

    collected.push(...outcome.lines);
    truncated ||= outcome.truncated;
    await markAsset(asset.id, "parsed", null);
  }

  if (collected.length === 0) {
    return await fail(statementImport.id, firstError ?? GENERIC_ERROR);
  }

  // Oldest first, ties broken by the order the files were read, so the row
  // numbering — and therefore reconciliation — is reproducible.
  const ordered = collected
    .map((line, sequence) => ({ line, sequence }))
    .sort(
      (a, b) =>
        a.line.occurredOn.localeCompare(b.line.occurredOn) || a.sequence - b.sequence,
    )
    .map((entry) => entry.line);

  const periodFrom = ordered[0].occurredOn;
  const periodTo = ordered[ordered.length - 1].occurredOn;

  const reconcilable: ReconcilableLine[] = ordered.map((line, rowIndex) => ({
    rowIndex,
    occurredOn: line.occurredOn,
    direction: line.direction,
    amount: line.amount,
  }));

  // Widened by the match window at both ends: a purchase on the first day of
  // the statement may have been logged in the app three days earlier.
  const ledger = await listTransactions({
    from: addDays(periodFrom, -MATCH_WINDOW_DAYS),
    to: addDays(periodTo, MATCH_WINDOW_DAYS),
  });

  const results = reconcile(
    reconcilable,
    ledger.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      occurredOn: row.occurred_on,
    })),
  );
  const summary = summarise(reconcilable, results);

  const categoryIds = await categoryIdsBySlug();

  // A re-read of the same import replaces its lines wholesale. Nothing was
  // written from them yet — this path is only reachable before review.
  await supabase.from("statement_lines").delete().eq("import_id", statementImport.id);

  const { error: insertError } = await supabase.from("statement_lines").insert(
    ordered.map((line, rowIndex) => {
      const match = results[rowIndex].match;
      return {
        import_id: statementImport.id,
        user_id: viewer.userId,
        row_index: rowIndex,
        occurred_on: line.occurredOn,
        direction: line.direction,
        amount: line.amount,
        description: line.description,
        merchant: line.merchant,
        category_id: categoryIds.get(line.categorySlug) ?? null,
        ai_confidence: line.confidence,
        needs_review: line.needsReview,
        match_status: match ? ("matched" as const) : ("new" as const),
        matched_transaction_id: match?.transactionId ?? null,
        match_day_gap: match?.dayGap ?? null,
      };
    }),
  );

  if (insertError) return await fail(statementImport.id, GENERIC_ERROR);

  await supabase
    .from("statement_imports")
    .update({
      status: "review",
      period_from: periodFrom,
      period_to: periodTo,
      line_count: summary.total,
      matched_count: summary.matched,
      new_count: summary.fresh,
      error_message: null,
    })
    .eq("id", statementImport.id);

  return NextResponse.json({
    ok: true,
    total: summary.total,
    matched: summary.matched,
    fresh: summary.fresh,
    truncated,
    // Some files read and some did not: the report is real but partial, and
    // saying so is better than a clean-looking report that is missing a page.
    warning: firstError,
  });

  async function markAsset(id: string, status: MediaStatus, message: string | null) {
    await supabase
      .from("media_assets")
      .update({ status, error_message: message })
      .eq("id", id);
  }

  async function fail(id: string, message: string) {
    await supabase
      .from("statement_imports")
      .update({ status: "failed", error_message: message })
      .eq("id", id);
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
