/**
 * Shape-matched to the dashboard rather than a spinner, so the page does not
 * jump when the real numbers land.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-[560px] animate-pulse" aria-busy>
      <span className="sr-only">در حال بارگذاری</span>

      <div className="border-b border-hairline bg-surface px-4 pb-4 pt-3.5">
        <div className="flex items-center justify-between">
          <div className="size-9 rounded-full bg-paper" />
          <div className="h-9 w-32 rounded-full bg-paper" />
        </div>
        <div className="mt-4 h-3 w-24 rounded bg-paper" />
        <div className="mt-2 h-10 w-52 rounded bg-paper" />
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-[68px] rounded-card bg-surface" />
          ))}
        </div>
        <div className="h-[190px] rounded-card bg-surface" />
        <div className="h-[170px] rounded-card bg-surface" />
      </div>
    </div>
  );
}
