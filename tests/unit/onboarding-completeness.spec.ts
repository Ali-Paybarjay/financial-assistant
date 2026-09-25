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

  it("never names step 1, because there is nothing there to be missing", () => {
    // It asks for a name, which the flow does not let past, and a country and
    // currency it guesses. The birth year and the job it used to ask for are a
    // form in settings now, not an unfinished step.
    const empty = { incomeSources: 0, recurringExpenses: 0, variableBaselines: 0, goals: 0 };
    expect(steps(answered, empty)).not.toContain(1);
  });

  it("judges the list steps on rows, not on how far the pointer got", () => {
    const empty = { incomeSources: 0, recurringExpenses: 0, variableBaselines: 0, goals: 0 };
    expect(steps(answered, empty)).toEqual([2, 3, 4, 5]);
  });

  it("treats the last step as missing while any of its three answers is", () => {
    expect(steps({ ...answered, has_debt: null }, filled)).toEqual([6]);
    expect(steps({ ...answered, emergency_fund_months: null }, filled)).toEqual([6]);
    expect(steps({ ...answered, savings_rate_estimate: null }, filled)).toEqual([6]);
  });

  it("keeps flow order, so the first entry is where to send them", () => {
    const blank: CompletenessProfile = {
      has_debt: null,
      emergency_fund_months: null,
      savings_rate_estimate: null,
    };
    const result = missingOnboardingSteps(blank, { ...filled, goals: 0 });
    expect(result.map((step) => step.step)).toEqual([5, 6]);
    // Each entry carries the flow's own label, which is what the card shows.
    expect(result[0]?.kicker).toBe("اهداف");
  });
});
