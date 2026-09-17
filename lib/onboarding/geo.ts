import { COUNTRIES } from "@/lib/onboarding/config";
import type { CurrencyCode } from "@/lib/money";

export type CountryCode = (typeof COUNTRIES)[number]["code"];

const SUPPORTED = new Set<string>(COUNTRIES.map((country) => country.code));

export function isSupportedCountry(value: unknown): value is CountryCode {
  return typeof value === "string" && SUPPORTED.has(value);
}

/** Picking a country is picking its currency; only the country is ever asked. */
export function currencyForCountry(code: CountryCode): CurrencyCode {
  return COUNTRIES.find((country) => country.code === code)?.currency ?? "CAD";
}

/**
 * IANA zone → country, for the countries this app supports.
 *
 * The browser's timezone beats geo-IP for this audience: a lot of these users
 * sit behind a VPN whose exit node is in another country, and the VPN does not
 * move the clock. America/* is split between two supported countries, so those
 * zones are listed one by one; the prefixes below cover the long tail.
 */
const COUNTRY_BY_TIME_ZONE: Record<string, CountryCode> = {
  "Asia/Tehran": "IR",

  "Europe/London": "GB",
  "Europe/Belfast": "GB",
  "Europe/Jersey": "GB",
  "Europe/Guernsey": "GB",
  "Europe/Isle_of_Man": "GB",
  "Europe/Berlin": "DE",
  "Europe/Busingen": "DE",
  "Europe/Amsterdam": "NL",
  "Europe/Paris": "FR",
  "Europe/Stockholm": "SE",
  "Europe/Vienna": "AT",
  "Europe/Brussels": "BE",
  "Europe/Madrid": "ES",
  "Atlantic/Canary": "ES",
  "Africa/Ceuta": "ES",
  "Europe/Rome": "IT",

  "America/Toronto": "CA",
  "America/Montreal": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/Moncton": "CA",
  "America/St_Johns": "CA",
  "America/Regina": "CA",
  "America/Swift_Current": "CA",
  "America/Thunder_Bay": "CA",
  "America/Nipigon": "CA",
  "America/Rainy_River": "CA",
  "America/Atikokan": "CA",
  "America/Blanc-Sablon": "CA",
  "America/Glace_Bay": "CA",
  "America/Goose_Bay": "CA",
  "America/Creston": "CA",
  "America/Dawson": "CA",
  "America/Dawson_Creek": "CA",
  "America/Fort_Nelson": "CA",
  "America/Whitehorse": "CA",
  "America/Yellowknife": "CA",
  "America/Inuvik": "CA",
  "America/Iqaluit": "CA",
  "America/Pangnirtung": "CA",
  "America/Rankin_Inlet": "CA",
  "America/Resolute": "CA",
  "America/Cambridge_Bay": "CA",
  "America/Coral_Harbour": "CA",

  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Detroit": "US",
  "America/Boise": "US",
  "America/Menominee": "US",
  "America/Anchorage": "US",
  "America/Juneau": "US",
  "America/Sitka": "US",
  "America/Yakutat": "US",
  "America/Metlakatla": "US",
  "America/Nome": "US",
  "America/Adak": "US",
  "Pacific/Honolulu": "US",
};

const COUNTRY_BY_ZONE_PREFIX: ReadonlyArray<readonly [string, CountryCode]> = [
  ["Iran", "IR"], // The "Iran" alias of Asia/Tehran, still shipped by some browsers.
  ["Australia/", "AU"],
  ["Canada/", "CA"],
  ["US/", "US"],
  ["America/Indiana/", "US"],
  ["America/Kentucky/", "US"],
  ["America/North_Dakota/", "US"],
];

export function countryFromTimeZone(timeZone: string | null | undefined): CountryCode | null {
  if (!timeZone) return null;
  const exact = COUNTRY_BY_TIME_ZONE[timeZone];
  if (exact) return exact;
  for (const [prefix, code] of COUNTRY_BY_ZONE_PREFIX) {
    if (timeZone.startsWith(prefix)) return code;
  }
  return null;
}

/** "en-CA" → CA. A bare "en" or "fa" carries no region and is skipped. */
export function countryFromLocales(locales: readonly string[]): CountryCode | null {
  for (const locale of locales) {
    let region: string | undefined;
    try {
      region = new Intl.Locale(locale).region;
    } catch {
      // A malformed language tag is not worth failing over.
      continue;
    }
    if (isSupportedCountry(region)) return region;
  }
  return null;
}

/**
 * Where the browser thinks it is. Runs only after mount — calling it during
 * render would make the server and client HTML disagree.
 */
export function countryFromBrowser(): CountryCode | null {
  if (typeof window === "undefined") return null;

  const fromZone = countryFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (fromZone) return fromZone;

  return countryFromLocales(navigator.languages ?? [navigator.language]);
}
