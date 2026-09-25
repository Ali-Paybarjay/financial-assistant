"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { categoryIdsBySlug } from "@/lib/queries/categories";
import { toMinor, type CurrencyCode } from "@/lib/money";
import { TOTAL_STEPS } from "@/lib/onboarding/config";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
} from "@/lib/validation/onboarding";

export type StepResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

/** Advances the resume pointer, never backwards — going back to edit step 2
 *  must not strand a user who has already answered step 5. */
async function markStepDone(step: number) {
  const supabase = await createClient();
  const viewer = await requireViewer();
  const next = Math.max(step, viewer.profile.onboarding_step);

  await supabase
    .from("profiles")
    .update({ onboarding_step: next })
    .eq("id", viewer.userId);

  revalidatePath("/onboarding", "layout");
}

function goNext(step: number): never {
  redirect(step >= TOTAL_STEPS ? "/onboarding/summary" : `/onboarding/${step + 1}`);
}

/**
 * The one step nothing can be skipped past, because it carries the name. With
 * `finish` it is also the way out of the flow from the very first screen:
 * save what is here, open the app, leave the rest to settings.
 */
export async function saveStep1(
  raw: unknown,
  options: { finish?: boolean } = {},
): Promise<StepResult> {
  const parsed = step1Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      country_code: parsed.data.countryCode,
      base_currency: parsed.data.baseCurrency,
      timezone: parsed.data.timezone,
      onboarding_step: Math.max(1, viewer.profile.onboarding_step),
      // A date already set is kept: someone back from settings to fill in a
      // gap is not signing up a second time.
      ...(options.finish && !viewer.profile.onboarding_completed_at
        ? { onboarding_completed_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", viewer.userId);

  if (error) return { error: GENERIC_ERROR };
  revalidatePath("/onboarding", "layout");

  if (options.finish) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  goNext(1);
}

export async function saveStep2(raw: unknown): Promise<StepResult> {
  const parsed = step2Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const currency = viewer.currency as CurrencyCode;

  let monthlyEstimate: number;
  let rows;
  try {
    monthlyEstimate = toMinor(parsed.data.monthlyIncomeEstimate, currency);
    rows = parsed.data.sources.map((source) => ({
      user_id: viewer.userId,
      title: source.title,
      type: source.type,
      amount: toMinor(source.amount, currency),
      currency,
      frequency: source.frequency,
    }));
  } catch {
    return { error: "یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس، مثل ۴۵۰۰." };
  }

  // Replace rather than append: re-submitting this step means "these are my
  // sources", not "add these again".
  await supabase.from("income_sources").delete().eq("user_id", viewer.userId);

  const { error } = await supabase.from("income_sources").insert(rows);
  if (error) return { error: GENERIC_ERROR };

  await supabase
    .from("profiles")
    .update({
      monthly_income_estimate: monthlyEstimate,
      onboarding_step: Math.max(2, viewer.profile.onboarding_step),
    })
    .eq("id", viewer.userId);

  revalidatePath("/onboarding", "layout");
  goNext(2);
}

export async function saveStep3(raw: unknown): Promise<StepResult> {
  const parsed = step3Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const currency = viewer.currency as CurrencyCode;
  const categories = await categoryIdsBySlug();

  let rows;
  try {
    rows = parsed.data.expenses.map((expense) => ({
      user_id: viewer.userId,
      title: expense.title,
      category_id: categories.get(expense.categorySlug) ?? null,
      amount: toMinor(expense.amount, currency),
      currency,
      frequency: "monthly" as const,
      due_day: expense.dueDay,
    }));
  } catch {
    return { error: "یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس، مثل ۱۲۰۰." };
  }

  await supabase.from("recurring_expenses").delete().eq("user_id", viewer.userId);

  const { error } = await supabase.from("recurring_expenses").insert(rows);
  if (error) return { error: GENERIC_ERROR };

  await markStepDone(3);
  goNext(3);
}

export async function saveStep4(raw: unknown): Promise<StepResult> {
  const parsed = step4Schema.safeParse(raw);
  if (!parsed.success) return { error: GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const currency = viewer.currency as CurrencyCode;
  const categories = await categoryIdsBySlug();

  let rows;
  try {
    rows = parsed.data.baselines
      .filter((baseline) => baseline.amount.trim() !== "")
      .map((baseline) => ({
        user_id: viewer.userId,
        category_id: categories.get(baseline.categorySlug)!,
        monthly_estimate: toMinor(baseline.amount, currency),
      }))
      .filter((row) => row.category_id);
  } catch {
    return { error: "یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس." };
  }

  await supabase.from("variable_expense_baselines").delete().eq("user_id", viewer.userId);

  if (rows.length > 0) {
    const { error } = await supabase.from("variable_expense_baselines").insert(rows);
    if (error) return { error: GENERIC_ERROR };
  }

  await markStepDone(4);
  goNext(4);
}

export async function saveStep5(raw: unknown): Promise<StepResult> {
  const parsed = step5Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const currency = viewer.currency as CurrencyCode;

  let rows;
  try {
    rows = parsed.data.goals.map((goal) => ({
      user_id: viewer.userId,
      title: goal.title,
      type: goal.type,
      target_amount: toMinor(goal.targetAmount, currency),
      target_date: goal.targetDate && goal.targetDate !== "" ? goal.targetDate : null,
      priority: goal.priority,
    }));
  } catch {
    return { error: "مبلغ هدف عدد نیست. فقط رقم بنویس، مثل ۱۰۰۰۰." };
  }

  await supabase.from("goals").delete().eq("user_id", viewer.userId);

  const { error } = await supabase.from("goals").insert(rows);
  if (error) return { error: GENERIC_ERROR };

  await markStepDone(5);
  goNext(5);
}

export async function saveStep6(raw: unknown): Promise<StepResult> {
  const parsed = step6Schema.safeParse(raw);
  if (!parsed.success) return { error: GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const currency = viewer.currency as CurrencyCode;

  let debtAmount: number | null = null;
  if (parsed.data.hasDebt && parsed.data.debtAmount?.trim()) {
    try {
      debtAmount = toMinor(parsed.data.debtAmount, currency);
    } catch {
      return { error: "مبلغ بدهی عدد نیست. فقط رقم بنویس." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      has_debt: parsed.data.hasDebt,
      debt_amount: debtAmount,
      emergency_fund_months: parsed.data.emergencyFundMonths,
      savings_rate_estimate: parsed.data.savingsRateEstimate,
      onboarding_step: TOTAL_STEPS,
    })
    .eq("id", viewer.userId);

  if (error) return { error: GENERIC_ERROR };
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/summary");
}

/** Every step after the name. Moves the pointer forward without writing any answers. */
export async function skipStep(step: number): Promise<never> {
  await markStepDone(step);
  goNext(step);
}

/**
 * Into the app now, with the rest left for settings. Offered on every step
 * after the name.
 *
 * The pointer stays where it is: that, and the rows that are not there, are
 * how settings knows what to ask for. A date already set is kept, so a return
 * visit to fill something in does not read as a second signup.
 */
export async function postponeOnboarding(): Promise<never> {
  const viewer = await requireViewer();

  if (!viewer.profile.onboarding_completed_at) {
    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", viewer.userId);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function finishOnboarding(): Promise<never> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  await supabase
    .from("profiles")
    .update({
      onboarding_step: TOTAL_STEPS,
      onboarding_completed_at:
        viewer.profile.onboarding_completed_at ?? new Date().toISOString(),
    })
    .eq("id", viewer.userId);

  revalidatePath("/", "layout");
  redirect("/");
}
