import { getSessionUser, requireViewer } from "@/lib/auth";
import { isAdmin } from "@/lib/admin/claims";
import { listCategories } from "@/lib/queries/categories";
import { listMissingOnboardingSteps } from "@/lib/queries/onboarding";
import { hasRecordedMoney } from "@/lib/queries/money-data";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const user = await getSessionUser();

  /**
   * Whether changing the base currency would relabel money that is already
   * recorded. It used to count transactions and accounts only, which missed
   * income sources, fixed costs, goals, baselines, ceilings and dong groups —
   * every one of which stores an amount in the base currency too. The probe
   * now asks all eight tables, and it is the same probe the action re-runs
   * before it writes, so the disabled control and the refusal cannot disagree.
   */
  const [categories, missingSteps, ledgerHasMoney] = await Promise.all([
    listCategories(),
    listMissingOnboardingSteps(viewer.profile),
    hasRecordedMoney(viewer.userId),
  ]);

  return (
    <SettingsView
      profile={viewer.profile}
      email={viewer.email}
      currency={viewer.currency}
      categories={categories}
      missingSteps={missingSteps}
      ledgerIsEmpty={!ledgerHasMoney}
      isAdmin={isAdmin(user)}
    />
  );
}
