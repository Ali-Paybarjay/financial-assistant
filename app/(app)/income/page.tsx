import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/queries/categories";
import { IncomeView } from "./income-view";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const [{ data: sources }, { data: recurring }, categories] = await Promise.all([
    supabase.from("income_sources").select("*").order("created_at"),
    supabase.from("recurring_expenses").select("*").order("due_day"),
    listCategories(),
  ]);

  return (
    <IncomeView
      initialTab={tab === "recurring" ? "recurring" : "income"}
      currency={viewer.currency}
      sources={sources ?? []}
      recurring={recurring ?? []}
      categories={categories}
    />
  );
}
