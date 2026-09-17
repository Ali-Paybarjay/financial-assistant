/**
 * Jalali (Solar Hijri) to Gregorian conversion.
 *
 * Iranian bank statements print dates as 1404/06/26, not 2025-09-17, and the
 * whole app stores and reasons in Gregorian. Converting between the two is
 * arithmetic with a known answer, so it is done here rather than asked of a
 * model: a model that gets a date wrong produces a transaction filed in the
 * wrong month, and nothing downstream can notice.
 *
 * The algorithm is Kazimierz M. Borkowski's, in the form published as
 * jalaali-js (MIT, Behdad Esfahbod / Roozbeh Pournader). `breaks` are the
 * years at which the 33-year leap cycle shifts; they are not derivable, which
 * is why they are transcribed rather than computed.
 */

import type { IsoDate } from "./date";

/** Truncating integer division. Both operands here are always finite. */
function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

function mod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

const BREAKS: readonly number[] = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
];

export class JalaliRangeError extends Error {}

/** The Gregorian year, and the day of March on which Farvardin 1 falls. */
function farvardinFirst(jy: number): { gy: number; march: number } {
  if (jy < BREAKS[0] || jy >= BREAKS[BREAKS.length - 1]) {
    throw new JalaliRangeError(`Jalali year out of range: ${jy}`);
  }

  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;

  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  const n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;

  return { gy, march: 20 + leapJ - leapG };
}

/** Gregorian date to Julian Day Number. */
function gregorianToJdn(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d -= div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) - 752;
  return d;
}

function jdnToGregorian(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * `jalaliToIso(1404, 6, 26)` -> `'2025-09-17'`.
 *
 * Throws rather than returning a wrong date: a statement row whose date cannot
 * be converted must be dropped, not filed under an approximation.
 */
export function jalaliToIso(jy: number, jm: number, jd: number): IsoDate {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) {
    throw new JalaliRangeError(`Not a Jalali date: ${jy}/${jm}/${jd}`);
  }
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) {
    throw new JalaliRangeError(`Not a Jalali date: ${jy}/${jm}/${jd}`);
  }

  const { gy, march } = farvardinFirst(jy);
  const jdn =
    gregorianToJdn(gy, 3, march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;

  const gregorian = jdnToGregorian(jdn);
  return `${gregorian.gy}-${pad(gregorian.gm)}-${pad(gregorian.gd)}`;
}

/**
 * A year written as 04 or 404 on a statement. Jalali years in circulation are
 * four digits beginning with 1, so the century is never ambiguous the way a
 * two-digit Gregorian year is.
 */
export function expandJalaliYear(year: number): number {
  if (year >= 1000) return year;
  if (year >= 100) return 1000 + year;
  return 1400 + year;
}
