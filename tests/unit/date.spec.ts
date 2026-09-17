import { describe, expect, it } from "vitest";
import {
  daysLeftInMonth,
  formatDateFa,
  monthRange,
  shiftMonth,
  todayInTimeZone,
} from "@/lib/date";

describe("todayInTimeZone", () => {
  it("gives the user's calendar date, not UTC's", () => {
    // 2026-09-01T03:30Z is still 2026-08-31 in Toronto.
    const instant = new Date("2026-09-01T03:30:00Z");
    expect(todayInTimeZone("America/Toronto", instant)).toBe("2026-08-31");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-09-01");
    expect(todayInTimeZone("Australia/Melbourne", instant)).toBe("2026-09-01");
  });

  it("puts a late-evening Vancouver purchase in the right month", () => {
    // 23:30 on 30 September in Vancouver is already 1 October in UTC.
    const instant = new Date("2026-10-01T06:30:00Z");
    expect(todayInTimeZone("America/Vancouver", instant)).toBe("2026-09-30");
    expect(monthRange("America/Vancouver", undefined, instant).month).toBe("2026-09-01");
  });
});

describe("monthRange", () => {
  it("spans the whole calendar month", () => {
    expect(monthRange("America/Toronto", "2026-09-16")).toEqual({
      month: "2026-09-01",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("handles 31-day months and February", () => {
    expect(monthRange("UTC", "2026-01-15").to).toBe("2026-01-31");
    expect(monthRange("UTC", "2026-02-10").to).toBe("2026-02-28");
    expect(monthRange("UTC", "2028-02-10").to).toBe("2028-02-29");
  });
});

describe("shiftMonth", () => {
  it("steps across year boundaries in both directions", () => {
    expect(shiftMonth("2026-09-01", -1)).toBe("2026-08-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -13)).toBe("2024-12-01");
  });
});

describe("daysLeftInMonth", () => {
  it("counts the days remaining", () => {
    expect(daysLeftInMonth("UTC", "2026-09-16")).toBe(14);
    expect(daysLeftInMonth("UTC", "2026-09-30")).toBe(0);
  });
});

describe("formatDateFa", () => {
  it("renders Persian digits on the Gregorian calendar", () => {
    const formatted = formatDateFa("2026-09-16");
    expect(formatted).toContain("۱۶");
    expect(formatted).toContain("۲۰۲۶");
    // No Jalali month names — the brief rules out the Persian calendar.
    expect(formatted).not.toContain("شهریور");
  });

  it("does not drift a day when formatting a date-only value", () => {
    expect(formatDateFa("2026-01-01")).toContain("۲۰۲۶");
    expect(formatDateFa("2026-12-31")).toContain("۳۱");
  });
});
