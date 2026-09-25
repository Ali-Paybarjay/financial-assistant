"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { audit, changed } from "./audit";
import { adminUserDetail } from "./queries";
import { isProtectedSlug } from "./categories";
import { createClient } from "@/lib/supabase/server";
import { accountIsEmpty, purgeUser, sweepStaleGuests } from "@/lib/guests";
import {
  SETTING_SCHEMAS,
  type AppSettings,
  type SettingKey,
} from "@/lib/settings";
import { appSettings } from "@/lib/settings-server";

/**
 * Everything the panel can change.
 *
 * Four rules hold for every function here, in this order:
 *
 *   1. `await requireAdmin()` on the first line. The middleware gate covers the
 *      POST a server action arrives as, but an action is not a page and should
 *      not depend on a matcher pattern for its only check.
 *   2. Validate with Zod. An action is a public endpoint whose arguments are
 *      whatever the caller sent.
 *   3. Do the thing.
 *   4. `audit()` it, then revalidate. Audit last, because a log written before
 *      the work records things that then did not happen — and audit() can never
 *      fail the action, for the reason given in audit.ts.
 */

export type AdminResult = { error: string } | { ok: true };

const GENERIC_ERROR = "انجام نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

// ------------------------------------------------------------ delete a user ---

/**
 * Deletes an account and everything hanging off it.
 *
 * Three guards, and each one exists because of a different way this goes wrong:
 *
 *   * **Not yourself.** Deleting your own admin account through the panel logs
 *     you out of the tool you would need to fix it with.
 *   * **Not another admin.** Two operators is the case this product does not
 *     have yet and will; «the admin panel can remove admins» is the kind of
 *     thing that should be a deliberate decision rather than a side effect.
 *   * **Type the identifier.** A real address for a real account, the id's
 *     first octet for a guest, who has no address to type. The same shape of
 *     confirmation the user's own «delete my account» asks for.
 *
 * The emptiness check is *not* a guard — an account with rows in it is exactly
 * the kind somebody asks to have deleted. It is shown to the operator before
 * they type, so the confirmation is informed rather than reflexive.
 */
export async function deleteUser(
  userId: string,
  confirmation: string,
): Promise<AdminResult> {
  const admin = await requireAdmin();

  if (!z.string().uuid().safeParse(userId).success) return { error: GENERIC_ERROR };

  if (userId === admin.id) {
    return { error: "حساب خودت را از این‌جا حذف نکن." };
  }

  const target = await adminUserDetail(userId);
  if (!target) return { error: "این حساب پیدا نشد." };

  if (target.is_admin) {
    return { error: "این حساب هم مدیر است. اول دسترسی مدیریتش را بردار." };
  }

  const expected = target.email ?? target.id.slice(0, 8);
  if (confirmation.trim() !== expected) {
    return {
      error: target.email
        ? "ایمیل را دقیقاً همان‌طور که نوشته شده تایپ کن."
        : "هشت نویسهٔ اول شناسه را تایپ کن.",
    };
  }

  // Re-read rather than trust what the page rendered: it may have been open for
  // an hour, and the detail below goes into a log that cannot be corrected.
  const wasEmpty = await accountIsEmpty(userId);

  try {
    await purgeUser(userId);
  } catch {
    return { error: "حذف نشد. دوباره بزن." };
  }

  await audit({
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    detail: {
      email: target.email,
      is_anonymous: target.is_anonymous,
      was_empty: wasEmpty,
      transactions: target.transactions_count,
      media: target.media_count,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect("/admin/users");
}

// --------------------------------------------------------------- purge now ---

/**
 * The nightly sweep, on demand.
 *
 * Calls the same `sweepStaleGuests` the cron route does — not a copy of it — and
 * records itself as `admin` rather than `cron` so the runs list can say which
 * was which. Deleting guests through a second implementation is how the two
 * would come to disagree about what «stale» means.
 */
export async function purgeStaleGuestsNow(): Promise<AdminResult> {
  await requireAdmin();

  const settings = await appSettings();

  try {
    const result = await sweepStaleGuests({
      days: settings.guest_retention_days,
      triggeredBy: "admin",
    });

    await audit({ action: "guests.purge", detail: { ...result } });
  } catch {
    return { error: "جاروب انجام نشد. لاگ را ببین." };
  }

  revalidatePath("/admin/guests");
  revalidatePath("/admin");
  return { ok: true };
}

// -------------------------------------------------------- system categories ---

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  nameFa: z.string().trim().min(1, "نام دسته را بنویس").max(40),
  sortOrder: z.number().int().min(0).max(999),
  costKind: z.enum(["fixed", "variable"]),
  /** Insert only. A slug the code may reference must not become a moving target. */
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,32}$/, "slug فقط حروف کوچک انگلیسی، رقم و خط تیره")
    .optional(),
  kind: z.enum(["expense", "income"]).optional(),
});

