import { describe, expect, it } from "vitest";
import { convertibleFrom, convertMinor, CurrencyMismatchError } from "@/lib/money";

describe("convertMinor", () => {
  it("leaves a matching currency untouched", () => {
    expect(convertMinor(4550, "CAD", "CAD")).toBe(4550);
  });

  it("reads a rial statement into a toman ledger", () => {
    expect(convertMinor(450_000, "IRR", "IRT")).toBe(45_000);
  });

  it("reads a toman statement into a rial ledger", () => {
    expect(convertMinor(45_000, "IRT", "IRR")).toBe(450_000);
  });

  it("rounds rather than dropping an odd rial", () => {
    expect(convertMinor(45, "IRR", "IRT")).toBe(5);
    expect(convertMinor(44, "IRR", "IRT")).toBe(4);
  });

  it("refuses a pair it has no rate for", () => {
    expect(() => convertMinor(4550, "USD", "CAD")).toThrow(CurrencyMismatchError);
    expect(() => convertMinor(4550, "IRR", "EUR")).toThrow(CurrencyMismatchError);
  });
});

describe("convertibleFrom", () => {
  it("offers the toman user a rial statement", () => {
    expect(convertibleFrom("IRT")).toEqual(["IRT", "IRR"]);
    expect(convertibleFrom("IRR")).toEqual(["IRR", "IRT"]);
  });

  it("offers everyone else only their own currency", () => {
    expect(convertibleFrom("CAD")).toEqual(["CAD"]);
  });
});
