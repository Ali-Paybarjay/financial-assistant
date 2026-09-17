import { z } from "zod";

/** The kinds an account can be, in the order the form offers them. */
export const ACCOUNT_KIND_OPTIONS = [
  { value: "checking", label: "حساب جاری" },
  { value: "savings", label: "پس‌انداز" },
  { value: "card", label: "کارت اعتباری" },
  { value: "cash", label: "پول نقد" },
  { value: "other", label: "دیگر" },
] as const;

export type AccountKindValue = (typeof ACCOUNT_KIND_OPTIONS)[number]["value"];

export const ACCOUNT_KIND_LABEL = new Map<string, string>(
  ACCOUNT_KIND_OPTIONS.map((option) => [option.value, option.label]),
);

export const accountFormSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "اسم حساب را بنویس").max(80),
  kind: z.enum(ACCOUNT_KIND_OPTIONS.map((option) => option.value)),
  /**
   * The raw string the user typed; lib/money parses it. Unlike every other
   * amount in the app this one may be negative — a credit card holds debt —
   * so it is not the shared `amountText` from validation/records.
   */
  balance: z.string().trim().min(1, "موجودی را بنویس"),
  balanceOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را انتخاب کن"),
  institution: z.string().trim().max(80).optional(),
  reference: z.string().trim().max(40).optional(),
  isDefault: z.boolean(),
});

export type AccountForm = z.infer<typeof accountFormSchema>;
