import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-start justify-center gap-4 p-6">
      <h1 className="font-display text-question font-bold text-ink">
        این صفحه وجود ندارد
      </h1>
      <p className="text-body text-ink-muted">
        شاید لینک قدیمی باشد. از صفحه‌ی اول شروع کن.
      </p>
      <Link
        href="/"
        className="flex h-[52px] items-center rounded-button px-5 text-[15px] font-semibold bg-linear-to-b from-action to-action-pressed text-white shadow-button transition-[transform,box-shadow] duration-150 hover:shadow-button-hover active:scale-[0.98]"
      >
        برو به صفحه‌ی اول
      </Link>
    </div>
  );
}
