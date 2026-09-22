import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-start justify-center gap-4 p-6">
      <h1 className="font-display text-display-l font-bold text-ink">
        این صفحه وجود ندارد
      </h1>
      <p className="text-body text-ink-muted">
        شاید لینک قدیمی باشد. از صفحه‌ی اول شروع کن.
      </p>
      <Link
        href="/"
        className="flex h-[52px] items-center rounded-control bg-lapis px-5 text-[15px] font-semibold text-white hover:bg-lapis/90"
      >
        برو به صفحه‌ی اول
      </Link>
    </div>
  );
}
