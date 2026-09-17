import { z } from "zod";

export const transactionFormSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["expense", "income"]),
  amount: z.string().trim().min(1, "مبلغ را بنویس"),
  categorySlug: z.string().min(1, "دسته را انتخاب کن"),
  /**
   * Which account the money moved through. Empty is a real answer — cash out
   * of a pocket touches no account — so the select's "" is accepted rather
   * than rejected into a validation error the user cannot act on.
   */
  accountId: z.union([z.string().uuid(), z.literal("")]).optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را انتخاب کن"),
  merchant: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

export type TransactionForm = z.infer<typeof transactionFormSchema>;
