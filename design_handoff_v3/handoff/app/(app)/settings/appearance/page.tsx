import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { ThemePicker } from "@/components/theme/theme-picker";
import { PageSheet } from "@/components/page";

export const metadata = { title: "ظاهر" };

/**
 * Settings → ظاهر.
 *
 * Its own page rather than a row inside Settings: the choice needs three
 * previews to be made without guessing, and three previews do not fit in a
 * settings row.
 */
export default function AppearancePage() {
  return (
    <PageSheet>
      <div className="flex flex-col gap-5 px-4 py-4">
        <header className="flex items-center gap-2.5">
          <Link
            href="/settings"
            aria-label="برگشت به تنظیمات"
            className="flex size-8 items-center justify-center rounded-full bg-paper text-ink-muted hover:text-action"
          >
            {/* Back points right in an RTL reading order. */}
            <CaretRight size={16} />
          </Link>
          <h1 className="text-title font-semibold text-ink">ظاهر</h1>
        </header>

        <p className="text-caption leading-5 text-ink-muted">
          تم را خودت انتخاب کن. «مثل سیستم» با تنظیم گوشی‌ات عوض می‌شود — شب تیره،
          روز روشن.
        </p>

        <ThemePicker />

        <p className="rounded-well bg-guess-tint px-3.5 py-3 text-micro leading-5 text-guess-text">
          رنگ‌های معنادار در هر دو تم یکی‌اند: مداد برنجی، مثبت سبز، منفی قرمز، و
          خط‌چین هنوز «هنوز نه» معنا می‌دهد.
        </p>

        <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
          <span className="min-w-0">
            <span className="block text-[14px] text-ink">کم‌کردن حرکت</span>
            <span className="mt-0.5 block text-micro text-ink-faint">
              از تنظیم گوشی خوانده می‌شود
            </span>
          </span>
          <span className="shrink-0 text-caption text-ink-muted">
            <span className="rounded-full bg-paper px-2.5 py-1">سیستم</span>
          </span>
        </div>
      </div>
    </PageSheet>
  );
}
