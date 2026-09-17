"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { RISK_QUESTIONS, scoreRisk } from "@/lib/onboarding/config";

const answersSchema = z
  .array(z.number().int().min(1).max(4))
  .length(RISK_QUESTIONS.length);

export async function saveRiskAnswers(
  raw: unknown,
): Promise<{ error: string } | never> {
  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) return { error: "به همه‌ی سؤال‌ها جواب بده." };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const { score, label } = scoreRisk(parsed.data);

  const { error } = await supabase
    .from("profiles")
    .update({
      risk_score: score,
      risk_label: label as "conservative" | "balanced" | "growth",
    })
    .eq("id", viewer.userId);

  if (error) return { error: "ذخیره نشد. دوباره بزن." };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  redirect("/settings");
}
