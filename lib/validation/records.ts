import { z } from "zod";
import {
  FREQUENCY_OPTIONS,
  GOAL_TYPE_OPTIONS,
  INCOME_TYPE_OPTIONS,
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
  amount: amountText,
  dueDay: z.number().int().min(1, "روز بین ۱ تا ۳۱").max(31, "روز بین ۱ تا ۳۱"),
  autoPost: z.boolean(),
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
