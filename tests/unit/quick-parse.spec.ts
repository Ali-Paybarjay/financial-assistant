import { describe, expect, it } from "vitest";
import { quickParse } from "@/lib/entry/quick-parse";

describe("quickParse", () => {
  it("does not call the model for text too short to describe anything", () => {
    expect(quickParse("a")).toEqual({ kind: "manual", reason: "too-short" });
    expect(quickParse("  ")).toEqual({ kind: "manual", reason: "too-short" });
  });

  it("does not call the model when there is no amount in the text", () => {
    // Nothing to extract. Asking a model to find a number that is not there
    // costs money and comes back empty.
    expect(quickParse("قهوه خریدم")).toEqual({ kind: "manual", reason: "no-amount" });
  });

  it("fills the form itself for «number + name»", () => {
    expect(quickParse("قهوه ۵")).toEqual({
      kind: "manual",
      reason: "simple",
      amount: "5",
      merchant: "قهوه",
    });
    // Either order, and the currency word is a unit rather than a description.
    expect(quickParse("۴۵ دلار سوپرمارکت")).toEqual({
      kind: "manual",
      reason: "simple",
      amount: "45",
      merchant: "سوپرمارکت",
    });
  });

  it("keeps the decimal and drops the thousands separator", () => {
    expect(quickParse("نان ۱۲.۵۰")).toMatchObject({ amount: "12.50" });
    expect(quickParse("اجاره ۱,۲۵۰")).toMatchObject({ amount: "1250" });
  });

  it("asks the model when there is more than one figure", () => {
    // Two amounts is usually two purchases, which is the case the model is
    // actually good at.
    expect(quickParse("۴۵ دلار خرید و ۱۲ دلار قهوه")).toEqual({ kind: "model" });
  });

  it("asks the model when a word has to be interpreted", () => {
    // A multiplier has to be applied and a date has to be resolved. Getting
    // either wrong writes a wrong row, so neither is guessed with a regex.
    expect(quickParse("۵۰ هزار تومان قهوه")).toEqual({ kind: "model" });
    expect(quickParse("دیروز ۲۰ دلار تاکسی")).toEqual({ kind: "model" });
  });

  it("asks the model once the text is a sentence rather than a label", () => {
    expect(quickParse("۲۵ دلار برای ناهار با تیم در رستوران")).toEqual({
      kind: "model",
    });
  });

  it("reads Persian and Latin digits the same way", () => {
    expect(quickParse("قهوه ۵")).toEqual(quickParse("قهوه 5"));
  });
});
