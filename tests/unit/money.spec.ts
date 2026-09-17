import { describe, expect, it } from "vitest";
import {
  formatMoney,
  MoneyParseError,
  normalizeDigits,
  savingsRate,
  sumMinor,
  toMajor,
  toMinor,
} from "@/lib/money";

describe("toMinor", () => {
  it("converts plain decimals without touching floating point", () => {
    expect(toMinor("45.50", "CAD")).toBe(4550);
    expect(toMinor("19.99", "USD")).toBe(1999);
    expect(toMinor("0.01", "EUR")).toBe(1);
    expect(toMinor("1000", "GBP")).toBe(100000);
  });

  it("is exact for values that break naive float multiplication", () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754.
    expect(toMinor("19.99", "USD")).toBe(1999);
    expect(toMinor("8.07", "USD")).toBe(807);
    expect(toMinor("1.005", "USD")).toBe(101);
  });

  it("rounds half up at the minor unit", () => {
    expect(toMinor("45.555", "CAD")).toBe(4556);
    expect(toMinor("45.554", "CAD")).toBe(4555);
  });

  it("accepts Persian digits and separators", () => {
    expect(toMinor("۴۵٫۵۰", "CAD")).toBe(4550);
    expect(toMinor("۱۲", "CAD")).toBe(1200);
    expect(toMinor("1,234.56", "CAD")).toBe(123456);
  });

  it("keeps whole units whole for the toman and the rial", () => {
    expect(toMinor("45000", "IRT")).toBe(45000);
    expect(toMinor("2,500,000", "IRR")).toBe(2500000);
    // A decimal point in a currency that has none rounds rather than scales.
    expect(toMinor("12.6", "IRT")).toBe(13);
    expect(toMinor("۴۵٬۰۰۰", "IRT")).toBe(45000);
  });

  it("rejects anything that is not a plain amount", () => {
    expect(() => toMinor("", "CAD")).toThrow(MoneyParseError);
    expect(() => toMinor("abc", "CAD")).toThrow(MoneyParseError);
    expect(() => toMinor("12.3.4", "CAD")).toThrow(MoneyParseError);
    expect(() => toMinor("$45", "CAD")).toThrow(MoneyParseError);
  });
});

describe("normalizeDigits", () => {
  it("maps Persian and Arabic-Indic digits to Latin", () => {
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
});

describe("formatMoney", () => {
  it("renders Latin digits with a thousands separator", () => {
    expect(formatMoney(113160, "CAD")).toBe("$1,131.60");
    expect(formatMoney(807, "USD")).toBe("$8.07");
  });

  it("puts the Persian unit after the amount", () => {
    expect(formatMoney(45000, "IRT")).toBe("45,000 تومان");
    expect(formatMoney(2500000, "IRR")).toBe("2,500,000 ریال");
    expect(formatMoney(-45000, "IRT")).toBe("−45,000 تومان");
    expect(formatMoney(45000, "IRT", { signed: true })).toBe("+45,000 تومان");
    expect(formatMoney(45000, "IRT", { omitSymbol: true })).toBe("45,000");
  });

  it("uses a true minus sign, not a hyphen", () => {
    expect(formatMoney(-335, "CAD")).toBe("−$3.35");
  });

  it("adds an explicit plus only when asked", () => {
    expect(formatMoney(113160, "CAD", { signed: true })).toBe("+$1,131.60");
    expect(formatMoney(113160, "CAD")).toBe("$1,131.60");
  });

  it("can omit the symbol", () => {
    expect(formatMoney(113160, "CAD", { omitSymbol: true })).toBe("1,131.60");
  });
});

describe("sumMinor", () => {
  it("stays exact across many additions", () => {
    const cents = Array.from({ length: 1000 }, () => 1999);
    expect(sumMinor(cents)).toBe(1_999_000);
  });
});

describe("toMajor", () => {
  it("converts back for charting", () => {
    expect(toMajor(4550, "CAD")).toBe(45.5);
  });
});

describe("savingsRate", () => {
  it("returns a percentage with one decimal", () => {
    expect(savingsRate(425000, 311840)).toBe(26.6);
  });

  it("returns null when there is no income to divide by", () => {
    expect(savingsRate(0, 5000)).toBeNull();
  });
});
