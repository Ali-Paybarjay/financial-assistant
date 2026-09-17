"use client";

import { ArrowDown, ArrowUp } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { faNumber, faPercent } from "@/lib/format";
import { savingsRate, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";

type Totals = { income: number; expense: number };

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function Delta({ value, higherIsBetter }: { value: number | null; higherIsBetter: boolean }) {
  if (value === null || value === 0) return null;
  const good = higherIsBetter ? value > 0 : value < 0;

  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-micro font-semibold",
        good ? "text-positive" : "text-negative",
      )}
    >
      {value > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {faPercent(Math.abs(value))}
    </span>
  );
}

export function KpiCards({
  totals,
  previous,
  currency,
  hasUnconfirmed,
}: {
  totals: Totals;
  previous: Totals;
  currency: CurrencyCode;
  hasUnconfirmed: boolean;
}) {
  const rate = savingsRate(totals.income, totals.expense);
  const previousRate = savingsRate(previous.income, previous.expense);

  return (
    <div className="grid grid-cols-3 gap-2">
      <Card label="درآمد" testId="kpi-income">
        <Money minor={totals.income} currency={currency} size="kpi" />
        <Delta value={percentChange(totals.income, previous.income)} higherIsBetter />
      </Card>

      <Card label="هزینه" testId="kpi-expense">
        <span
          className={cn(
            // The confidence rule at dashboard scale: the total contains rows
            // the user has not confirmed yet.
            hasUnconfirmed && "border-b-2 border-dashed border-guess pb-[2px]",
          )}
        >
          <Money minor={totals.expense} currency={currency} size="kpi" />
        </span>
        <Delta
          value={percentChange(totals.expense, previous.expense)}
          higherIsBetter={false}
        />
      </Card>

      <Card label="نرخ پس‌انداز" testId="kpi-savings-rate">
        <span className="text-[16px] font-semibold text-ink">
          {rate === null ? "—" : faPercent(rate)}
        </span>
        {rate !== null && previousRate !== null && rate !== previousRate && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-micro font-semibold",
              rate > previousRate ? "text-positive" : "text-negative",
            )}
          >
            {rate > previousRate ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {faNumber(Math.abs(Math.round((rate - previousRate) * 10) / 10))}
          </span>
        )}
      </Card>
    </div>
  );
}

function Card({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-0.5 rounded-card border border-hairline bg-surface px-2.5 py-3"
    >
      <span className="text-micro text-ink-muted">{label}</span>
      {children}
    </div>
  );
}
