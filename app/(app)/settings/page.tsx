import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const categories = await listCategories();

  return (
    <SettingsView
      profile={viewer.profile}
      email={viewer.email}
      currency={viewer.currency}
      categories={categories}
    />
  );
}
