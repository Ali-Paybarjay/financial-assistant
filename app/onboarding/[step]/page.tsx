import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/queries/categories";
import { stepMeta, TOTAL_STEPS } from "@/lib/onboarding/config";
import { countryFromRequest } from "@/lib/onboarding/request-geo";
import { Step1 } from "./steps/step-1";
import { Step2 } from "./steps/step-2";
import { Step3 } from "./steps/step-3";
import { Step4 } from "./steps/step-4";
import { Step5 } from "./steps/step-5";
import { Step6 } from "./steps/step-6";
import { Step7 } from "./steps/step-7";

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: rawStep } = await params;
  const step = Number(rawStep);
  const meta = stepMeta(step);
  if (!meta) notFound();

  const viewer = await requireViewer();

  // A user can revisit any step they have reached, but not skip ahead of it —
  // while the flow is still the way in. Once they are in the app it is a form
  // they come back to from settings, which sends them to whichever step is
  // empty, so the gate stands down.
  if (!viewer.profile.onboarding_completed_at) {
    const furthest = Math.min(viewer.profile.onboarding_step + 1, TOTAL_STEPS);
    if (step > furthest) redirect(`/onboarding/${furthest}`);
  }

  const supabase = await createClient();

  switch (step) {
    case 1:
      return (
        <Step1
          meta={meta}
          profile={viewer.profile}
          prefill={{
            fullName: viewer.identity.fullName,
            countryCode: await countryFromRequest(),
          }}
        />
      );

    case 2: {
      const { data } = await supabase
        .from("income_sources")
        .select("*")
        .order("created_at", { ascending: true });
      return (
        <Step2
          meta={meta}
          currency={viewer.currency}
          profile={viewer.profile}
          sources={data ?? []}
        />
      );
    }

    case 3: {
      const [{ data }, categories] = await Promise.all([
        supabase.from("recurring_expenses").select("*").order("created_at"),
        listCategories(),
      ]);
      return (
        <Step3
          meta={meta}
          currency={viewer.currency}
          categories={categories}
          expenses={data ?? []}
        />
      );
    }

    case 4: {
      const [{ data }, categories] = await Promise.all([
        supabase.from("variable_expense_baselines").select("*"),
        listCategories(),
      ]);
      return (
        <Step4
          meta={meta}
          currency={viewer.currency}
          categories={categories}
          baselines={data ?? []}
        />
      );
    }

    case 5: {
      const { data } = await supabase.from("goals").select("*").order("created_at");
      return <Step5 meta={meta} currency={viewer.currency} goals={data ?? []} />;
    }

    case 6:
      return <Step6 meta={meta} />;

    default:
      return <Step7 meta={meta} currency={viewer.currency} profile={viewer.profile} />;
  }
}
