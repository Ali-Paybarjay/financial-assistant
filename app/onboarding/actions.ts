"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { categoryIdsBySlug } from "@/lib/queries/categories";
import { hasRecordedMoney } from "@/lib/queries/money-data";
import { CURRENCY_LOCKED_ERROR } from "@/lib/currency-lock";
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

  // The same lock settings has. A completed user can come back to this step
  // from settings to fix a name, and the currency select sits on the same
  // form — so without this, the one door that was closed in settings stayed
  // open here. F01.
  const currencyChanged = parsed.data.baseCurrency !== viewer.currency;
  if (currencyChanged && (await hasRecordedMoney(viewer.userId))) {
    return { error: CURRENCY_LOCKED_ERROR };
  }

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
  let sources;
  try {
    monthlyEstimate = toMinor(parsed.data.monthlyIncomeEstimate, currency);
    sources = parsed.data.sources.map((source) => ({
      id: source.id ?? null,
      title: source.title,
      type: source.type,
      amount: toMinor(source.amount, currency),
      frequency: source.frequency,
    }));
  } catch {
    return { error: "یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس، مثل ۴۵۰۰." };
  }

  if (sources.some((source) => source.amount < 0)) {
    return { error: "مبلغ درآمد نمی‌تواند منفی باشد." };
  }

  // One transaction: rows the user kept are updated by id, rows they removed
  // are deleted, and a refusal anywhere leaves everything as it was. See
  // migration 0029. F04.
  const { error } = await supabase.rpc("replace_income_sources", {
    p_monthly_estimate: monthlyEstimate,
    p_currency: currency,
    p_sources: sources,
  });
  if (error) return { error: GENERIC_ERROR };

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

  let expenses;
  try {
    expenses = parsed.data.expenses.map((expense) => ({
      id: expense.id ?? null,
      title: expense.title,
      category_id: categories.get(expense.categorySlug) ?? null,
      amount: toMinor(expense.amount, currency),
      due_day: expense.dueDay,
    }));
  } catch {
    return { error: "یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس، مثل ۱۲۰۰." };
  }

  if (expenses.some((expense) => expense.amount < 0)) {
    return { error: "مبلغ هزینه‌ی ثابت نمی‌تواند منفی باشد." };
  }

  // A fixed cost is the parent of every transaction this app generated for it,
  // so re-creating one loses that history and re-posts the month. F04.
  const { error } = await supabase.rpc("replace_recurring_expenses", {
    p_currency: currency,
    p_expenses: expenses,
  });
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/onboarding", "layout");
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
        category_id: categories.get(baseline.categorySlug) ?? "",
        monthly_estimate: toMinor(baseline.amount, currency),
      }))
      .filter((row) => row.category_id !== "");
  } catch {
    return { error: "یکی از مبلغ‌ها عدد نیست. فقط رقم بنویس." };
  }

  if (rows.some((row) => row.monthly_estimate < 0)) {
    return { error: "مبلغ نمی‌تواند منفی باشد." };
  }

  // An estimate the user cleared is removed and the rest are upserted on
  // (user_id, category_id), in one transaction. The old version emptied the
  // table first, so a refused insert left the whole step blank. F04.
  const { error } = await supabase.rpc("replace_expense_baselines", {
    p_baselines: rows,
  });
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/onboarding", "layout");
  goNext(4);
}

export async function saveStep5(raw: unknown): Promise<StepResult> {
  const parsed = step5Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const currency = viewer.currency as CurrencyCode;

  let goals;
  try {
    goals = parsed.data.goals.map((goal) => ({
      id: goal.id ?? null,
      title: goal.title,
      type: goal.type,
      target_amount: toMinor(goal.targetAmount, currency),
      target_date: goal.targetDate && goal.targetDate !== "" ? goal.targetDate : null,
      priority: goal.priority,
    }));
  } catch {
    return { error: "مبلغ هدف عدد نیست. فقط رقم بنویس، مثل ۱۰۰۰۰." };
  }

  /**
   * Checked here as well as in SQL, and that is not belt and braces: the
   * database CHECK is `> 0`, and a target of «۰» used to reach it *after* every
   * existing goal had already been deleted. The rule now holds in three places —
   * the form, this action and the function — and the function is the one that
   * makes it safe, because it validates before it writes. F04.
   */
  if (goals.some((goal) => goal.target_amount <= 0)) {
    return { error: "مبلغ هدف باید بزرگ‌تر از صفر باشد." };
  }

  const { error } = await supabase.rpc("replace_goals", { p_goals: goals });
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/onboarding", "layout");
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
