import { z } from "zod";
import { CURRENCIES } from "@/lib/money";
import {
  COUNTRIES,
  EMPLOYMENT_OPTIONS,
  FREQUENCY_OPTIONS,
  GOAL_TYPE_OPTIONS,
  INCOME_TYPE_OPTIONS,
  RISK_QUESTIONS,
} from "@/lib/onboarding/config";

const currency = z.enum(CURRENCIES);

/** Amounts arrive as the raw string the user typed; lib/money parses them. */
const amountText = z.string().trim().min(1, "مبلغ را بنویس");

const currentYear = new Date().getFullYear();

export const step1Schema = z.object({
  fullName: z.string().trim().min(2, "نامت را بنویس").max(80),
  countryCode: z.enum(COUNTRIES.map((c) => c.code)),
  baseCurrency: currency,
  birthYear: z
    .number()
    .int()
    .min(1930, "سال تولد را درست وارد کن")
    // The 13-year floor depends on the current year, so it lives here rather
    // than in a CHECK constraint, which Postgres requires to be immutable.
    .max(currentYear - 13, "باید دست‌کم ۱۳ سال داشته باشی"),
  employmentStatus: z.enum(EMPLOYMENT_OPTIONS.map((o) => o.value)),
  // Read from the browser, not asked. "This month" is computed in it.
  timezone: z.string().min(1),
});

export const incomeSourceSchema = z.object({
  title: z.string().trim().min(1, "عنوان را بنویس").max(80),
  type: z.enum(INCOME_TYPE_OPTIONS.map((o) => o.value)),
  amount: amountText,
  frequency: z.enum(FREQUENCY_OPTIONS.map((o) => o.value)),
});

export const step2Schema = z.object({
  monthlyIncomeEstimate: amountText,
  sources: z.array(incomeSourceSchema).min(1, "دست‌کم یک منبع درآمد اضافه کن"),
});

export const recurringExpenseSchema = z.object({
  title: z.string().trim().min(1, "عنوان را بنویس").max(80),
  categorySlug: z.string().min(1),
  amount: amountText,
  dueDay: z.number().int().min(1).max(31),
});

export const step3Schema = z.object({
  expenses: z.array(recurringExpenseSchema).min(1, "دست‌کم یک هزینه‌ی ثابت اضافه کن"),
});

export const step4Schema = z.object({
  baselines: z.array(
    z.object({
      categorySlug: z.string().min(1),
      amount: z.string().trim(),
    }),
  ),
});

export const goalSchema = z.object({
  title: z.string().trim().min(1, "عنوان هدف را بنویس").max(80),
  type: z.enum(GOAL_TYPE_OPTIONS.map((o) => o.value)),
  targetAmount: amountText,
  targetDate: z.string().optional(),
  priority: z.number().int().min(0).max(3),
});

export const step5Schema = z.object({
  goals: z.array(goalSchema).min(1, "دست‌کم یک هدف بساز"),
});

export const step6Schema = z.object({
  answers: z
    .array(z.number().int().min(1).max(4))
    .length(RISK_QUESTIONS.length, "به همه‌ی سؤال‌ها جواب بده"),
});

export const step7Schema = z.object({
  hasDebt: z.boolean(),
  debtAmount: z.string().trim().optional(),
  emergencyFundMonths: z.number().min(0).max(60),
  savingsRateEstimate: z.number().int().min(0).max(100),
});

export type Step1Input = z.infer<typeof step1Schema>;
export type Step2Input = z.infer<typeof step2Schema>;
export type Step3Input = z.infer<typeof step3Schema>;
export type Step4Input = z.infer<typeof step4Schema>;
export type Step5Input = z.infer<typeof step5Schema>;
export type Step6Input = z.infer<typeof step6Schema>;
export type Step7Input = z.infer<typeof step7Schema>;
