import "server-only";

import { headers } from "next/headers";
import { countryFromTimeZone, isSupportedCountry, type CountryCode } from "./geo";

/**
 * The country the edge network thinks the request came from. Used only as the
 * first guess in the onboarding form, before the browser gets a chance to
 * correct it on mount — it is the weaker of the two signals, because a VPN
 * moves the IP address and not the clock.
 *
 * Returns null off Vercel (local dev sends no such header) and for any country
 * the app does not support, so the caller falls back rather than storing a
 * code that would fail the form's own enum.
 */
export async function countryFromRequest(): Promise<CountryCode | null> {
  const headerList = await headers();

  const country = headerList.get("x-vercel-ip-country");
  if (isSupportedCountry(country)) return country;

  return countryFromTimeZone(headerList.get("x-vercel-ip-timezone"));
}
