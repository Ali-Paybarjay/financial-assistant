import { z } from "zod";

/** "" is what a <select> gives for "none", and for an account that is an answer. */
const optionalAccountId = z.union([z.string().uuid(), z.literal("")]).optional();

export const transactionFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    type: z.enum(["expense", "income", "transfer"]),
    amount: z.string().trim().min(1, "مبلغ را بنویس"),
    /** Not required on a transfer: moving your own money is not a spend. */
    categorySlug: z.string().optional(),
    /**
     * Which account the money moved through. Empty is a real answer — cash out
     * of a pocket touches no account — so the select's "" is accepted rather
     * than rejected into a validation error the user cannot act on.
     */
    accountId: optionalAccountId,
    /** Only a transfer has one: the account the money arrived in. */
    toAccountId: optionalAccountId,
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را انتخاب کن"),
    merchant: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "transfer") {
      // A transfer that does not say where from and where to is not a
      // transfer; it is an amount with nowhere to be.
      if (!value.accountId) {
        context.addIssue({
          code: "custom",
          path: ["accountId"],
          message: "از کدام حساب؟",
        });
      }
      if (!value.toAccountId) {
        context.addIssue({
          code: "custom",
          path: ["toAccountId"],
          message: "به کدام حساب؟",
        });
      }
      if (value.accountId && value.accountId === value.toAccountId) {
        context.addIssue({
          code: "custom",
          path: ["toAccountId"],
          message: "مبدأ و مقصد یکی است. یکی‌شان را عوض کن.",
        });
      }
      return;
    }

    if (!value.categorySlug) {
      context.addIssue({
        code: "custom",
        path: ["categorySlug"],
        message: "دسته را انتخاب کن",
      });
    }
  });

export type TransactionForm = z.infer<typeof transactionFormSchema>;
