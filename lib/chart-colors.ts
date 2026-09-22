/**
 * The chart ramp, named once.
 *
 * A single hue ordered by share, so slices separate by lightness and the
 * order survives greyscale and colour blindness. The values themselves are
 * `--chart-1..5` in `app/globals.css`; this module only points at them.
 *
 * It exists because the same five hexes were written out by hand in three
 * files — the dashboard's donut, the month bars, and the trip report — and a
 * palette that lives in three places is a palette that will disagree with
 * itself the first time one of them is touched. Recharts hands `fill` and
 * `stroke` straight to SVG, which resolves a CSS variable like any other
 * paint value, so nothing is lost by going through the token.
 */
export const CHART_RAMP = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** The «سایر» bucket. Grey, so it never reads as a real category. */
export const CHART_OTHER = "var(--chart-other)";
