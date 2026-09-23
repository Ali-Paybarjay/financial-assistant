import { describe, expect, it } from "vitest";
import {
  missingOnboardingSteps,
  type CompletenessProfile,
  type OnboardingCounts,
} from "@/lib/onboarding/completeness";

/**
 * The card in settings that asks for what onboarding let the user skip. It
 * has to be right about what is empty in both directions: naming something
 * that is there is nagging, and missing something that is not means the
 * only door back into the flow never appears.
 */

const answered: CompletenessProfile = {
  birth_year: 1990,
  employment_status: "employed",
  risk_label: "balanced",
  has_debt: false,
  emergency_fund_months: 3,
  savings_rate_estimate: 10,
};

const filled: OnboardingCounts = {
  incomeSources: 1,
  recurringExpenses: 1,
  variableBaselines: 1,
  goals: 1,
};

const steps = (profile: CompletenessProfile, counts: OnboardingCounts) =>
  missingOnboardingSteps(profile, counts).map((step) => step.step);

describe("missingOnboardingSteps", () => {
  it("is empty once every step has something behind it", () => {
    expect(steps(answered, filled)).toEqual([]);
  });

  it("names step 1 only for the two answers it stopped insisting on", () => {
    // Country and currency are guessed, so they never make the step «missing».
    expect(steps({ ...answered, birth_year: null }, filled)).toEqual([1]);
    expect(steps({ ...answered, employment_status: null }, filled)).toEqual([1]);
  });

  it("judges the list steps on rows, not on how far the pointer got", () => {
    const empty = { incomeSources: 0, recurringExpenses: 0, variableBaselines: 0, goals: 0 };
    expect(steps(answered, empty)).toEqual([2, 3, 4, 5]);
  });

  it("treats step 7 as missing while any of its three answers is", () => {
    expect(steps({ ...answered, has_debt: null }, filled)).toEqual([7]);
    expect(steps({ ...answered, emergency_fund_months: null }, filled)).toEqual([7]);
    expect(steps({ ...answered, savings_rate_estimate: null }, filled)).toEqual([7]);
  });

  it("keeps flow order, so the first entry is where to send them", () => {
    const blank: CompletenessProfile = {
      birth_year: null,
      employment_status: null,
      risk_label: null,
      has_debt: null,
      emergency_fund_months: null,
      savings_rate_estimate: null,
    };
    const result = missingOnboardingSteps(blank, { ...filled, goals: 0 });
    expect(result.map((step) => step.step)).toEqual([1, 5, 6, 7]);
    // Each entry carries the flow's own label, which is what the card shows.
    expect(result[0]?.kicker).toBe("آشنایی");
  });
});
