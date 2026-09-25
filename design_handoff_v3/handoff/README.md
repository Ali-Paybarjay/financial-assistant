# بستهٔ تحویل فرانت‌اند — دستیار مالی

این پوشه فایل‌های آمادهٔ جایگزینی در ریپوی `financial-assistant` است. مسیر هر فایل در این بسته **دقیقاً همان مسیری است که در ریپو باید بنشیند**.

> شروع برای Claude Code: فایل `CLAUDE-CODE-INSTALL.md` کنار همین پوشه.

## فهرست فایل‌ها

| فایل در این بسته | مقصد در ریپو | کار |
|---|---|---|
| `app/globals.css` | `app/globals.css` | **جایگزین کامل.** توکن‌های روشن + تیره روی `<html data-theme>`، دستور خط ممتد/خط‌چین، باند فرود، نوار راه‌راهِ تأییدنشده |
| `lib/theme.ts` | `lib/theme.ts` | نوع `Theme`، نام کوکی، خواندن تم در سرور |
| `components/theme/theme-provider.tsx` | همان | `ThemeProvider` + `useTheme` + `ThemeScript` (جلوگیری از پرش سفید) |
| `components/theme/theme-picker.tsx` | همان | سه کارت انتخاب تم با پیش‌نمایش |
| `app/(app)/settings/appearance/page.tsx` | همان | صفحهٔ «ظاهر» |
| `app/(app)/settings/actions.theme.ts` | **محتوایش** به انتهای `app/(app)/settings/actions.ts` | اکشن `saveTheme` |
| `components/dashboard/balance-card.tsx` | همان | کارت مانده + پیش‌بینی + باند فرود، روی زمینهٔ `action-tint` |
| `components/dashboard/envelope-card.tsx` | همان | کارت پاکت با پنج حالت |
| `lib/envelopes.ts` | همان | منطق خالص سقف‌ها (تست‌شدنی) |
| `lib/entry/quick-parse.ts` | همان | دروازهٔ پیش از مدل |
| `components/entry/composer.tsx` | همان | نوار نوشتن + تب‌بار |
| `supabase/migrations/00xx_envelopes_and_theme.sql` | `supabase/migrations/` با شمارهٔ بعدی | جدول سقف‌ها، تابع `envelope_status()`، جدول dismiss، ستون `profiles.theme` |

## چیزهایی که در این بسته **نیست** و باید خودت وصل کنی

۱. **`app/layout.tsx`** — سه خط اضافه می‌شود (در `CLAUDE-CODE-INSTALL.md` آمده): خواندن تم، گذاشتن `data-theme` روی `<html>`، و `<ThemeScript>` در `<head>`.
۲. **`components/app-shell/shell.tsx`** — `pb-20` به `pb-[120px]` تغییر می‌کند و `<TabBar>` جای خود را به `<Composer>` می‌دهد.
۳. **`app/(app)/dashboard/dashboard-view.tsx`** — `CategoryDonut` برداشته و به `/transactions` منتقل می‌شود؛ `KpiCards` و بلوک مانده جای خود را به `<BalanceCard>` و گرید `<EnvelopeCard>` می‌دهند.
۴. **`app/(app)/stream/`** — تب «جریان»، بر پایهٔ `lib/insights.ts` که مشخصاتش در `spec-envelopes-and-insights.md` است.
۵. **کوئری‌ها** — `lib/queries/envelopes.ts` پشت `server-only`، که `envelope_status()` را صدا می‌زند.

## قاعده‌هایی که این فایل‌ها رعایت کرده‌اند

- پول همه‌جا `bigint` سنت؛ نمایش فقط با `<Money />`.
- فقط کلاس‌های منطقی جهت (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`) — `pnpm check:rtl` سبز می‌ماند.
- هیچ رنگ، فونت یا فاصلهٔ درجا: هرچه هست از `@theme` می‌آید.
- هیچ فراخوانی تازهٔ مدل؛ `quick-parse` تعداد فراخوانی‌ها را **کم** می‌کند.
- هیچ جمعی در ستون ذخیره نمی‌شود: وضعیت پاکت از تابع SQL می‌آید.
