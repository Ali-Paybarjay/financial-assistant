/**
 * Skeleton tiles, in the shape the overview actually lands in — so the page
 * does not jump when the reports come back.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 pb-12 min-[960px]:p-7">
      <span className="sr-only">در حال بارگذاری</span>
      <div aria-hidden className="flex flex-col gap-4">
        <div className="h-7 w-40 animate-pulse rounded-control bg-hairline" />
        <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[960px]:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="h-[74px] animate-pulse rounded-card border border-hairline bg-surface"
            />
          ))}
        </div>
        <div className="h-[220px] animate-pulse rounded-card border border-hairline bg-surface" />
      </div>
    </div>
  );
}
