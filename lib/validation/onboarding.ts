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
  // Optional, since the flow stopped insisting on anything but the name. An
  // unanswered field arrives as null, never as NaN — the form schema below
  // maps it before anything is sent, because NaN has no JSON spelling.
  birthYear: z
    .number({ error: "سال تولد را با رقم بنویس، مثل 1990" })
    .int()
    .min(1930, "سال تولد را درست وارد کن")
    // The 13-year floor depends on the current year, so it lives here rather
    // than in a CHECK constraint, which Postgres requires to be immutable.
    .max(currentYear - 13, "باید دست‌کم ۱۳ سال داشته باشی")
    .nullable(),
  employmentStatus: z.enum(EMPLOYMENT_OPTIONS.map((o) => o.value)).nullable(),
  // Read from the browser, not asked. "This month" is computed in it.
  timezone: z.string().min(1),
});

/**
 * What the two profile forms — step 1 and the sheet in settings — bind to.
 * The same rules as above, but the DOM hands over strings, and "" is what an
 * untouched optional field looks like; this turns it into the null the server
 * schema expects before the rules run.
 */
const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;
const blankToNullNumber = (value: unknown) =>
  typeof value === "string"
    ? value.trim() === ""
      ? null
      : Number(value)
    : (value ?? null);

export const step1FormSchema = step1Schema.omit({ timezone: true }).extend({
  birthYear: z.preprocess(blankToNullNumber, step1Schema.shape.birthYear),
  employmentStatus: z.preprocess(blankToNull, step1Schema.shape.employmentStatus),
});

/** Settings changes the currency elsewhere, behind a warning of its own. */
export const profileFormSchema = step1FormSchema.omit({ baseCurrency: true });

export type Step1FormInput = z.input<typeof step1FormSchema>;
export type Step1FormOutput = z.output<typeof step1FormSchema>;
export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormOutput = z.output<typeof profileFormSchema>;

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
