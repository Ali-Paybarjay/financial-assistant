"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

/**
 * Add to app/(app)/settings/actions.ts — do not create a second actions file.
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
