import { STEPS, type StepMeta } from "@/lib/onboarding/config";
import type { ProfileRow } from "@/lib/supabase/database.types";

/**
 * Which onboarding steps still have nothing behind them.
 *
 * Judged on the data, not on `onboarding_step`. The pointer only says how far
 * someone has *seen*, and since every step after the name can be skipped, a
 * profile walked all the way to the summary may still be empty. The card in
 * settings that asks for the rest has to ask about what is actually missing,
 * or it is nagging about a form.
 *
 * Pure: the counts come from the caller, so this can be tested without a
 * database and the settings page can fetch them as four HEAD requests.
 */
export type OnboardingCounts = {
  incomeSources: number;
  recurringExpenses: number;
  variableBaselines: number;
  goals: number;
};

export type CompletenessProfile = Pick<
  ProfileRow,
  | "birth_year"
  | "employment_status"
  | "risk_label"
  | "has_debt"
  | "emergency_fund_months"
  | "savings_rate_estimate"
>;

export function missingOnboardingSteps(
  profile: CompletenessProfile,
  counts: OnboardingCounts,
): StepMeta[] {
  const isMissing: Record<number, boolean> = {
    // Country and currency are always there — step 1 guesses them — so the
    // step is only «missing» for the two answers it stopped insisting on.
    1: profile.birth_year === null || profile.employment_status === null,
    2: counts.incomeSources === 0,
    3: counts.recurringExpenses === 0,
    4: counts.variableBaselines === 0,
    5: counts.goals === 0,
    6: profile.risk_label === null,
    7:
      profile.has_debt === null ||
      profile.emergency_fund_months === null ||
      profile.savings_rate_estimate === null,
  };

  // In flow order, so the first entry is where to send them.
  return STEPS.filter((step) => isMissing[step.step]);
}
