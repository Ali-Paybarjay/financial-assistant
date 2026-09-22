"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Money } from "@/components/money";
import { faPercent } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";

/** Single hue, ordered by share. Separation is by lightness, so the order
 *  survives greyscale and colour-blindness. */
const RAMP = ["#23459b", "#3e5cb2", "#6280c8", "#93a8dc", "#c2cdeb"];
const OTHER = "#c9cdd4";

export type CategorySlice = { id: string | null; name: string; amount: number };

export function CategoryDonut({
  slices,
  currency,
}: {
  slices: CategorySlice[];
  currency: CurrencyCode;
}) {
  const top = slices.slice(0, 5);
  const rest = slices.slice(5);
  const restTotal = rest.reduce((total, slice) => total + slice.amount, 0);

  const data = [
    ...top.map((slice, index) => ({ ...slice, fill: RAMP[index] })),
    ...(restTotal > 0
      ? [{ id: "other", name: "سایر", amount: restTotal, fill: OTHER }]
      : []),
  ];

  const total = data.reduce((sum, slice) => sum + slice.amount, 0);
  const largest = data[0];
  const largestShare = total > 0 ? Math.round((largest.amount / total) * 100) : 0;

  return (
    <section className="rounded-card border border-hairline bg-surface p-4">
      <h2 className="mb-3 text-[15px] font-semibold text-ink">هزینه به تفکیک دسته</h2>

      <div className="flex items-center gap-4">
        <div className="relative size-[118px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                innerRadius={36}
                outerRadius={59}
                paddingAngle={1.6}
                stroke="#ffffff"
                strokeWidth={1.5}
                isAnimationActive={false}
              >
                {data.map((slice) => (
                  <Cell key={slice.id ?? slice.name} fill={slice.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-micro text-ink-muted">بیشترین</span>
            <span className="max-w-[60px] truncate text-caption font-semibold text-ink">
              {largest.name}
            </span>
            <span className="text-caption font-bold text-lapis">
              {faPercent(largestShare)}
            </span>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {data.map((slice) => (
            <li key={slice.id ?? slice.name} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-[9px] shrink-0 rounded-[2px]"
                style={{ background: slice.fill }}
              />
              <span className="min-w-0 flex-1 truncate text-caption text-ink">
                {slice.name}
              </span>
              <Money minor={slice.amount} currency={currency} className="text-caption font-medium" />
            </li>
          ))}
        </ul>
      </div>

      {/* The donut itself is unreadable to a screen reader, so the same numbers
          are available as text. */}
      <table className="sr-only">
        <caption>هزینه به تفکیک دسته</caption>
        <tbody>
          {data.map((slice) => (
            <tr key={slice.id ?? slice.name}>
              <th scope="row">{slice.name}</th>
              <td>
                {faPercent(total > 0 ? Math.round((slice.amount / total) * 100) : 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
