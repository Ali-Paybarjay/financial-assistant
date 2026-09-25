"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FormError } from "@/components/field";
import { faNumber } from "@/lib/format";
import { saveSettings } from "@/lib/admin/actions";
import type { AppSettings } from "@/lib/settings";

/**
 * The knobs, with what each one costs written next to it.
 *
 * Every number here has a reason that lives in a code comment somewhere, and a
 * settings page that shows the number without the reason invites changing it to
 * a round one. So the guest ceiling says why it is three, and the statement
 * ceiling says why it is five.
 *
 * `method="post"` on the form is not doing anything — the submit is a server
 * action — but a form with no method is a GET before hydration, and
 * `pnpm check:forms` exists because that once put a password in an address bar.
 * Naming it costs nothing and makes the intent unambiguous.
 */
export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [aiEnabled, setAiEnabled] = useState(initial.ai_enabled);
  const [limits, setLimits] = useState(initial.ai_daily_limits);
  const [guestCalls, setGuestCalls] = useState(String(initial.guest_daily_calls));
  const [retention, setRetention] = useState(String(initial.guest_retention_days));
  const [banner, setBanner] = useState(initial.maintenance_banner);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await saveSettings({
        ai_enabled: aiEnabled,
        ai_daily_limits: {
          parse_text: Number(limits.parse_text) || 0,
          parse_receipt: Number(limits.parse_receipt) || 0,
          parse_statement: Number(limits.parse_statement) || 0,
        },
        guest_daily_calls: Number(guestCalls) || 0,
        guest_retention_days: Number(retention) || 7,
        maintenance_banner: banner.trim(),
      });
      if ("error" in result) setError(result.error);
      else setSaved(true);
    });
  };

  const guestHourlyCeiling = (Number(guestCalls) || 0) * 10;

  return (
    <form
      method="post"
      action="/admin/settings"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <FormError>{error}</FormError>

      {saved && (
        <p className="rounded-control border border-positive/25 bg-positive-tint px-3 py-2 text-caption font-medium text-positive">
          ذخیره شد. از درخواست بعدی اعمال می‌شود.
        </p>
      )}

      <section className="rounded-card border border-hairline bg-surface p-4">
        <h2 className="mb-3 text-section font-semibold text-ink">هوش مصنوعی</h2>

        <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
          <div className="min-w-0">
            <p className="text-label font-semibold text-ink">
              {aiEnabled ? "پردازش هوشمند روشن است" : "پردازش هوشمند خاموش است"}
            </p>
            <p className="mt-0.5 text-caption text-ink-muted">
              خاموش‌کردنش هر سه مسیر مدل را می‌بندد و کاربر را به فرم می‌فرستد.
              درخواست‌های ردشده باز هم لاگ می‌شوند، تا تقاضا دیده شود.
            </p>
          </div>
          <Switch
            id="ai-enabled"
            aria-label="پردازش هوشمند"
            checked={aiEnabled}
            onCheckedChange={setAiEnabled}
          />
        </div>

        <div className="mt-3 grid gap-3 min-[560px]:grid-cols-3">
          <Field label="سقف روزانه — متن آزاد" htmlFor="limit-text">
            <Input
              id="limit-text"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              value={limits.parse_text}
              onChange={(event) =>
                setLimits({ ...limits, parse_text: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="سقف روزانه — عکس فاکتور" htmlFor="limit-receipt">
            <Input
              id="limit-receipt"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              value={limits.parse_receipt}
              onChange={(event) =>
                setLimits({ ...limits, parse_receipt: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="سقف روزانه — صورت‌حساب" htmlFor="limit-statement">
            <Input
              id="limit-statement"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              value={limits.parse_statement}
              onChange={(event) =>
                setLimits({ ...limits, parse_statement: Number(event.target.value) })
              }
            />
          </Field>
        </div>

        <p className="mt-2 text-micro text-ink-faint">
          سقف‌ها به تفکیک مسیرند چون یک صورت‌حساب چند برابرِ یک متن هزینه دارد —
          یک عدد مشترک یا تایپ روزمره را می‌بندد یا مسیر گران را رها می‌گذارد.
        </p>
      </section>

      <section className="rounded-card border border-hairline bg-surface p-4">
        <h2 className="mb-3 text-section font-semibold text-ink">مهمان‌ها</h2>

        <div className="grid gap-3 min-[560px]:grid-cols-2">
          <Field
            label="سقف روزانهٔ مهمان"
            htmlFor="guest-calls"
            hint="مشترک بین سه مسیر، نه به تفکیک."
          >
            <Input
              id="guest-calls"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={guestCalls}
              onChange={(event) => setGuestCalls(event.target.value)}
            />
          </Field>
          <Field
            label="روزهای نگه‌داری مهمان"
            htmlFor="retention"
            hint="از آخرین ورود، نه از ساخت حساب."
          >
            <Input
              id="retention"
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              value={retention}
              onChange={(event) => setRetention(event.target.value)}
            />
          </Field>
        </div>

        <p className="mt-2 text-micro text-ink-faint">
          سوپابیس ورود ناشناس را ۱۰ بار در ساعت اجازه می‌دهد، پس سقف واقعی
          سوءاستفاده حاصل‌ضرب آن دو است: الان تا {faNumber(guestHourlyCeiling)} پردازش
          در ساعت.
        </p>
      </section>

      <section className="rounded-card border border-hairline bg-surface p-4">
        <h2 className="mb-3 text-section font-semibold text-ink">بنر نگه‌داری</h2>

        <Field
          label="متن"
          htmlFor="banner"
          hint="خالی یعنی بنری نیست. بالای هر صفحهٔ اپ دیده می‌شود."
        >
          <Input
            id="banner"
            value={banner}
            maxLength={200}
            placeholder="امشب ۲۳:۰۰ تا ۲۳:۳۰ اپ در دسترس نیست."
            onChange={(event) => setBanner(event.target.value)}
          />
        </Field>

        {banner.trim() !== "" && (
          <div className="mt-3 rounded-well bg-paper p-2.5">
            <div className="flex items-center justify-center gap-2 rounded-md border border-guess-border bg-guess-tint px-3 py-2 text-caption text-guess-text">
              {banner.trim()}
            </div>
            <p className="mt-2 text-micro text-ink-faint">پیش‌نمایش</p>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "دارم ذخیره می‌کنم…" : "ذخیرهٔ تنظیمات"}
        </Button>
        <p className="text-caption text-ink-muted">
          صفحه‌های باز تا درخواست بعدی‌شان عدد قبلی را می‌بینند.
        </p>
      </div>
    </form>
  );
}
