"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { purgeUser } from "@/lib/guests";
import { requireViewer } from "@/lib/auth";
import { CURRENCIES } from "@/lib/money";
import { profileSchema } from "@/lib/validation/onboarding";

export type SettingsResult = { error: string } | { ok: true };

const GENERIC_ERROR = "ذخیره نشد. دوباره بزن؛ اگر باز هم نشد، صفحه را تازه کن.";

export async function updateProfile(raw: unknown): Promise<SettingsResult> {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      country_code: parsed.data.countryCode,
      birth_year: parsed.data.birthYear,
      employment_status: parsed.data.employmentStatus,
    })
    .eq("id", viewer.userId);

  if (error) return { error: GENERIC_ERROR };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Changing the base currency does not convert anything. Existing rows keep the
 * currency they were recorded in, which is why the UI states that before the
 * tap rather than after it.
 */
export async function updateCurrency(raw: unknown): Promise<SettingsResult> {
  const parsed = z.enum(CURRENCIES).safeParse(raw);
  if (!parsed.success) return { error: GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ base_currency: parsed.data })
    .eq("id", viewer.userId);

  if (error) return { error: GENERIC_ERROR };
  revalidatePath("/", "layout");
  return { ok: true };
}

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  nameFa: z.string().trim().min(1, "نام دسته را بنویس").max(40),
  kind: z.enum(["expense", "income"]),
});

export async function saveCategory(raw: unknown): Promise<SettingsResult> {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const viewer = await requireViewer();
  const supabase = await createClient();

  if (parsed.data.id) {
    const { error } = await supabase
      .from("categories")
      .update({ name_fa: parsed.data.nameFa })
      .eq("id", parsed.data.id);
    if (error) return { error: GENERIC_ERROR };
  } else {
    const slug = `user-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("categories").insert({
      user_id: viewer.userId,
      name_fa: parsed.data.nameFa,
      slug,
      kind: parsed.data.kind,
      is_system: false,
      sort_order: 100,
    });
    if (error) return { error: GENERIC_ERROR };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<SettingsResult> {
  await requireViewer();
  const supabase = await createClient();

  // Transactions keep their history: the foreign key is ON DELETE SET NULL,
  // so removing a category empties the field rather than the row.
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("is_system", false);

  if (error) return { error: GENERIC_ERROR };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteAccount(confirmation: string): Promise<SettingsResult> {
  const viewer = await requireViewer();

  const expected = (viewer.profile.full_name ?? "").trim();
  if (!expected || confirmation.trim() !== expected) {
    return { error: "نامت را دقیقاً همان‌طور که نوشته شده تایپ کن." };
  }

  // purgeUser, not a bare deleteUser: the uploads have no foreign key back to
  // auth.users, so deleting the account on its own leaves every receipt and
  // bank statement the person uploaded sitting in storage. This path had that
  // bug for as long as it has existed — the sweep in lib/guests.ts was the only
  // place that swept, and it only ran for guests.
  try {
    await purgeUser(viewer.userId);
  } catch {
    return { error: "حذف نشد. دوباره بزن." };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Where «/» should land next time.
 *
 * Passing null puts the chooser back. This is the *destination of one route*,
 * not the current workspace — see the comment in lib/workspaces.ts, which is
 * the thing this is most likely to be mistaken for.
 */
export async function setDefaultWorkspace(
  workspace: "personal" | "dong" | null,
): Promise<SettingsResult> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ default_workspace: workspace })
    .eq("id", viewer.userId);

  if (error) return { error: "ذخیره نشد. دوباره بزن." };

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

/**
 *
 * Writes the cookie (so the next server render is already right) and the
 * profile (so a second device agrees). The cookie is the one the stylesheet
 * depends on; the profile write is allowed to fail without breaking the UI,
 * because the theme has already been applied on the client.
 */
export async function saveTheme(theme: Theme): Promise<{ error?: string }> {
  if (!isTheme(theme)) return { error: "این تم را نمی‌شناسم." };

  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { error } = await supabase
    .from("profiles")
    .update({ theme })
    .eq("id", user.id);

  if (error) return { error: "تم روی این دستگاه عوض شد ولی ذخیره نشد." };

  revalidatePath("/", "layout");
  return {};
}
