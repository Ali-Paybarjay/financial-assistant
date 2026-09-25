import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "@/lib/settings";

/**
 * The promise this module makes is that the app cannot be broken by its own
 * settings table — an empty one, a partial one, or one with a bad value in it
 * leaves every other knob alone. These are the cases that promise is made of.
 */
describe("parseSettings", () => {
  it("falls back to the shipped constants when there is nothing", () => {
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("reads the values that are there", () => {
    const settings = parseSettings([
      { key: "ai_enabled", value: false },
      { key: "guest_daily_calls", value: 5 },
      { key: "guest_retention_days", value: 14 },
      { key: "maintenance_banner", value: "امشب اپ در دسترس نیست." },
      {
        key: "ai_daily_limits",
        value: { parse_text: 80, parse_receipt: 30, parse_statement: 8 },
      },
    ]);

    expect(settings.ai_enabled).toBe(false);
    expect(settings.guest_daily_calls).toBe(5);
    expect(settings.guest_retention_days).toBe(14);
    expect(settings.maintenance_banner).toBe("امشب اپ در دسترس نیست.");
    expect(settings.ai_daily_limits).toEqual({
      parse_text: 80,
      parse_receipt: 30,
      parse_statement: 8,
    });
  });

  it("leaves the keys nobody has written at their default", () => {
    const settings = parseSettings([{ key: "guest_daily_calls", value: 9 }]);

    expect(settings.guest_daily_calls).toBe(9);
    expect(settings.ai_enabled).toBe(DEFAULT_SETTINGS.ai_enabled);
    expect(settings.ai_daily_limits).toEqual(DEFAULT_SETTINGS.ai_daily_limits);
  });

  it("falls back per key, not per table", () => {
    // The whole point. A ceiling somebody fat-fingered into a string must cost
    // that ceiling its custom value — not switch the model off for everybody.
    const settings = parseSettings([
      { key: "guest_daily_calls", value: "three" },
      { key: "ai_enabled", value: false },
    ]);

    expect(settings.guest_daily_calls).toBe(DEFAULT_SETTINGS.guest_daily_calls);
    expect(settings.ai_enabled).toBe(false);
  });

  it("rejects a partial limits object rather than half-applying it", () => {
    // Two of three ceilings is not a usable answer: the missing one would take
    // its default, and the pair would look deliberate.
    const settings = parseSettings([
      { key: "ai_daily_limits", value: { parse_text: 80 } },
    ]);

    expect(settings.ai_daily_limits).toEqual(DEFAULT_SETTINGS.ai_daily_limits);
  });

  it("rejects values outside the range each knob is allowed", () => {
    const settings = parseSettings([
      // Zero retention would make «purge now» delete the guest who is typing.
      { key: "guest_retention_days", value: 0 },
      { key: "guest_daily_calls", value: -1 },
      { key: "ai_daily_limits", value: { parse_text: 5000, parse_receipt: 20, parse_statement: 5 } },
    ]);

    expect(settings.guest_retention_days).toBe(DEFAULT_SETTINGS.guest_retention_days);
    expect(settings.guest_daily_calls).toBe(DEFAULT_SETTINGS.guest_daily_calls);
    expect(settings.ai_daily_limits).toEqual(DEFAULT_SETTINGS.ai_daily_limits);
  });

  it("trims the banner, and treats empty as no banner", () => {
    expect(
      parseSettings([{ key: "maintenance_banner", value: "  سلام  " }]).maintenance_banner,
    ).toBe("سلام");
    expect(parseSettings([{ key: "maintenance_banner", value: "" }]).maintenance_banner).toBe("");
  });

  it("falls back for a banner stored as null rather than as a string", () => {
    // app_settings.value is `jsonb not null` and every value the app writes is
    // a real JSON value, so this only happens if something else wrote the row.
    // The default — no banner — is the safe answer either way.
    expect(
      parseSettings([{ key: "maintenance_banner", value: null }]).maintenance_banner,
    ).toBe("");
  });

  it("ignores a key it does not know", () => {
    const settings = parseSettings([
      { key: "something_else", value: 1 },
      { key: "ai_enabled", value: false },
    ]);

    expect(settings.ai_enabled).toBe(false);
    expect(Object.keys(settings).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });

  it("does not let one call's result leak into the next", () => {
    // parseSettings spreads DEFAULT_SETTINGS; a mutation of the nested limits
    // object would poison the defaults for the rest of the process.
    const first = parseSettings([
      { key: "ai_daily_limits", value: { parse_text: 1, parse_receipt: 1, parse_statement: 1 } },
    ]);
    expect(first.ai_daily_limits.parse_text).toBe(1);
    expect(parseSettings([]).ai_daily_limits).toEqual({
      parse_text: 60,
      parse_receipt: 20,
      parse_statement: 5,
    });
  });
});
