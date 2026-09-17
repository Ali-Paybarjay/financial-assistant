import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GoalsView } from "./goals-view";

export default async function GoalsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data } = await supabase
    .from("goals")
    .select("*")
    .order("priority")
    .order("created_at");

  return <GoalsView currency={viewer.currency} goals={data ?? []} />;
}
