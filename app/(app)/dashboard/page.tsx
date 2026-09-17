import { Money } from "@/components/money";
import { ConfidenceValue } from "@/components/confidence-rule";

/**
 * M0 specimen: proves the token system, the two typefaces, RTL and the two
 * shared primitives render correctly. M5 replaces this with the real dashboard.
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
      <section className="rounded-card bg-surface p-4">
        <p className="text-label text-ink-muted">مانده‌ی این ماه</p>
        <Money minor={113160} currency="CAD" size="hero" tone="auto" signed />
        <p className="mt-1 text-caption text-ink-muted">
          ۱۴ روز تا پایان ماه · روزی <Money minor={8082} currency="CAD" />
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[
          { label: "درآمد", minor: 425000 },
          { label: "هزینه", minor: 311840 },
          { label: "نرخ پس‌انداز", minor: null },
        ].map((card) => (
          <div key={card.label} className="rounded-card bg-surface p-3">
            <p className="text-micro text-ink-muted">{card.label}</p>
            {card.minor === null ? (
              <p className="text-[16px] font-semibold tabular-nums">26.6%</p>
            ) : (
              <Money minor={card.minor} currency="CAD" size="kpi" />
            )}
          </div>
        ))}
      </section>

      <section className="flex gap-6 rounded-card bg-surface p-4">
        <ConfidenceValue isGuess={false} label="دسته">
          خوراک و سوپرمارکت
        </ConfidenceValue>
        <ConfidenceValue isGuess label="فروشنده">
          سوپرمارکت
        </ConfidenceValue>
      </section>
    </main>
  );
}
