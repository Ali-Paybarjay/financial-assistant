import { redirect } from "next/navigation";
import { EMAIL_AUTH_ENABLED } from "@/lib/auth-methods";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  // A reset is an email, and email is off for now. See lib/auth-methods.ts.
  if (!EMAIL_AUTH_ENABLED) redirect("/login");

  return <ForgotPasswordForm />;
}
