# نصب بستهٔ طراحی — پرامپت برای Claude Code

این پیام را عیناً به Claude Code بده. فایل‌های آماده در پوشهٔ `handoff/` کنار همین سند هستند و مسیرشان همان مسیر مقصد در ریپو است.

---

## کاری که باید بکنی

بستهٔ `handoff/` را در ریپوی «دستیار مالی» بنشان. فایل‌های آماده را **جایگزین** کن (بازنویسی‌شان نکن، دوباره طراحی نکن) و فقط جاهایی که پایین گفته شده کد موجود را ویرایش کن. هدف: تم روشن/تیره با انتخاب کاربر، بورد پاکت‌ها به‌جای دونات، و نوار نوشتن به‌جای دکمهٔ شناور.

**قبل از شروع:** `README.md` ریپو را بخوان، بخش «قواعد غیرقابل‌مذاکره» (۱۱ بند). هر تضادی با آن‌ها، اشتباه است — حتی اگر این سند چیز دیگری گفته باشد.

---

## قدم ۰ — پاک‌سازی لازم (بدون آن، تم تیره می‌شکند)

`transactions-view.tsx`، `dong-view.tsx`، `accounts-view.tsx`، `amount-input.tsx`، `components/dong/report.tsx` و `components/onboarding/*` به کلاس‌های `lapis` / `lapis-tint` و هکس‌های درجا (`#23459b`, `#3e5cb2`, …) اشاره می‌کنند. این‌ها نه در `@theme` هستند و نه در تم تیره عوض می‌شوند.

- `lapis` → `action` · `lapis-tint` → `action-tint`
- هکس‌های درجای نمودار → `var(--chart-1..5)`

خروجی: `pnpm verify` سبز، صفر تغییر بصری دیگر.

## قدم ۱ — کپی فایل‌های بسته

این‌ها را عیناً کپی کن (مسیر = مسیر مقصد):

```
handoff/app/globals.css                          → app/globals.css            (جایگزین کامل)
handoff/lib/theme.ts                             → lib/theme.ts
handoff/lib/envelopes.ts                         → lib/envelopes.ts
handoff/lib/entry/quick-parse.ts                 → lib/entry/quick-parse.ts
handoff/components/theme/theme-provider.tsx      → components/theme/theme-provider.tsx
handoff/components/theme/theme-picker.tsx        → components/theme/theme-picker.tsx
handoff/components/dashboard/balance-card.tsx    → components/dashboard/balance-card.tsx
handoff/components/dashboard/envelope-card.tsx   → components/dashboard/envelope-card.tsx
handoff/components/entry/composer.tsx            → components/entry/composer.tsx
handoff/app/(app)/settings/appearance/page.tsx   → app/(app)/settings/appearance/page.tsx
handoff/supabase/migrations/00xx_envelopes_and_theme.sql → supabase/migrations/<شمارهٔ بعدی>_envelopes_and_theme.sql
```

محتوای `handoff/app/(app)/settings/actions.theme.ts` را به **انتهای** `app/(app)/settings/actions.ts` اضافه کن (فایل جدا نساز؛ `"use server"` تکراری را حذف کن).

بعد: `supabase db push` و `pnpm gen:types`.

## قدم ۲ — سه ویرایش کوچک که در بسته نیست

**`app/layout.tsx`**

```tsx
import { themeFromCookie } from "@/lib/theme";
import { ThemeProvider, ThemeScript } from "@/components/theme/theme-provider";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await themeFromCookie();
  return (
    <html lang="fa" dir="rtl" data-theme={theme} suppressHydrationWarning>
      <head>
        <ThemeScript initial={theme} />
      </head>
      <body>
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

**`app/manifest.ts`** — `theme_color` را به `#101120` برای تیره و `#edecf2` برای روشن ببر (یا مقدار ثابت `#edecf2` را نگه دار و `<meta name="theme-color" media="(prefers-color-scheme: dark)">` اضافه کن).

**`components/app-shell/shell.tsx`** — `<TabBar>` را با `<Composer>` عوض کن و `pb-20` را به `pb-[120px]` ببر (ارتفاع واقعی نوار). از ۹۶۰px به بالا نوار مخفی می‌شود و سایدبار سر جایش می‌ماند؛ در دسکتاپ نوار نوشتن را بالای بورد بگذار، نه پایین صفحه.

## قدم ۳ — داشبورد

`app/(app)/dashboard/dashboard-view.tsx`:

- بلوک مانده + `KpiCards` → `<BalanceCard>` (پیش‌بینی از `lib/cashflow.ts`؛ برای ماه‌های گذشته `forecast={null}`).
- `CategoryDonut` از داشبورد **حذف** و به `/transactions` منتقل شود — کامپوننتش دست‌نخورده.
- گرید `<EnvelopeCard>`: دو ستون در موبایل، سه ستون از ۹۶۰px؛ پاکت `unset` تمام‌عرض و آخرِ گرید (خودِ کامپوننت `col-span-2` می‌گذارد).
- داده از `lib/queries/envelopes.ts` (بساز): `envelope_status(monthStart, monthEnd)` را صدا می‌زند، پشت `server-only`.
- تپ روی پاکت → `/transactions?category=<id>` (لینکش داخل کامپوننت هست).

## قدم ۴ — تست

```bash
pnpm verify        # typecheck + lint + check:rtl + test + build
pnpm test:smoke
```

تست‌های واحد تازه برای `lib/envelopes.ts` (مرز ۸۵٪، `over`، `unset`، `suggestBudget` با داده‌ی پرت و با کمتر از ۲ ماه) و `lib/entry/quick-parse.ts` (بدون عدد، دو عدد، «قهوه ۵.۷۵»).

یک تست Playwright: هر صفحه در هر دو تم باز شود و `data-theme` بعد از انتخاب، هم در DOM و هم در کوکی بنشیند.

## آنچه انجام نده

- فایل‌های بسته را «بهتر» نکن؛ اگر جایی با ریپو نمی‌خواند، **همان‌جا** را گزارش کن.
- رنگ، فونت یا فاصلهٔ تازه معرفی نکن — همه‌چیز از `@theme` می‌آید و تم تیره فقط مقدارها را عوض می‌کند.
- بینش و دسته‌بندی را به مدل نسپار (قاعدهٔ ۵ پروژه).
- جمع پاکت را در ستون ذخیره نکن (قاعدهٔ ۶).
- تب‌بار را به پنج آیتم نرسان.
- ضبط صدا در اپ اضافه نکن (قاعدهٔ ۸) — دیکته با میکروفون کیبورد خود کاربر.

## در پایان

`PLAN.md` (schema و بخش پاکت‌ها/تم)، `DECISIONS.md` (پنج تصمیم: سقف با `effective_from`، بینش محاسبه‌ای، نوار نوشتن جای FAB، عدد بزرگ = باقی‌مانده، تم روی `data-theme` با کوکی) و `README.md` را به‌روز کن.
