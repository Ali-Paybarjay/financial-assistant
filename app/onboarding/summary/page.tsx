import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Money } from "@/components/money";
import { declaredSurplus, monthlyFixed, monthlyIncome, monthlyVariable } from "@/lib/cashflow";
import { RISK_LABELS } from "@/lib/onboarding/config";
import { ExitButton } from "@/components/onboarding/exit-button";
import { FinishButton } from "./finish-button";

export default async function SummaryPage() {
  const viewer = await requireViewer();

  const supabase = await createClient();
  const [{ data: sources }, { data: recurring }, { data: baselines }, { data: goals }] =
    await Promise.all([
      supabase.from("income_sources").select("*").eq("is_active", true),
      supabase.from("recurring_expenses").select("*").eq("is_active", true),
      supabase.from("variable_expense_baselines").select("*"),
      supabase.from("goals").select("title, target_amount").eq("status", "active"),
    ]);

  const incomePerMonth = monthlyIncome(sources ?? []);
  const fixedPerMonth = monthlyFixed(recurring ?? []);
  const variablePerMonth = monthlyVariable(baselines ?? []);

  // Income can be skipped now, and a skipped income is not a zero income. A
  // «what's left» built on it would be minus the rent, and the warning under
  // it would tell someone they are overspending because they left a field
  // blank — so that half of the screen waits until there is a number.
  const incomeKnown = (sources ?? []).length > 0;

  // The same function the savings plan is built on, not a second subtraction
  // that happens to agree today. This screen is where the user first meets
  // «what's left», and a plan that later quotes a different number for it is a
  // plan they have no reason to believe.
  const leftover = declaredSurplus({
    sources: sources ?? [],
    recurring: recurring ?? [],
    baselines: baselines ?? [],
  }).amount;

  const riskLabel = viewer.profile.risk_label
    ? RISK_LABELS[viewer.profile.risk_label]
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface px-4 pb-6 pt-4">
      {/* The last screen of the flow keeps the same way out as every step. */}
      <header className="flex items-center justify-end">
        <ExitButton />
      </header>

      <h1 className="mt-6 font-display text-question font-bold text-ink">
        این تصویر مالی توست
      </h1>
      <p className="mt-2 text-body text-ink-muted">
        از اینجا به بعد، فقط خریدهایت را ثبت کن. بقیه‌اش با من.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <SummaryRow label="درآمد ماهانه">
          {incomeKnown ? (
            <Money minor={incomePerMonth} currency={viewer.currency} size="kpi" />
          ) : (
            <span className="text-label text-ink-faint">هنوز نگفته‌ای</span>
          )}
        </SummaryRow>
        <SummaryRow label="هزینه‌های ثابت ماهانه">
          <Money minor={fixedPerMonth} currency={viewer.currency} size="kpi" />
        </SummaryRow>
        {/* The estimates from step 4. Leaving them out of the subtraction made
            this screen promise a saving rate that groceries ate before the
            month was out. */}
        <SummaryRow label="هزینه‌های متغیر — تخمین خودت">
          <Money minor={variablePerMonth} currency={viewer.currency} size="kpi" />
        </SummaryRow>
        {incomeKnown && (
          <SummaryRow label="آخر ماه برایت می‌ماند">
            <Money
              minor={leftover}
              currency={viewer.currency}
              size="kpi"
              tone="auto"
              signed
            />
          </SummaryRow>
        )}
      </div>

      {!incomeKnown && (
        <p className="mt-3 rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
          درآمدت را هنوز نگفته‌ای، پس نمی‌توانم بگویم آخر ماه چقدر برایت می‌ماند. هر
          وقت خواستی، از تنظیمات اضافه‌اش کن.
        </p>
      )}

      {incomeKnown && leftover < 0 && (
        <p className="mt-3 rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
          هزینه‌هایت از درآمدت بیشتر است. اگر عددی را اشتباه زده‌ای، از تنظیمات درستش
          کن.
        </p>
      )}

      {(riskLabel || (goals && goals.length > 0)) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {riskLabel && (
            <span className="inline-flex h-8 items-center rounded-full bg-action-tint px-3 text-caption font-medium text-action">
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
