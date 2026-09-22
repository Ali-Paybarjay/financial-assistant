"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ArrowLeft, CheckCircle, Handshake } from "@phosphor-icons/react/dist/ssr";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { faNumber, faPercent } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import type { DongMemberRow } from "@/lib/supabase/database.types";
import type { DongExpenseWithShares } from "@/lib/queries/dong";
import {
  byTag,
  isSquare,
  outstandingTotal,
  settlementPlan,
  standing,
  type MemberBalance,
  type Transfer,
} from "@/lib/dong";
import { MemberName } from "./rows";

/** Same single-hue ramp as the dashboard's donut, for the same reasons. */
const RAMP = ["#23459b", "#3e5cb2", "#6280c8", "#93a8dc", "#c2cdeb"];
const OTHER = "#c9cdd4";

export function DongReport({
  balances,
  members,
  expenses,
  currency,
  onSettle,
}: {
  balances: MemberBalance[];
  members: Map<string, DongMemberRow>;
  expenses: DongExpenseWithShares[];
  currency: CurrencyCode;
  /** Opens the payment form already filled in from a suggested transfer. */
  onSettle: (transfer: Transfer) => void;
}) {
  const plan = settlementPlan(balances);
  const square = isSquare(balances);
  const outstanding = outstandingTotal(balances);
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Biggest debt first: that is the order the group will actually settle in.
  const ordered = [...balances].sort(
    (a, b) => a.net - b.net || (members.get(a.memberId)?.sort_order ?? 0),
  );

  if (expenses.length === 0) {
    return (
      <p className="rounded-well border border-dashed border-hairline-strong/45 bg-surface px-4 py-8 text-center text-caption text-ink-muted">
        تا خریدی ثبت نشود، چیزی برای حساب‌کردن نیست.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-well bg-paper p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-caption text-ink-muted">جمع خرج دوره</span>
          <Money minor={totalSpent} currency={currency} size="kpi" />
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-2">
          <span className="text-caption text-ink-muted">
            {square ? "همه تسویه‌اند" : "هنوز جابه‌جا نشده"}
          </span>
          {square ? (
            <span className="flex items-center gap-1 text-caption font-medium text-positive">
              <CheckCircle size={16} weight="fill" />
              حسابتان صاف است
            </span>
          ) : (
            <Money minor={outstanding} currency={currency} size="kpi" className="text-ink" />
          )}
        </div>
      </section>

      {/* ------------------------------------------------ who stands where -- */}
      <section className="overflow-hidden">
        <h2 className="border-b border-hairline px-4 py-2.5 text-label font-medium text-ink-muted">
          تراز افراد
        </h2>
        {ordered.map((balance) => {
          const member = members.get(balance.memberId);
          const state = standing(balance.net);
          return (
            <div
              key={balance.memberId}
              className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <MemberName
                  member={member}
                  className="truncate text-[15px] font-medium text-ink"
                />
                <span className="mt-0.5 text-caption text-ink-muted">
                  پرداخته <Money minor={balance.paid} currency={currency} omitSymbol /> ·
                  سهمش <Money minor={balance.share} currency={currency} omitSymbol />
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end">
                <Money
                  minor={balance.net}
                  currency={currency}
                  size="row"
                  signed
                  tone={state === "clear" ? "none" : "auto"}
                />
                <span className="mt-0.5 text-micro text-ink-muted">
                  {state === "owed" ? "طلبکار" : state === "owes" ? "بدهکار" : "صاف"}
                </span>
              </span>
            </div>
          );
        })}
      </section>

      {/* ------------------------------------------------------ settlement -- */}
      {plan.length > 0 && (
        <section className="overflow-hidden">
          <div className="border-b border-hairline px-4 py-2.5">
            <h2 className="text-label font-medium text-ink-muted">جدول تسویه</h2>
            <p className="mt-0.5 text-caption text-ink-muted">
              با {faNumber(plan.length)} پرداخت، حساب همه صاف می‌شود — نه اینکه هرکس با
              همه تسویه کند.
            </p>
          </div>

          {plan.map((transfer) => (
            <div
              key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
              className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] text-ink">
                <MemberName
                  member={members.get(transfer.fromMemberId)}
                  className="truncate"
                />
                <ArrowLeft size={14} className="shrink-0 text-ink-faint" aria-hidden />
                <MemberName
                  member={members.get(transfer.toMemberId)}
                  className="truncate"
                />
              </span>

              <Money minor={transfer.amount} currency={currency} size="row" />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSettle(transfer)}
              >
                <Handshake size={14} />
                ثبت
              </Button>
            </div>
          ))}
        </section>
      )}

      <TagBreakdown expenses={expenses} currency={currency} />
    </div>
  );
}

function TagBreakdown({
  expenses,
  currency,
}: {
  expenses: DongExpenseWithShares[];
  currency: CurrencyCode;
}) {
  const slices = byTag(expenses);
  if (slices.length < 2) return null;

  const top = slices.slice(0, 5);
  const restTotal = slices.slice(5).reduce((sum, slice) => sum + slice.amount, 0);

  const data = [
    ...top.map((slice, index) => ({
      key: slice.tag ?? "بی‌برچسب",
      name: slice.tag ?? "بی‌برچسب",
      amount: slice.amount,
      fill: RAMP[index],
    })),
    ...(restTotal > 0
      ? [{ key: "other", name: "سایر", amount: restTotal, fill: OTHER }]
      : []),
  ];

  const total = data.reduce((sum, slice) => sum + slice.amount, 0);

  return (
    <section className="rounded-well bg-paper p-4">
      <h2 className="mb-3 text-[15px] font-semibold text-ink">خرج به تفکیک برچسب</h2>

      <div className="flex items-center gap-4">
        <div className="size-[118px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                innerRadius={36}
                outerRadius={59}
                paddingAngle={1.6}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((slice) => (
                  <Cell key={slice.key} fill={slice.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {data.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: slice.fill }}
              />
              <span className="min-w-0 flex-1 truncate text-caption text-ink">
                {slice.name}
              </span>
              <span className="text-caption text-ink-muted">
                {faPercent(total > 0 ? Math.round((slice.amount / total) * 100) : 0)}
              </span>
              <Money minor={slice.amount} currency={currency} size="row" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
