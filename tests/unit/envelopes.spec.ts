import { describe, expect, it } from "vitest";
import {
  dailyAllowance,
  envelopeState,
  projectedSpend,
  suggestBudget,
  suggestedCeiling,
} from "@/lib/envelopes";

describe("envelopeState", () => {
  it("has no state to report without a ceiling", () => {
    // Not «under» — under what? A category nobody has decided about is a
    // decision outstanding, and the board draws it as one.
    expect(envelopeState(null, 0)).toBe("unset");
    expect(envelopeState(null, 999_999)).toBe("unset");
  });

  it("turns tight at exactly 85% of the ceiling", () => {
    // The boundary itself, from both sides. 85% of 20_000 is 17_000.
    expect(envelopeState(20_000, 16_999)).toBe("under");
    expect(envelopeState(20_000, 17_000)).toBe("tight");
  });

  it("counts spending the ceiling exactly as tight, not over", () => {
    // Hitting your own target is not a failure, and colouring it red would
    // tell the user off for doing precisely what they set out to do.
    expect(envelopeState(20_000, 20_000)).toBe("tight");
    expect(envelopeState(20_000, 20_001)).toBe("over");
  });

  it("stays under while the ceiling is untouched", () => {
    expect(envelopeState(20_000, 0)).toBe("under");
  });
});

describe("projectedSpend", () => {
  it("carries the rate so far across the whole month", () => {
    // $10 a day for 10 days, in a 30 day month.
    expect(projectedSpend(10_000, 10, 30)).toBe(30_000);
  });

  it("returns what is spent when no day has passed yet", () => {
    // The 1st has no rate to extrapolate from, and dividing by zero would put
    // Infinity on the card.
    expect(projectedSpend(5_000, 0, 30)).toBe(5_000);
    expect(projectedSpend(5_000, -1, 30)).toBe(5_000);
  });

  it("rounds to a whole minor unit", () => {
    // 100 / 3 * 30 = 999.99…; money is an integer everywhere in this app.
    expect(projectedSpend(100, 3, 30)).toBe(1_000);
    expect(Number.isInteger(projectedSpend(9_997, 7, 31))).toBe(true);
  });
});

describe("dailyAllowance", () => {
  it("splits what is left over the days that are left", () => {
    expect(dailyAllowance(30_000, 10_000, 20)).toBe(1_000);
  });

  it("has nothing to say without a ceiling or without days", () => {
    expect(dailyAllowance(null, 10_000, 20)).toBeNull();
    // On the last day there is no «per day» left to quote.
    expect(dailyAllowance(30_000, 10_000, 0)).toBeNull();
  });

  it("floors at zero once the ceiling is passed", () => {
    // A negative allowance reads as a debt per day, which is not something
    // the user can act on. The card says «over by X» in that state instead.
    expect(dailyAllowance(10_000, 15_000, 10)).toBe(0);
  });
});

describe("suggestBudget", () => {
  it("suggests nothing under two months of history", () => {
    // A figure drawn from one month is a figure drawn from whatever that
    // month happened to be.
    expect(suggestBudget([], "USD")).toBeNull();
    expect(suggestBudget([42_000], "USD")).toBeNull();
    // Months with no spending are not months of history either.
    expect(suggestBudget([42_000, 0, 0], "USD")).toBeNull();
  });

  it("takes the middle month, so one outlier cannot move it", () => {
    // The same five months, except the last one is the month they moved
    // house. The median does not notice; the mean of the second list is
    // 132_400, which would suggest a ceiling three times what they spend.
    const ordinary = [38_000, 40_000, 41_000, 42_000, 43_000];
    const withOutlier = [38_000, 40_000, 41_000, 42_000, 541_000];

    expect(suggestBudget(withOutlier, "USD")).toBe(suggestBudget(ordinary, "USD"));
    expect(suggestBudget(withOutlier, "USD")).toBe(45_000);
  });

  it("rounds up to the next fifty, so it reads as a proposal", () => {
    // Median 40_100 cents = $401. Rounded up to $450.
    expect(suggestBudget([40_000, 40_200], "USD")).toBe(45_000);
    // Already on the step, so it stays put rather than jumping another $50.
    expect(suggestBudget([45_000, 45_000], "USD")).toBe(45_000);
  });

  it("scales the rounding step to the currency's minor unit", () => {
    // A toman is its own minor unit, so fifty major units is fifty — not the
    // 5_000 a cents-shaped constant would assume. Same median, both ways up.
    expect(suggestBudget([4_983_210, 4_983_260], "IRT")).toBe(4_983_250);
    // The same median in a cents currency rounds by 5_000, not by 50.
    expect(suggestBudget([40_100, 40_200], "USD")).toBe(45_000);
  });
});

describe("suggestedCeiling", () => {
  const declared = { baseline_minor: 40_000 };

  it("prefers what happened over what was guessed at signup", () => {
    // Same reason monthlySurplus prefers observed over declared: one is a
    // month that happened, the other is a month nobody had lived yet.
    expect(suggestedCeiling(declared, 55_000)).toEqual({
      amount: 55_000,
      source: "observed",
    });
  });

  it("falls back to the onboarding figure when there is no history", () => {
    expect(suggestedCeiling(declared, null)).toEqual({
      amount: 40_000,
      source: "declared",
    });
    expect(suggestedCeiling(declared, undefined)).toEqual({
      amount: 40_000,
      source: "declared",
    });
  });

  it("proposes nothing rather than proposing zero", () => {
    // An empty field says «you decide». A ceiling of zero says the app
    // decided, and decided something absurd.
    expect(suggestedCeiling({ baseline_minor: null }, null)).toBeNull();
    expect(suggestedCeiling({ baseline_minor: 0 }, 0)).toBeNull();
  });
});
