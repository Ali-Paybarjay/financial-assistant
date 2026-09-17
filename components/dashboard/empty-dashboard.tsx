"use client";

import { Camera, Microphone, Plus, TextT } from "@phosphor-icons/react/dist/ssr";

/**
 * Not an empty chart and not grey skeletons: a new user's dashboard is an
 * invitation, because there is nothing to plot until they log something.
 */
export function EmptyDashboard({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-card border border-hairline bg-surface p-5">
        <h2 className="font-display text-display-l font-bold text-ink">
          اولین خریدت را ثبت کن
        </h2>
        <p className="mt-2 text-body text-ink-muted">
          تا یک هزینه ثبت نکنی، نموداری برای نشان‌دادن ندارم. یک قهوه هم کافی است تا
          شروع شود.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-control bg-lapis text-[15px] font-semibold text-white transition-colors hover:bg-lapis/90 active:bg-lapis-pressed"
        >
          <Plus size={20} weight="bold" />
          اولین هزینه‌ات را ثبت کن
        </button>
      </section>

      <section className="rounded-card border border-hairline bg-surface p-4">
        <h3 className="mb-3 text-caption font-semibold text-ink-muted">
          سه راه سریع‌تر از فرم
        </h3>
        <ul className="flex flex-col">
          {[
            { icon: TextT, title: "بنویس", example: "«۴۵ دلار خرید سوپرمارکت»" },
            { icon: Microphone, title: "بگو", example: "یک ویس کوتاه بفرست" },
            { icon: Camera, title: "عکس بگیر", example: "از فاکتور عکس بگیر" },
          ].map((item) => (
            <li
              key={item.title}
              className="flex h-14 items-center gap-3 border-b border-hairline last:border-b-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-lapis-tint text-lapis">
                <item.icon size={18} />
              </span>
              <span className="flex flex-col">
                <span className="text-[14px] font-medium text-ink">{item.title}</span>
                <span className="text-caption text-ink-muted">{item.example}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-ink-muted">
          این سه راه در نسخه‌های بعدی فعال می‌شوند.
        </p>
      </section>

      <p className="rounded-control border border-dashed border-hairline-strong bg-surface px-3 py-2.5 text-caption text-ink-muted">
        هزینه‌های ثابتی که در ثبت‌نام گفتی، اول ماه خودکار ثبت می‌شوند.
      </p>
    </div>
  );
}
