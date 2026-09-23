import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  missingOnboardingSteps,
  type CompletenessProfile,
} from "@/lib/onboarding/completeness";
import type { StepMeta } from "@/lib/onboarding/config";

/**
 * The steps settings should still ask about. Four counts rather than four row
 * reads — the question is only whether there is anything there — and the same
 * filters the onboarding summary uses, so a deactivated income source does
 * not count as an answer.
 */
export async function listMissingOnboardingSteps(
  profile: CompletenessProfile,
): Promise<StepMeta[]> {
  const supabase = await createClient();

  const [income, recurring, baselines, goals] = await Promise.all([
    supabase
      .from("income_sources")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("recurring_expenses")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("variable_expense_baselines").select("*", { count: "exact", head: true }),
    supabase.from("goals").select("*", { count: "exact", head: true }).eq("status", "active"),
  ]);

  return missingOnboardingSteps(profile, {
    incomeSources: income.count ?? 0,
    recurringExpenses: recurring.count ?? 0,
    variableBaselines: baselines.count ?? 0,
    goals: goals.count ?? 0,
  });
}
