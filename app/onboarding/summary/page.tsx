import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Money } from "@/components/money";
import { monthlyFixed, monthlyIncome } from "@/lib/cashflow";
import { RISK_LABELS } from "@/lib/onboarding/config";
import { ExitButton } from "@/components/onboarding/exit-button";
import { FinishButton } from "./finish-button";

export default async function SummaryPage() {
  const viewer = await requireViewer();
  if (viewer.profile.onboarding_completed_at) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: sources }, { data: recurring }, { data: goals }] = await Promise.all([
    supabase.from("income_sources").select("*").eq("is_active", true),
    supabase.from("recurring_expenses").select("*").eq("is_active", true),
    supabase.from("goals").select("title, target_amount").eq("status", "active"),
  ]);

  const incomePerMonth = monthlyIncome(sources ?? []);
  const fixedPerMonth = monthlyFixed(recurring ?? []);
  const leftover = incomePerMonth - fixedPerMonth;

  const riskLabel = viewer.profile.risk_label
    ? RISK_LABELS[viewer.profile.risk_label]
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface px-4 pb-6 pt-4">
      {/* The last screen of the flow keeps the same way out as every step. */}
      <header className="flex items-center justify-end">
        <ExitButton />
      </header>

      <h1 className="mt-6 font-display text-display-l font-bold text-ink">
        این تصویر مالی توست
      </h1>
      <p className="mt-2 text-body text-ink-muted">
        از اینجا به بعد، فقط خریدهایت را ثبت کن. بقیه‌اش با من.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <SummaryRow label="درآمد ماهانه">
          <Money minor={incomePerMonth} currency={viewer.currency} size="kpi" />
        </SummaryRow>
        <SummaryRow label="هزینه‌های ثابت ماهانه">
          <Money minor={fixedPerMonth} currency={viewer.currency} size="kpi" />
        </SummaryRow>
        <SummaryRow label="بعد از هزینه‌های ثابت برایت می‌ماند">
          <Money
            minor={leftover}
            currency={viewer.currency}
            size="kpi"
            tone="auto"
            signed
          />
        </SummaryRow>
      </div>

      {leftover < 0 && (
        <p className="mt-3 rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
          هزینه‌های ثابتت از درآمدت بیشتر است. اگر عددی را اشتباه زده‌ای، از تنظیمات
          درستش کن.
        </p>
      )}

      {(riskLabel || (goals && goals.length > 0)) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {riskLabel && (
            <span className="inline-flex h-8 items-center rounded-full bg-lapis-tint px-3 text-caption font-medium text-lapis">
              ریسک‌پذیری: {riskLabel}
            </span>
          )}
          {goals?.map((goal) => (
            <span
              key={goal.title}
              className="inline-flex h-8 items-center rounded-full bg-paper px-3 text-caption font-medium text-ink-muted"
            >
              {goal.title}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-10">
        <FinishButton />
      </div>
    </main>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-card border border-hairline bg-paper px-4 py-3.5">
      <span className="text-label text-ink-muted">{label}</span>
      {children}
    </div>
  );
}
