/**
 * Shape-matched to the capture screen, which is what «/» now is.
 *
 * It was the dashboard's skeleton, and the dashboard still has it — under
 * /dashboard, where it belongs. Leaving it here would have flashed a board
 * about to be replaced by a text field, which is a worse answer to «what is
 * happening» than a blank.
 */
export default function AppLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-[560px] flex-1 animate-pulse flex-col px-4 py-4 min-[960px]:my-auto min-[960px]:flex-none"
      aria-busy
    >
      <span className="sr-only">در حال بارگذاری</span>

      <div className="h-[66px] rounded-card bg-surface" />

      <div className="flex-1 min-[960px]:hidden" />

      <div className="h-7 w-40 rounded bg-surface min-[960px]:mt-8" />
      <div className="mt-2 h-3 w-56 rounded bg-surface" />
      <div className="mt-3 h-[100px] rounded-well bg-surface" />
      <div className="mt-3 h-[52px] rounded-control bg-surface" />

      <div className="mt-5 flex gap-2.5">
        <div className="h-[52px] flex-1 rounded-control bg-surface" />
        <div className="h-[52px] flex-1 rounded-control bg-surface" />
      </div>

      <div className="flex-[0.7] min-[960px]:hidden" />
    </div>
  );
}
