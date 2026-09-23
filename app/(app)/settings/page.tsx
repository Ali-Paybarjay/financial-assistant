import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listMissingOnboardingSteps } from "@/lib/queries/onboarding";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const [categories, missingSteps] = await Promise.all([
    listCategories(),
    listMissingOnboardingSteps(viewer.profile),
  ]);

  return (
    <SettingsView
      profile={viewer.profile}
      email={viewer.email}
      currency={viewer.currency}
      categories={categories}
      missingSteps={missingSteps}
    />
  );
}
