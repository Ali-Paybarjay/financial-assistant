import { describe, expect, it } from "vitest";
import { quickParse } from "@/lib/entry/quick-parse";

/**
 * The gate's whole job is deciding what the model is for. The first version
 * got that backwards — it stopped anything shaped like «amount + a word»,
 * which is most of what people actually type — so these tests are mostly
 * about what must *reach* the model.
 */
describe("quickParse", () => {
  it("does not call the model for text too short to describe anything", () => {
    expect(quickParse("a")).toEqual({ kind: "manual", reason: "too-short" });
    expect(quickParse("  ")).toEqual({ kind: "manual", reason: "too-short" });
  });

  it("does not call the model when there is no amount at all", () => {
    // The amount is the one field this app never infers, so there is nothing
    // for a model to return. The words are carried into the form so the user
    // only has to add the figure.
    expect(quickParse("یک قهوه خریدم")).toEqual({
      kind: "manual",
      reason: "no-amount",
      merchant: "یک قهوه خریدم",
    });
  });

  it("does not call the model for a figure with nothing said about it", () => {
    // There is no category to infer from silence.
    expect(quickParse("۵۰")).toEqual({
      kind: "manual",
      reason: "amount-only",
      amount: "50",
    });
    // A unit is not something said about it.
    expect(quickParse("۵۰ پوند")).toEqual({
      kind: "manual",
      reason: "amount-only",
      amount: "50",
    });
    expect(quickParse("۱۲.۵۰ دلار")).toMatchObject({
      reason: "amount-only",
      amount: "12.50",
    });
  });

  it("sends anything with a describing word to the model", () => {
    // Every one of these was wrongly short-circuited before. The figure was
    // never the hard part — the category is, and only the model produces it.
    for (const text of [
      "قهوه ۵",
      "بنزین ۶۰",
      "قبض برق ۸۰ پوند",
      "ناهار با مریم ۲۵ پوند",
      "۴۵ پوند خرید از سوپرمارکت",
      "۵۰ هزار تومان قهوه",
      "دیروز ۲۰ دلار تاکسی",
      "۴۵ دلار خرید و ۱۲ دلار قهوه",
    ]) {
      expect(quickParse(text), text).toEqual({ kind: "model" });
    }
  });

  it("reads Persian and Latin digits the same way", () => {
    expect(quickParse("قهوه ۵")).toEqual(quickParse("قهوه 5"));
    expect(quickParse("۵۰")).toEqual(quickParse("50"));
  });

  it("drops a thousands separator and keeps a decimal", () => {
    expect(quickParse("۱,۲۵۰")).toMatchObject({ amount: "1250" });
    expect(quickParse("۱۲.۵۰")).toMatchObject({ amount: "12.50" });
  });
});
