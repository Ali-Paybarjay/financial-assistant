import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SaveAccountForm } from "./save-account-form";

/**
 * Reachable from the guest banner, the welcome sheet, the exit sheet and
 * settings. It lives outside the (app) group on purpose: a guest who is still
 * part-way through onboarding must be able to secure their account without that
 * layout's onboarding gate bouncing them back to the step they were on.
 */
export default async function SaveAccountPage() {
  const user = await getSessionUser();

  if (!user) redirect("/login");
  if (!user.is_anonymous) redirect("/settings");

  return <SaveAccountForm />;
}
