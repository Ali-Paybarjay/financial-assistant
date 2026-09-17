import { describe, expect, it } from "vitest";
import { expandJalaliYear, jalaliToIso, JalaliRangeError } from "@/lib/jalali";

describe("jalaliToIso", () => {
  // Anchors chosen to straddle the cases the algorithm can get wrong: the new
  // year, the leap day, the 31-to-30 day month boundary, and a break year.
  it.each([
    [1404, 6, 26, "2025-09-17"],
    [1404, 1, 1, "2025-03-21"],
    [1403, 1, 1, "2024-03-20"],
    [1400, 1, 1, "2021-03-21"],
    [1398, 1, 1, "2019-03-21"],
    [1405, 1, 1, "2026-03-21"],
    [1402, 7, 1, "2023-09-23"],
    [1395, 10, 11, "2016-12-31"],
  ])("converts %i/%i/%i", (year, month, day, expected) => {
    expect(jalaliToIso(year, month, day)).toBe(expected);
  });

  it("converts the leap day of 1399", () => {
    expect(jalaliToIso(1399, 12, 30)).toBe("2021-03-20");
  });

  it("converts the last day of a common year", () => {
    expect(jalaliToIso(1404, 12, 29)).toBe("2026-03-20");
  });

  it("rejects an impossible date rather than approximating it", () => {
    expect(() => jalaliToIso(1404, 13, 1)).toThrow(JalaliRangeError);
    expect(() => jalaliToIso(1404, 6, 0)).toThrow(JalaliRangeError);
    expect(() => jalaliToIso(1404, 6, 1.5)).toThrow(JalaliRangeError);
  });
});

describe("expandJalaliYear", () => {
  it("fills in the century a statement leaves off", () => {
    expect(expandJalaliYear(4)).toBe(1404);
    expect(expandJalaliYear(404)).toBe(1404);
    expect(expandJalaliYear(1404)).toBe(1404);
  });
});
