/**
 * One vocabulary of tone for every status string the panel renders.
 *
 * Four tables in this schema carry a status column and none of them shares a
 * value set with another: `ai_usage_logs.status`, `statement_imports.status`,
 * `media_assets.status`, plus the states the panel invents (`stuck`, `guest`).
 * Colouring them at each call site would mean deciding four times whether
 * `rejected` is bad news, and getting a different answer somewhere.
 *
 * It is not: `rejected` is the app refusing to spend money on a call that was
 * over the ceiling or made while the model was switched off. That is the
 * safeguard working, so it reads as provisional — the same brass the app uses
 * for «حدس زدم» — rather than as a failure.
 *
 * Pure, so it can be unit-tested and so a status the schema grows later falls
 * back to something harmless instead of rendering an unstyled pill.
 */

export type Tone = "ok" | "bad" | "wait" | "mute" | "accent";

const TONES: Record<string, Tone> = {
  // ai_usage_logs
  ok: "ok",
  rejected: "wait",
  rate_limit: "wait",
  timeout: "bad",
  provider: "bad",
  malformed: "bad",
  // statement_imports
  applied: "ok",
  review: "accent",
  parsing: "wait",
  uploading: "wait",
  failed: "bad",
  discarded: "mute",
  // media_assets
  parsed: "ok",
  processing: "wait",
  // the panel's own
  stuck: "bad",
  guest: "wait",
  google: "accent",
  email: "mute",
};

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return "mute";
  return TONES[status] ?? "mute";
}

/**
 * Persian for each status, so a pill never shows a database string.
 *
 * Short on purpose: these sit in table cells 60px wide on a phone.
 */
const LABELS: Record<string, string> = {
  ok: "سالم",
  rejected: "ردشده",
  rate_limit: "سقف",
  timeout: "تایم‌اوت",
  provider: "ارائه‌دهنده",
  malformed: "بدشکل",
  applied: "اعمال شد",
  review: "بازبینی",
  parsing: "پارس",
  uploading: "آپلود",
  failed: "شکست",
  discarded: "رها شد",
  parsed: "خوانده شد",
  processing: "در پردازش",
  uploaded: "آپلود شد",
  stuck: "گیرکرده",
  guest: "مهمان",
  google: "گوگل",
  email: "ایمیل",
  unknown: "نامعلوم",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return LABELS[status] ?? status;
}

/** The three AI routes, named the way a person would say them. */
export const FEATURE_LABELS: Record<string, string> = {
  parse_text: "متن آزاد",
  parse_receipt: "عکس فاکتور",
  parse_statement: "صورت‌حساب بانکی",
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

/**
 * Which statuses are a failure, and which are the app deciding not to spend.
 *
 * Exported because both the overview RPC and the AI page's fold have to agree
 * on this list, and the SQL side has it written out in `admin_overview`.
 */
export const FAILURE_STATUSES = ["timeout", "rate_limit", "provider", "malformed"] as const;

export function isFailure(status: string): boolean {
  return (FAILURE_STATUSES as readonly string[]).includes(status);
}
