import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { todayInTimeZone } from "@/lib/date";
import { runParse } from "@/lib/ai/parse";
import { textParsePrompt } from "@/lib/ai/prompts";

// Vercel's default cap is shorter than the 30s the model call is allowed, so
// the platform would kill the request before we could return a Persian error.
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(3, "کمی بیشتر بنویس").max(1000),
});

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    // Not requireViewer: a redirect here answers fetch() with a 307 to /login,
    // whose HTML then breaks response.json() and the caller reports a dropped
    // connection instead of an expired session.
    return NextResponse.json(
      { ok: false, error: "نشستت تمام شده. دوباره وارد شو." },
      { status: 401 },
    );
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error: "متن را بنویس، مثل «۴۵ دلار خرید سوپرمارکت»." },
      { status: 400 },
    );
  }

  const categories = await listCategories();

  const outcome = await runParse({
    userId: viewer.userId,
    timeZone: viewer.timeZone,
    currency: viewer.currency,
    categories,
    feature: "parse_text",
    system: textParsePrompt({
      currency: viewer.currency,
      today: todayInTimeZone(viewer.timeZone),
      categories,
    }),
    content: [{ type: "text", text: parsedBody.data.text }],
    emptyMessage:
      "مبلغی در متن پیدا نکردم. عدد و ارز را بنویس، مثل «۴۵ دلار قهوه».",
  });

  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 422 });
}
