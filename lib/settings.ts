import { z } from "zod";

/**
 * The handful of numbers an operator should be able to change without waiting
 * for a build.
 *
 * Every value here already existed as a constant, and every one of them is
 * something you want to change during a bad afternoon rather than after one:
 * the model's kill switch, the three daily ceilings, the guest ceiling, how
 * long an abandoned guest is kept, and a sentence to put above the app.
 *
 * The constants remain the defaults and this falls back to them **per key**.
 * A missing row, a value that fails its schema, or a database that cannot be
 * reached leaves the app behaving exactly as it did before the table existed.
 * That is the point: a settings table that can take the app down when it is
 * empty is worse than no settings table.
 *
 * Split the way lib/theme.ts is split from lib/theme-server.ts, and for the same
 * two reasons: the settings form is a client component and needs these types,
 * and `parseSettings` is the interesting logic here — a `server-only` import at
 * the top would make it the one rule in this feature that cannot be unit-tested.
 * Everything that touches the database lives in lib/settings-server.ts.
 */

const limitsSchema = z.object({
  parse_text: z.number().int().min(0).max(1000),
  parse_receipt: z.number().int().min(0).max(1000),
  parse_statement: z.number().int().min(0).max(1000),
});

export const SETTING_SCHEMAS = {
  ai_enabled: z.boolean(),
  ai_daily_limits: limitsSchema,
  guest_daily_calls: z.number().int().min(0).max(100),
  /**
   * At least one day. Zero would mean «delete a guest the moment they stop
   * typing», which is not retention, it is a bug with a number in front of it.
   * The admin action that purges on demand reads the same value, so a zero
   * here would also make that button delete the guest currently using the app.
   */
  guest_retention_days: z.number().int().min(1).max(90),
  /**
   * Empty = no banner. 200 characters is two lines on a phone.
   *
   * A string rather than a nullable one, and that is a database fact rather
   * than a preference: `app_settings.value` is `jsonb not null`, and
   * supabase-js sends a JavaScript null as SQL NULL — so «clear the banner»
   * would fail the not-null constraint. Keeping every value a real JSON value
   * also removes the difference between SQL NULL and JSON null, which is a
   * distinction nothing here wants to have to mean something.
   */
  maintenance_banner: z.string().trim().max(200),
} as const;

export type AppSettings = {
  [K in keyof typeof SETTING_SCHEMAS]: z.infer<(typeof SETTING_SCHEMAS)[K]>;
};

export type SettingKey = keyof AppSettings;

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

/**
 * The shipped behaviour, and the answer whenever the table cannot supply one.
 *
 * These numbers are argued for in lib/ai/usage.ts and lib/guests.ts; the
 * reasoning lives there, beside the code that spends the money.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  ai_enabled: true,
  ai_daily_limits: { parse_text: 60, parse_receipt: 20, parse_statement: 5 },
  guest_daily_calls: 3,
  guest_retention_days: 7,
  maintenance_banner: "",
};

export type SettingRow = { key: string; value: unknown };

/**
 * Rows in, settings out, with no I/O — so the fallback rules are unit-testable
 * without a database.
 *
 * Per key, not per table: one malformed row must not reset the other four. A
 * guest ceiling someone fat-fingered into a string should cost that ceiling
 * its custom value, not switch the model off for everybody.
 */
export function parseSettings(rows: readonly SettingRow[] | null): AppSettings {
  const byKey = new Map((rows ?? []).map((row) => [row.key, row.value]));

  const result = { ...DEFAULT_SETTINGS };

  for (const key of SETTING_KEYS) {
    if (!byKey.has(key)) continue;
    const parsed = SETTING_SCHEMAS[key].safeParse(byKey.get(key));
    if (parsed.success) {
      // Each key's schema produces exactly its own value type; the map's
      // union is what TypeScript cannot narrow here.
      (result as Record<string, unknown>)[key] = parsed.data;
    }
  }

  return result;
}
