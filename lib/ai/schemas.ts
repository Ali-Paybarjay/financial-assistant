import { z } from "zod";

/**
 * The contract the model must honour. It is enforced twice: once by the
 * provider through a JSON schema, and once here by Zod after the response
 * comes back. The second pass is not redundant — schema enforcement on
 * OpenRouter varies by provider, and a well-formed object can still carry a
 * category the user does not have.
 */

export const MAX_TRANSACTIONS = 10;

/** Field names the confirm card can mark as guessed. */
export const REVIEWABLE_FIELDS = ["amount", "category", "merchant", "date"] as const;
export type ReviewableField = (typeof REVIEWABLE_FIELDS)[number];

export const FIELD_LABELS: Record<ReviewableField, string> = {
  amount: "مبلغ",
  category: "دسته",
  merchant: "فروشنده",
  date: "تاریخ",
};

export const parsedTransactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  /** Minor units. The prompt tells the model this currency's decimal places. */
  amount_minor: z.number().int().positive(),
  currency: z.string().length(3),
  category_slug: z.string().min(1),
  merchant: z.string().nullable(),
  note: z.string().nullable(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().min(0).max(1),
  needs_review: z.array(z.enum(REVIEWABLE_FIELDS)),
});

export const parseResultSchema = z.object({
  transactions: z.array(parsedTransactionSchema).max(MAX_TRANSACTIONS),
});

export type ParsedTransaction = z.infer<typeof parsedTransactionSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;

/**
 * The same shape as JSON Schema, for the provider. Kept next to the Zod
 * version on purpose: when one changes the other has to, and separating them
 * is how they drift.
 */
export const PARSE_JSON_SCHEMA = {
  name: "parsed_transactions",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["transactions"],
    properties: {
      transactions: {
        type: "array",
        maxItems: MAX_TRANSACTIONS,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "type",
            "amount_minor",
            "currency",
            "category_slug",
            "merchant",
            "note",
            "occurred_on",
            "confidence",
            "needs_review",
          ],
          properties: {
            type: { type: "string", enum: ["expense", "income"] },
            amount_minor: {
              type: "integer",
              description: "Amount in minor units (cents). 45.50 is 4550.",
            },
            currency: { type: "string" },
            category_slug: {
              type: "string",
              description: "Must be one of the slugs listed in the prompt.",
            },
            merchant: { type: ["string", "null"] },
            note: { type: ["string", "null"] },
            occurred_on: { type: "string", description: "YYYY-MM-DD" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            needs_review: {
              type: "array",
              items: {
                type: "string",
                enum: [...REVIEWABLE_FIELDS],
              },
              description:
                "Fields that were inferred rather than stated. Never include amount: if the amount is unclear, do not return the transaction at all.",
            },
          },
        },
      },
    },
  },
} as const;

/* ----------------------------------------------------------- statements -- */

/**
 * The second model contract: one row of a bank statement. It lives beside the
 * first on purpose — when the reviewable fields or the category fallbacks
 * change, both have to change, and keeping them apart is how they drift.
 *
 * Two things this contract deliberately does NOT ask the model to do:
 *
 *  - convert a date. Iranian statements print 1404/06/26, so the model reports
 *    the date as printed plus which calendar it is, and `lib/jalali.ts` does
 *    the arithmetic. A model that mis-converts files a transaction in the
 *    wrong month and nothing downstream can notice.
 *  - decide whether a row is already recorded. That is reconciliation, it is
 *    arithmetic, and it belongs in `lib/import/reconcile.ts`.
 */

/** Rows one model call may return. A statement page holds far fewer. */
export const MAX_STATEMENT_LINES = 150;

export const statementLineSchema = z.object({
  /** As printed, normalised to year-month-day order but NOT converted. */
  date: z.string().regex(/^\d{1,4}-\d{1,2}-\d{1,2}$/),
  calendar: z.enum(["jalali", "gregorian"]),
  direction: z.enum(["in", "out"]),
  /** Minor units of the statement currency, not of the base currency. */
  amount_minor: z.number().int().positive(),
  /** Verbatim, so the user can always see what the bank actually wrote. */
  description: z.string(),
  merchant: z.string().nullable(),
  category_slug: z.string().min(1),
  confidence: z.number().min(0).max(1),
  needs_review: z.array(z.enum(REVIEWABLE_FIELDS)),
});

export const statementResultSchema = z.object({
  /** Total pages in the document, so the server can window through a long one. */
  page_count: z.number().int().positive().nullable(),
  lines: z.array(statementLineSchema).max(MAX_STATEMENT_LINES),
});

export type StatementLine = z.infer<typeof statementLineSchema>;
export type StatementResult = z.infer<typeof statementResultSchema>;

export const STATEMENT_JSON_SCHEMA = {
  name: "statement_rows",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["page_count", "lines"],
    properties: {
      page_count: {
        type: ["integer", "null"],
        description:
          "How many pages the whole document has, null if that cannot be told.",
      },
      lines: {
        type: "array",
        maxItems: MAX_STATEMENT_LINES,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "date",
            "calendar",
            "direction",
            "amount_minor",
            "description",
            "merchant",
            "category_slug",
            "confidence",
            "needs_review",
          ],
          properties: {
            date: {
              type: "string",
              description:
                "The date as printed, rewritten as YEAR-MONTH-DAY. Do not convert between calendars.",
            },
            calendar: {
              type: "string",
              enum: ["jalali", "gregorian"],
              description:
                "jalali for a Persian date such as 1404-06-26, gregorian for 2025-09-17.",
            },
            direction: {
              type: "string",
              enum: ["in", "out"],
              description: "in = money arrived, out = money left the account.",
            },
            amount_minor: {
              type: "integer",
              description:
                "The amount of this row in minor units, never the running balance.",
            },
            description: {
              type: "string",
              description: "The row description exactly as printed.",
            },
            merchant: { type: ["string", "null"] },
            category_slug: {
              type: "string",
              description: "Must be one of the slugs listed in the prompt.",
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            needs_review: {
              type: "array",
              items: { type: "string", enum: [...REVIEWABLE_FIELDS] },
              description:
                "Fields inferred rather than read. Never include amount: if the amount is unclear, omit the row.",
            },
          },
        },
      },
    },
  },
} as const;
