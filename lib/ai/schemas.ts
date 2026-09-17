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
