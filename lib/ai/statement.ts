import "server-only";

import { complete, MODEL, ModelError, type ChatContent } from "./openrouter";
import {
  MAX_STATEMENT_LINES,
  STATEMENT_JSON_SCHEMA,
  statementResultSchema,
  type StatementLine,
} from "./schemas";
import { statementParsePrompt } from "./prompts";
import { logUsage, remainingCalls } from "./usage";
import {
  normalise,
  spreadsheetChunks,
  type NormalisedLine,
} from "@/lib/import/normalise";
import type { IsoDate } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryRow } from "@/lib/supabase/database.types";

/**
 * Turning an uploaded statement file into rows this app can reason about.
 *
 * The model reads; it does not decide. Everything with a right answer —
 * which calendar a date is in, what a rial is in toman, whether a category
 * exists — is settled here, in code, after the model has spoken.
 */

/** Rows one import may hold, however many files it took. */
export const MAX_IMPORT_LINES = 1000;

/** Model calls one file may cost, however long it is. */
const MAX_CALLS_PER_FILE = 8;

/**
 * Longer than the 30s an interactive parse gets: two hundred rows of JSON is
 * a minute of generation on its own, and the alternative to waiting is an
 * import that fails on every statement worth importing.
 */
const STATEMENT_TIMEOUT_MS = 150_000;
const STATEMENT_MAX_TOKENS = 16_000;

export type StatementFile = {
  filename: string;
  mimeType: string;
  /** Base64, without the data: prefix. */
  data: string;
};

export type StatementReadOutcome =
  | { ok: true; lines: NormalisedLine[]; truncated: boolean }
  | { ok: false; error: string };

const FAILURE_MESSAGES: Record<ModelError["kind"], string> = {
  timeout: "خواندن این فایل طول کشید. اگر صورت‌حساب بلند است، ماه‌به‌ماه بفرست.",
  rate_limit: "الان شلوغ است. چند لحظه صبر کن و دوباره بزن.",
  provider: "اتصال قطع شد. فایل را نگه داشتم؛ دوباره بزن.",
  malformed: "این فایل را نتوانستم بخوانم. PDF یا CSV خودِ بانک بهتر جواب می‌دهد.",
};

export const IMPORT_LIMIT_REACHED =
  "امروز به سقف ۵۰ پردازش هوشمند رسیدی. فردا دوباره امتحان کن.";

const UNREADABLE =
  "در این فایل هیچ تراکنشی پیدا نکردم. مطمئن شو صفحه‌ی گردش حساب است، نه صفحه‌ی اول.";

export function isSpreadsheet(mimeType: string): boolean {
  return mimeType === "text/csv" || mimeType === "text/plain";
}

export function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

/**
 * Read one uploaded file. A spreadsheet export is chunked here, by row, which
 * is exact; a PDF or a photograph goes to the model whole, because splitting
 * one is guesswork and a row read twice is worse than a row read late.
 */
export async function readStatementFile({
  userId,
  file,
  timeZone,
  today,
  statementCurrency,
  baseCurrency,
  categories,
}: {
  userId: string;
  file: StatementFile;
  timeZone: string;
  today: IsoDate;
  statementCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  categories: CategoryRow[];
}): Promise<StatementReadOutcome> {
  const system = statementParsePrompt({
    currency: baseCurrency,
    statementCurrency,
    today,
    categories,
  });

  const chunks = isSpreadsheet(file.mimeType)
    ? spreadsheetChunks(decodeUtf8(file.data))
    : [null];

  if (chunks.length === 0) return { ok: false, error: UNREADABLE };

  const lines: NormalisedLine[] = [];
  let truncated = chunks.length > MAX_CALLS_PER_FILE;

  for (const chunk of chunks.slice(0, MAX_CALLS_PER_FILE)) {
    if ((await remainingCalls(timeZone)) <= 0) {
      await logUsage({ userId, feature: "parse_statement", model: MODEL, status: "rejected" });
      // Whatever was read before the ceiling is still worth offering.
      return lines.length > 0
        ? { ok: true, lines, truncated: true }
        : { ok: false, error: IMPORT_LIMIT_REACHED };
    }

    const outcome = await readOnce({
      userId,
      system,
      content: chunk === null ? fileContent(file) : [{ type: "text", text: chunk }],
    });

    if (!outcome.ok) {
      // A file that produced rows before failing still has those rows.
      return lines.length > 0
        ? { ok: true, lines, truncated: true }
        : { ok: false, error: outcome.error };
    }

    if (outcome.lines.length >= MAX_STATEMENT_LINES) truncated = true;

    for (const raw of outcome.lines) {
      const line = normalise(raw, { today, statementCurrency, baseCurrency, categories });
      if (line) lines.push(line);
      if (lines.length >= MAX_IMPORT_LINES) return { ok: true, lines, truncated: true };
    }
  }

  if (lines.length === 0) return { ok: false, error: UNREADABLE };
  return { ok: true, lines, truncated };
}

type ReadOnceOutcome =
  | { ok: true; lines: StatementLine[] }
  | { ok: false; error: string };

/** One model call, validated twice — the provider schema, then Zod. */
async function readOnce({
  userId,
  system,
  content,
}: {
  userId: string;
  system: string;
  content: ChatContent[];
}): Promise<ReadOnceOutcome> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await complete({
        system,
        content,
        jsonSchema: STATEMENT_JSON_SCHEMA,
        maxTokens: STATEMENT_MAX_TOKENS,
        timeoutMs: STATEMENT_TIMEOUT_MS,
      });

      const parsed = statementResultSchema.safeParse(safeJson(result.content));

      await logUsage({
        userId,
        feature: "parse_statement",
        model: MODEL,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCents: result.costCents,
        latencyMs: result.latencyMs,
        status: parsed.success ? "ok" : "malformed",
      });

      if (parsed.success) return { ok: true, lines: parsed.data.lines };
      if (attempt === 0) continue;
      return { ok: false, error: FAILURE_MESSAGES.malformed };
    } catch (error) {
      const kind = error instanceof ModelError ? error.kind : "provider";
      await logUsage({ userId, feature: "parse_statement", model: MODEL, status: kind });
      // A timeout or an outage will not be fixed by trying again immediately.
      if (kind !== "malformed" || attempt === 1) {
        return { ok: false, error: FAILURE_MESSAGES[kind] };
      }
    }
  }

  return { ok: false, error: FAILURE_MESSAGES.malformed };
}

function fileContent(file: StatementFile): ChatContent[] {
  const url = `data:${file.mimeType};base64,${file.data}`;

  if (isPdf(file.mimeType)) {
    return [
      { type: "file", file: { filename: file.filename, file_data: url } },
      { type: "text", text: "گردش حساب این صورت‌حساب را ردیف‌به‌ردیف برگردان." },
    ];
  }

  return [
    { type: "image_url", image_url: { url } },
    { type: "text", text: "گردش حساب این صورت‌حساب را ردیف‌به‌ردیف برگردان." },
  ];
}

function decodeUtf8(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf8");
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!fenced) return null;
    try {
      return JSON.parse(fenced[1]);
    } catch {
      return null;
    }
  }
}
