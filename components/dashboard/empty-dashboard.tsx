"use client";

import { Camera, Microphone, Plus, TextT } from "@phosphor-icons/react/dist/ssr";
import { Rows, Section, Well } from "@/components/page";

/**
 * Not an empty chart and not grey skeletons: a new user's dashboard is an
 * invitation, because there is nothing to plot until they log something.
 *
 * This is the other place Estedad is allowed — the line where the app speaks
 * rather than reports. On a screen with no figure on it, the question is the
 * only thing worth setting large.
 */
export function EmptyDashboard({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="font-display text-question font-bold text-pretty text-ink">
          اولین خریدت را ثبت کن
        </h2>
        <p className="mt-2 max-w-[52ch] text-body text-ink-muted">
          تا یک هزینه ثبت نکنی، نموداری برای نشان‌دادن ندارم. یک قهوه هم کافی است تا
          شروع شود.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-4 flex h-[52px] w-full max-w-[340px] items-center justify-center gap-2 rounded-control bg-action text-[15px] font-semibold text-white transition-colors hover:bg-action/90 active:bg-action-pressed"
        >
          <Plus size={20} weight="bold" />
          اولین هزینه‌ات را ثبت کن
        </button>
      </div>

      <Section title="سه راه سریع‌تر از فرم" headingLevel="h3">
        {/* Muted glyphs, not tinted chips in the action colour: none of these
            is something the reader can press yet, and the line below says so.
            Painting them the colour that means «press this» would be the
            design contradicting the copy. */}
        <Rows>
          {[
            { icon: TextT, title: "بنویس", example: "«۴۵ دلار خرید سوپرمارکت»" },
            { icon: Microphone, title: "بگو", example: "یک ویس کوتاه بفرست" },
            { icon: Camera, title: "عکس بگیر", example: "از فاکتور عکس بگیر" },
          ].map((item) => (
            <div key={item.title} className="flex h-14 items-center gap-3">
              <item.icon size={20} className="shrink-0 text-ink-faint" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[14px] font-medium text-ink">{item.title}</span>
                <span className="truncate text-caption text-ink-muted">
                  {item.example}
                </span>
              </span>
            </div>
          ))}
        </Rows>
        <p className="mt-3 text-caption text-ink-muted">
          این سه راه در نسخه‌های بعدی فعال می‌شوند.
        </p>
      </Section>

      <Well>
        <p className="text-caption text-ink-muted">
          هزینه‌های ثابتی که در ثبت‌نام گفتی، اول ماه خودکار ثبت می‌شوند.
        </p>
      </Well>
    </div>
  );
}
