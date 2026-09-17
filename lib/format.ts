const FA_NUMBER = new Intl.NumberFormat("fa-IR");

/**
 * Persian digits for every number that is not money. Money is the one
 * exception in this design system — it stays Latin and tabular, and goes
 * through <Money /> instead.
 */
export function faNumber(value: number): string {
  return FA_NUMBER.format(value);
}

export function faPercent(value: number): string {
  return `${FA_NUMBER.format(value)}٪`;
}

const WORDS = [
  "صفر",
  "یک",
  "دو",
  "سه",
  "چهار",
  "پنج",
  "شش",
  "هفت",
  "هشت",
  "نه",
  "ده",
];

/** Small counts read better as words inside a sentence: «ثبت دو تراکنش». */
export function faCount(value: number): string {
  return WORDS[value] ?? FA_NUMBER.format(value);
}
