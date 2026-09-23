"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";

export type DismissResult = { error: string } | { ok: true };

/**
 * Wave an insight away.
 *
 * The key carries its own scope — «weekly_delta:2026-W38», not
 * «weekly_delta» — so this silences the observation the user actually read
 * and not the rule that produced it. Next week's comparison has a different
 * key and comes back, which is the point: they dismissed a sentence, not a
 * subject.
 *
 * It lived under /stream until that tab was removed. The table it writes to
 * is unchanged.
 */
export async function dismissInsight(key: string): Promise<DismissResult> {
  if (!key.trim()) return { error: "این پیام شناسه ندارد." };

  const viewer = await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("insight_dismissals")
    .upsert(
      { user_id: viewer.userId, insight_key: key },
      { onConflict: "user_id,insight_key" },
    );

  if (error) return { error: "بسته نشد. دوباره بزن." };

  revalidatePath("/dashboard");
  return { ok: true };
}
