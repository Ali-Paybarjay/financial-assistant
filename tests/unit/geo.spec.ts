import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/onboarding/config";
import {
  countryFromLocales,
  countryFromTimeZone,
  currencyForCountry,
  isSupportedCountry,
} from "@/lib/onboarding/geo";

describe("countryFromTimeZone", () => {
  it("splits America/* between the two countries that share it", () => {
    expect(countryFromTimeZone("America/Toronto")).toBe("CA");
    expect(countryFromTimeZone("America/Vancouver")).toBe("CA");
    expect(countryFromTimeZone("America/New_York")).toBe("US");
    expect(countryFromTimeZone("America/Los_Angeles")).toBe("US");
  });

  it("covers the long tail through prefixes", () => {
    expect(countryFromTimeZone("Australia/Sydney")).toBe("AU");
    expect(countryFromTimeZone("Australia/Perth")).toBe("AU");
    expect(countryFromTimeZone("America/Indiana/Indianapolis")).toBe("US");
    expect(countryFromTimeZone("Canada/Eastern")).toBe("CA");
  });

  it("reads Iran from both spellings of its zone", () => {
    expect(countryFromTimeZone("Asia/Tehran")).toBe("IR");
    // The legacy alias some browsers still report.
    expect(countryFromTimeZone("Iran")).toBe("IR");
  });

  it("reads the European zones the audience actually lives in", () => {
    expect(countryFromTimeZone("Europe/London")).toBe("GB");
    expect(countryFromTimeZone("Europe/Berlin")).toBe("DE");
    expect(countryFromTimeZone("Europe/Amsterdam")).toBe("NL");
    expect(countryFromTimeZone("Atlantic/Canary")).toBe("ES");
  });

  it("returns null rather than guessing for a country the app cannot store", () => {
    // A prefill of an unlisted country would fail the form's own enum and read
    // as the app knowing something it does not.
    expect(countryFromTimeZone("Europe/Dublin")).toBeNull();
    expect(countryFromTimeZone("Asia/Tokyo")).toBeNull();
    expect(countryFromTimeZone("")).toBeNull();
    expect(countryFromTimeZone(null)).toBeNull();
  });

  // The invariant, rather than a list that has to be edited every time the
  // country list grows: whatever comes back must be storable.
  it("never returns a code outside the country list", () => {
    const zones = [
      "Asia/Tehran",
      "America/Toronto",
      "Europe/London",
      "Australia/Brisbane",
      "US/Mountain",
      "Asia/Tokyo",
      "Africa/Lagos",
    ];
    for (const zone of zones) {
      const code = countryFromTimeZone(zone);
      if (code !== null) expect(isSupportedCountry(code)).toBe(true);
    }
  });
});

describe("countryFromLocales", () => {
  it("takes the region off the first tag that carries one", () => {
    expect(countryFromLocales(["fa", "en-CA"])).toBe("CA");
    expect(countryFromLocales(["en-GB"])).toBe("GB");
    expect(countryFromLocales(["fa-IR"])).toBe("IR");
  });

  it("ignores a bare language, an unsupported region, and a malformed tag", () => {
    expect(countryFromLocales(["fa", "en"])).toBeNull();
    expect(countryFromLocales(["en-IE"])).toBeNull();
    expect(countryFromLocales(["not a locale"])).toBeNull();
    expect(countryFromLocales([])).toBeNull();
  });
});

describe("currencyForCountry", () => {
  it("agrees with the country table for every country offered", () => {
    for (const country of COUNTRIES) {
      expect(currencyForCountry(country.code)).toBe(country.currency);
    }
  });
});

describe("isSupportedCountry", () => {
  it("accepts only codes the profile CHECK constraint would allow", () => {
    expect(isSupportedCountry("CA")).toBe(true);
    expect(isSupportedCountry("IE")).toBe(false);
    expect(isSupportedCountry("ca")).toBe(false);
    expect(isSupportedCountry(null)).toBe(false);
  });
});
