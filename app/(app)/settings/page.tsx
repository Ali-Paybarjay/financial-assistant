import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/queries/categories";
import { listMissingOnboardingSteps } from "@/lib/queries/onboarding";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  // Whether changing the base currency would strand anything. Counted rather
  // than assumed, and capped at one row because the question is «any?» — the
  // head:true count is the cheapest way to ask it.
  const [categories, missingSteps, recorded, accounts] = await Promise.all([
    listCategories(),
    listMissingOnboardingSteps(viewer.profile),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .limit(1),
    supabase.from("accounts").select("id", { count: "exact", head: true }).limit(1),
  ]);

  const ledgerIsEmpty = (recorded.count ?? 0) === 0 && (accounts.count ?? 0) === 0;

  return (
    <SettingsView
      profile={viewer.profile}
      email={viewer.email}
      currency={viewer.currency}
      categories={categories}
      missingSteps={missingSteps}
      ledgerIsEmpty={ledgerIsEmpty}
    />
  );
}
