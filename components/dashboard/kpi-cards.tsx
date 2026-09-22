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

/**
 * The month's three figures, in a row on the sheet.
 *
 * Not three cards. A card is a claim that the thing inside it is a separate
 * object, and these are three readings of one month — the border around each
 * was saying otherwise, and three identical borders said it three times. They
 * are siblings in a row, so a rule between them is enough to keep them apart.
 */
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
    <div className="grid grid-cols-3">
      <Figure label="درآمد" testId="kpi-income">
        <Money minor={totals.income} currency={currency} size="kpi" />
        <Delta value={percentChange(totals.income, previous.income)} higherIsBetter />
      </Figure>

      <Figure label="هزینه" testId="kpi-expense">
        {/* The rule grammar at total scale: this sum contains rows nobody has
            confirmed yet, so the figure itself is still provisional. */}
        <span className={cn("w-fit", hasUnconfirmed && "rule-guess")}>
          <Money minor={totals.expense} currency={currency} size="kpi" />
        </span>
        <Delta
          value={percentChange(totals.expense, previous.expense)}
          higherIsBetter={false}
        />
      </Figure>

      <Figure label="نرخ پس‌انداز" testId="kpi-savings-rate">
        <span className="text-figure-md font-semibold text-ink">
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
      </Figure>
    </div>
  );
}

function Figure({
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
      /* border-s on every one and none on the first: a divider belongs between
         siblings, not around them. */
      className="flex flex-col gap-1 border-s border-hairline px-3 first:border-s-0 first:ps-0"
    >
      <span className="text-caption text-ink-muted">{label}</span>
      {children}
    </div>
  );
}
