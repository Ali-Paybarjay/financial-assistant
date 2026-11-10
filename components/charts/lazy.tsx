"use client";

import dynamic from "next/dynamic";

/**
 * The charting library, loaded when a chart is actually drawn.
 *
 * Recharts is the biggest single thing in this app's client bundle, and it was in
 * the first load of the dashboard, the ledger and every trip page — three of the
 * four heaviest routes in the build output. Not one of those charts is why the
 * page was opened: the six-month columns are inside a collapsed section, the
 * category donut sits under the rows, and the trip's tag donut under its
 * settlement plan.
 *
 * `ssr: false`, deliberately. These charts are SVG measured against a container
 * whose width nobody knows on the server, so `ResponsiveContainer` renders empty
 * on the first pass either way — server-rendering it buys a blank box a few
 * milliseconds earlier and costs the library in the initial payload.
 *
 * The placeholder holds the space the chart will take, so nothing below it moves
 * when the module lands. It has no text: this is decoration arriving, not content
 * loading, and «در حال بارگذاری نمودار» would be a sentence about the app rather
 * than about the user's money. Every number the chart shows is beside it as text
 * already.
 */
const placeholder = () => (
  <div aria-hidden className="size-full rounded-control bg-paper" />
);

export const DonutRing = dynamic(
  () => import("./donut-ring").then((module) => module.DonutRing),
  { ssr: false, loading: placeholder },
);

export const MonthColumns = dynamic(
  () => import("./month-columns").then((module) => module.MonthColumns),
  { ssr: false, loading: placeholder },
);

export type { RingSlice } from "./donut-ring";
export type { MonthColumn } from "./month-columns";
