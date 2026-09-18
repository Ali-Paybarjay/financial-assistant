import { z } from "zod";
import {
  FREQUENCY_OPTIONS,
  GOAL_TYPE_OPTIONS,
  INCOME_TYPE_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
} from "@/lib/onboarding/config";

/** Amounts travel as the raw string the user typed; lib/money parses them. */
const amountText = z.string().trim().min(1, "مبلغ را بنویس");
const optionalId = z.string().uuid().optional();

export const incomeSourceFormSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(1, "عنوان را بنویس").max(80),
  type: z.enum(INCOME_TYPE_OPTIONS.map((option) => option.value)),
  amount: amountText,
  frequency: z.enum(FREQUENCY_OPTIONS.map((option) => option.value)),
});

export const recurringExpenseFormSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(1, "عنوان را بنویس").max(80),
  categorySlug: z.string().min(1, "دسته را انتخاب کن"),
  /** "" is a real answer: a fixed expense paid in cash touches no account. */
  accountId: z.union([z.string().uuid(), z.literal("")]).optional(),
  amount: amountText,
  frequency: z.enum(RECURRING_FREQUENCY_OPTIONS.map((option) => option.value)),
  dueDay: z.number().int().min(1, "روز بین ۱ تا ۳۱").max(31, "روز بین ۱ تا ۳۱"),
  autoPost: z.boolean(),
});

/**
 * Moving this month's share into the savings account. Not a goal edit: it
 * creates a real transfer, which is the whole point — a goal that is only ever
 * a number in a box is a goal nobody actually funded.
 */
export const goalFundingFormSchema = z.object({
  goalId: z.string().uuid(),
  amount: amountText,
  fromAccountId: z.string().uuid({ message: "از کدام حساب؟" }),
  toAccountId: z.string().uuid({ message: "به کدام حساب پس‌انداز؟" }),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را انتخاب کن"),
});

export const goalFormSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(1, "عنوان را بنویس").max(80),
  type: z.enum(GOAL_TYPE_OPTIONS.map((option) => option.value)),
  targetAmount: amountText,
  savedAmount: z.string().trim(),
  targetDate: z.string(),
});

export type IncomeSourceForm = z.infer<typeof incomeSourceFormSchema>;
export type RecurringExpenseForm = z.infer<typeof recurringExpenseFormSchema>;
export type GoalForm = z.infer<typeof goalFormSchema>;
export type GoalFundingForm = z.infer<typeof goalFundingFormSchema>;