export async function saveSystemCategory(raw: unknown): Promise<AdminResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { id, nameFa, sortOrder, costKind, slug, kind } = parsed.data;

  if (id) {
    const { data: before } = await supabase
      .from("categories")
      .select("name_fa, sort_order, cost_kind")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("categories")
      .update({ name_fa: nameFa, sort_order: sortOrder, cost_kind: costKind })
      .eq("id", id)
      .eq("is_system", true);

    if (error) return { error: GENERIC_ERROR };

    await audit({
      action: "category.save",
      targetType: "category",
      targetId: id,
      detail: before
        ? changed(before, { name_fa: nameFa, sort_order: sortOrder, cost_kind: costKind })
        : { name_fa: nameFa },
    });
  } else {
    if (!slug || !kind) return { error: "slug و نوع برای دستهٔ جدید لازم است." };

    const { error } = await supabase.from("categories").insert({
      user_id: null,
      is_system: true,
      name_fa: nameFa,
      slug,
      kind,
      cost_kind: costKind,
      sort_order: sortOrder,
    });

    if (error) {
      // The unique index is on (user_id, slug), so this is the one failure worth
      // naming: everything else is a bug rather than something the operator did.
      return {
        error: error.code === "23505" ? "این slug از قبل هست." : GENERIC_ERROR,
      };
    }

    await audit({
      action: "category.create",
      targetType: "category",
      targetId: slug,
      detail: { name_fa: nameFa, kind, cost_kind: costKind },
    });
  }

  // Every user's composer lists these, and so does the model's prompt.
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function deleteSystemCategory(id: string): Promise<AdminResult> {
  await requireAdmin();

  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC_ERROR };

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("slug, name_fa, is_system")
    .eq("id", id)
    .maybeSingle();

  if (!category || !category.is_system) return { error: "این دستهٔ سیستمی نیست." };

  if (isProtectedSlug(category.slug)) {
    return { error: "کد به این دسته با نام ارجاع می‌دهد؛ حذفش اپ را می‌شکند." };
  }

  // Five tables reference a category, and «unused» has to mean all five: one
  // with no transactions can still be what somebody's rent is filed under.
  const { data: usage } = await supabase.rpc("admin_category_usage");
  const counts = usage?.find((row) => row.category_id === id);
  const inUse =
    counts &&
    counts.transactions +
      counts.statement_lines +
      counts.recurring +
      counts.budgets +
      counts.baselines >
      0;

  if (inUse) return { error: "این دسته استفاده شده. اسمش را عوض کن، حذفش نکن." };

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("is_system", true);

  if (error) return { error: GENERIC_ERROR };

  await audit({
    action: "category.delete",
    targetType: "category",
    targetId: category.slug,
    detail: { name_fa: category.name_fa },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  return { ok: true };
}

// ---------------------------------------------------------------- settings ---

/**
 * Writes the runtime knobs.
 *
 * Upsert rather than update: the defaults are seeded by migration 0027, but a
 * key added to lib/settings.ts later will have no row until someone saves one,
 * and «the new setting silently does nothing» is a bad first impression of a
 * settings page.
 */
export async function saveSettings(raw: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();

  const shape = z.object({
    ai_enabled: SETTING_SCHEMAS.ai_enabled,
    ai_daily_limits: SETTING_SCHEMAS.ai_daily_limits,
    guest_daily_calls: SETTING_SCHEMAS.guest_daily_calls,
    guest_retention_days: SETTING_SCHEMAS.guest_retention_days,
    maintenance_banner: SETTING_SCHEMAS.maintenance_banner,
  });

  const parsed = shape.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const before = await appSettings();
  const after = parsed.data as AppSettings;

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert(
    (Object.keys(after) as SettingKey[]).map((key) => ({
      key,
      value: after[key],
      updated_by: admin.id,
    })),
    { onConflict: "key" },
  );

  if (error) return { error: GENERIC_ERROR };

  await audit({
    action: "settings.save",
    targetType: "app_settings",
    detail: changed(before, after),
  });

  // The banner is in the app's layout and the ceilings are read on the AI
  // routes, so every signed-in page has to be re-rendered.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { ok: true };
}
