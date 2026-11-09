import "server-only";

import { complete, MODEL, ModelError, type ChatContent } from "./openrouter";
import { PARSE_JSON_SCHEMA, parseResultSchema, type ParsedTransaction } from "./schemas";
import { reserveCall, settleCall, type Allowance, type UsageRecord } from "./usage";
import { faNumber } from "@/lib/format";
import type { CategoryRow } from "@/lib/supabase/database.types";

export type ParseFailure = { ok: false; error: string };
export type ParseSuccess = { ok: true; transactions: ParsedTransaction[] };
export type ParseOutcome = ParseSuccess | ParseFailure;

/**
 * The number has to come from the allowance rather than sit in the string: a
 * guest and a signed-up user hit different ceilings, and a message naming the
 * wrong one reads as a bug in the counter. A guest is also told the way out,
 * because for them it is not "wait until tomorrow" — an account raises it now.
 */
export function limitReachedMessage({ limit, isGuest, disabled }: Allowance): string {
  // Nothing to do with this user's ceiling, so it must not name one: «تا فردا
  // صبر کن» would be false, and «سقف ۰» would read as a bug in the counter.
  if (disabled) {
    return "پردازش هوشمند فعلاً خاموش است. با فرم ثبت کن؛ هیچ‌چیز از دست نمی‌رود.";
  }

  const ceiling = `امروز به سقف ${faNumber(limit)} پردازش هوشمند رسیدی.`;
  return isGuest
    ? `${ceiling} مهمان‌ها سهم کمتری دارند؛ حساب بساز تا بیشتر شود، یا فعلاً با فرم ثبت کن.`
    : `${ceiling} تا فردا با فرم ثبت کن.`;
}

const FAILURE_MESSAGES: Record<ModelError["kind"], string> = {
  timeout: "طول کشید و جواب نداد. دوباره بزن، یا با فرم ثبت کن.",
  rate_limit: "الان شلوغ است. چند لحظه صبر کن و دوباره بزن.",
  provider: "اتصال قطع شد. متن را نگه داشتم؛ دوباره بزن.",
  malformed: "نتوانستم درست بخوانمش. کمی واضح‌تر بنویس، یا با فرم ثبت کن.",
};

/**
 * The one path every AI extraction goes through. Model output is validated
 * twice — the provider's JSON schema, then Zod here — and a category the user
 * does not actually have is treated as a parse failure rather than silently
 * written as null.
 */
export async function runParse({
  timeZone,
  currency,
  categories,
  feature,
  system,
  content,
  emptyMessage,
}: {
  /**
   * No `userId`.
   *
   * It used to be passed in so the usage row could be written with it. The
   * reservation function takes the user from `auth.uid()` instead, because a
   * caller that supplies its own user id is a caller that can write somebody
   * else's quota — and the count that authorises a call now happens inside the
   * same transaction as the row. F12.
   */
  timeZone: string;
  currency: string;
  categories: CategoryRow[];
  feature: UsageRecord["feature"];
  system: string;
  content: ChatContent[];
  /** Shown when the model read the input but found nothing to record. */
  emptyMessage: string;
}): Promise<ParseOutcome> {
  /**
   * Claimed before the call, not counted before it.
   *
   * The reservation and the count that authorised it share one transaction, so
   * two requests arriving together cannot both be told there is room. The row it
   * returns is the one settled below with what the call cost. F12.
   */
  const reservation = await reserveCall(timeZone, feature, MODEL);
  if (!reservation.id) {
    // The refusal is already recorded by the reservation function — it writes a
    // `rejected` row, because «how often do people hit the ceiling» cannot be
    // answered from calls that were never made.
    return { ok: false, error: limitReachedMessage(reservation.allowance) };
  }
  const reservationId = reservation.id;

  const allowedSlugs = new Set(categories.map((category) => category.slug));

  // One retry, as the brief requires. Schema enforcement on OpenRouter is
  // provider-dependent, so a malformed body is unlikely but not impossible.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await complete({
        system,
        content,
        jsonSchema: PARSE_JSON_SCHEMA,
      });

      const parsed = parseResultSchema.safeParse(safeJson(result.content));

      if (!parsed.success) {
        await settleCall(reservationId, {
          feature,
          model: MODEL,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costCents: result.costCents,
          latencyMs: result.latencyMs,
          status: "malformed",
        });
        if (attempt === 0) continue;
        return { ok: false, error: FAILURE_MESSAGES.malformed };
      }

      await settleCall(reservationId, {
        feature,
        model: MODEL,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCents: result.costCents,
        latencyMs: result.latencyMs,
        status: "ok",
      });

      const transactions = parsed.data.transactions
        .filter((transaction) => allowedSlugs.has(transaction.category_slug))
        .map((transaction) => ({
          ...transaction,
          // The user has one currency in this version; whatever the model
          // inferred from the text does not override their profile.
          currency,
        }));

      if (transactions.length === 0) return { ok: false, error: emptyMessage };
      return { ok: true, transactions };
    } catch (error) {
      const kind = error instanceof ModelError ? error.kind : "provider";
      await settleCall(reservationId, { feature, model: MODEL, status: kind });
      // A timeout or an outage will not be fixed by trying again immediately.
      if (kind !== "malformed" || attempt === 1) {
        return { ok: false, error: FAILURE_MESSAGES[kind] };
      }
    }
  }

  return { ok: false, error: FAILURE_MESSAGES.malformed };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Some providers still wrap JSON in a fenced block despite the schema.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!fenced) return null;
    try {
      return JSON.parse(fenced[1]);
    } catch {
      return null;
    }
  }
}
