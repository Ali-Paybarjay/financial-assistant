# دستیار مالی

وب‌اپلیکیشن مدیریت مالی شخصی برای فارسی‌زبانان مقیم خارج از ایران. کاربر هزینه‌هایش را با فرم، متن آزاد، صدا یا عکس فاکتور ثبت می‌کند و داشبورد ماهانه‌ی درآمد/هزینه/مانده را می‌بیند.

**جمله‌ی محک:** ثبت یک خرید در کمتر از ۱۰ ثانیه، فهمیدن مانده‌ی ماه در کمتر از ۵ ثانیه.

## استک

| لایه | انتخاب |
|---|---|
| Framework | Next.js 15 (App Router) · TypeScript strict |
| UI | Tailwind CSS v4 · shadcn/ui (RTL) · Recharts |
| Database | Supabase Postgres با RLS روی تمام جدول‌ها |
| Auth | Supabase Auth (ایمیل/رمز + Google) |
| Storage | باکت‌های خصوصی `receipts` و `voice-notes` |
| Validation | Zod روی هر ورودی کاربر و هر خروجی مدل |
| State | TanStack Query |
| AI | Anthropic Claude (استخراج از متن و فاکتور) · OpenAI Whisper (تبدیل صدا به متن) |
| Tests | Vitest (واحد) · Playwright (E2E) |

## راه‌اندازی

```bash
pnpm install
cp .env.example .env.local   # مقادیر را از پروژه‌ی Supabase پر کن
pnpm dev
```

Node 22+ و pnpm لازم است (`corepack enable pnpm`).

### دیتابیس

migrationها در `supabase/migrations/` به ترتیب اجرا می‌شوند و بعد `supabase/seed.sql` دسته‌های سیستمی را می‌سازد.

```bash
supabase link --project-ref <ref>
supabase db push
pnpm gen:types            # database.types.ts را از schema واقعی بازتولید می‌کند
```

## دستورها

| دستور | کار |
|---|---|
| `pnpm dev` | سرور توسعه |
| `pnpm verify` | typecheck + lint + check:rtl + test + build — دروازه‌ی پایان هر milestone |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm check:rtl` | جست‌وجوی کلاس‌های جهت‌دار فیزیکی (`ml-`, `right-`, …) که در RTL باگ می‌سازند |
| `pnpm test` | تست‌های واحد |
| `pnpm test:e2e` | تست E2E |
| `pnpm gen:types` | بازتولید تایپ‌های دیتابیس از Supabase |

## قواعد غیرقابل‌مذاکره

۱. **پول هرگز float نیست.** تمام مبالغ `bigint` بر حسب سنت. تنها مسیر مجاز تبدیل و جمع `lib/money.ts` است و تنها مسیر نمایش کامپوننت `<Money />`. هیچ‌جا `Intl.NumberFormat` دستی روی مبلغ صدا زده نمی‌شود.

۲. **هیچ کلید API ای به کلاینت نمی‌رود.** تمام فراخوانی‌های AI فقط در Route Handler سمت سرور. `lib/supabase/admin.ts` با `import "server-only"` محافظت می‌شود.

۳. **RLS روی تمام جدول‌ها.** هر policy با `(select auth.uid())` نوشته می‌شود، نه `auth.uid()` — فرم دوم به ازای هر ردیف اجرا می‌شود.

۴. **خروجی مدل هرگز مستقیم ذخیره نمی‌شود.** همیشه در «کارت تأیید» با فیلدهای قابل‌ویرایش نشان داده می‌شود و فقط با تأیید صریح کاربر ثبت می‌گردد.

۵. **RTL کامل.** فقط کلاس‌های منطقی (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`). `pnpm check:rtl` این را اجبار می‌کند.

۶. **زبان کد انگلیسی، زبان رابط کاربری فارسی.**

## ساختار

```
app/(auth)      ورود و ثبت‌نام
app/(app)       بخش محافظت‌شده: داشبورد، تراکنش‌ها، درآمد، اهداف، تنظیمات
app/onboarding  هفت گام، هر گام در دیتابیس ذخیره می‌شود
app/api         سه مسیر AI: parse/text · parse/receipt · transcribe
components      money.tsx و confidence-rule.tsx دو عنصر مشترک کل اپ‌اند
lib/money.ts    تنها مسیر مجاز کار با پول
lib/date.ts     مرز ماه بر اساس timezone کاربر، نه UTC
lib/supabase    سه کلاینت: مرورگر، سرور، سرویس‌رول
supabase/       migrationها و seed
```

## مستندات پروژه

- [`PLAN.md`](PLAN.md) — معماری، schema، ریسک‌ها
- [`DECISIONS.md`](DECISIONS.md) — هر تصمیم فنی با دلیل و جایگزین رد شده
- [`design_handoff_financial_assistant/`](design_handoff_financial_assistant/) — سیستم طراحی، توکن‌ها و موکاپ هشت صفحه
