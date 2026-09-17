import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCategories } from "@/lib/queries/categories";
import { todayInTimeZone } from "@/lib/date";
import { runParse } from "@/lib/ai/parse";
import { receiptParsePrompt } from "@/lib/ai/prompts";

export const maxDuration = 60;

const bodySchema = z.object({ mediaAssetId: z.string().uuid() });

const UNREADABLE =
  "فاکتور خوانا نبود. از مبلغ کل عکس بگیر یا مبلغ را دستی بزن.";

export async function POST(request: NextRequest) {
  const viewer = await requireViewer();

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, error: UNREADABLE }, { status: 400 });
  }

  // Read the asset through the user's own client, so RLS — not this code — is
  // what stops one user pointing at another's receipt.
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, storage_path, mime_type")
    .eq("id", parsedBody.data.mediaAssetId)
    .single();

  if (!asset) {
    return NextResponse.json({ ok: false, error: UNREADABLE }, { status: 404 });
  }

  // The image never travels through this handler on the way in: the client
  // uploaded it straight to Storage, which keeps it clear of the platform's
  // request body ceiling. Downloading it here needs the service role because
  // the bucket is private.
  const { data: file, error: downloadError } = await createAdminClient()
    .storage.from("receipts")
    .download(asset.storage_path);

  if (downloadError || !file) {
    return NextResponse.json({ ok: false, error: UNREADABLE }, { status: 422 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const categories = await listCategories();

  await supabase
    .from("media_assets")
    .update({ status: "processing" })
    .eq("id", asset.id);

  const outcome = await runParse({
    userId: viewer.userId,
    timeZone: viewer.timeZone,
    currency: viewer.currency,
    categories,
    feature: "parse_receipt",
    system: receiptParsePrompt({
      currency: viewer.currency,
      today: todayInTimeZone(viewer.timeZone),
      categories,
    }),
    content: [
      {
        type: "image_url",
        image_url: { url: `data:${asset.mime_type};base64,${base64}` },
      },
      { type: "text", text: "این فاکتور را بخوان و مبلغ کل را برگردان." },
    ],
    emptyMessage: UNREADABLE,
  });

  await supabase
    .from("media_assets")
    .update({
      status: outcome.ok ? "parsed" : "failed",
      extracted: outcome.ok ? { transactions: outcome.transactions } : null,
      error_message: outcome.ok ? null : outcome.error,
    })
    .eq("id", asset.id);

  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 422 });
}
