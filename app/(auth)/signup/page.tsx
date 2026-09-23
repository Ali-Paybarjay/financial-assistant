import { redirect } from "next/navigation";
import { EMAIL_AUTH_ENABLED } from "@/lib/auth-methods";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  // Nothing can deliver the confirmation link yet, so an account made here
  // could never be signed in to. Google is the way in for now; the page and
  // its form stay for the day email comes back. See lib/auth-methods.ts.
  if (!EMAIL_AUTH_ENABLED) redirect("/login");

  return <SignupForm />;
}
