# دستیار مالی

وب‌اپلیکیشن مدیریت مالی شخصی برای فارسی‌زبانان. کاربر هزینه‌هایش را با فرم، متن آزاد یا عکس فاکتور ثبت می‌کند، می‌تواند پرینت حساب بانکی یک تا سه ماهه را آپلود کند تا فقط ردیف‌های ثبت‌نشده اضافه شوند، و داشبورد ماهانه‌ی درآمد/هزینه/مانده را می‌بیند.

**جمله‌ی محک:** ثبت یک خرید در کمتر از ۱۰ ثانیه، فهمیدن مانده‌ی ماه در کمتر از ۵ ثانیه.

## استک

| لایه | انتخاب |
|---|---|
| Framework | Next.js 15 (App Router) · TypeScript strict |
| UI | Tailwind CSS v4 · shadcn/ui (RTL) · Recharts |
| Database | Supabase Postgres با RLS روی تمام جدول‌ها |
| Auth | Supabase Auth (ایمیل/رمز + Google) |
| Storage | باکت‌های خصوصی `receipts` و `statements` |
| Validation | Zod روی هر ورودی کاربر و هر خروجی مدل |
| State | TanStack Query |
| AI | Claude Sonnet 5 از طریق OpenRouter — استخراج از متن آزاد، از عکس فاکتور، و از صورت‌حساب بانکی |
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

## Deploy

روی Vercel، و ریپازیتوری GitHub وصل است — هر push روی `main` خودکار deploy می‌شود.

```bash
vercel          # preview
vercel --prod   # production
vercel logs <url>
```

متغیرهای محیطی در خود Vercel ست می‌شوند (`vercel env ls`)، نه در فایل. `NEXT_PUBLIC_APP_URL` عمداً ست نشده: اگر نباشد، آدرس از `VERCEL_PROJECT_PRODUCTION_URL` خوانده می‌شود تا با تغییر دامنه از کار نیفتد.

> **یک قدم دستی بعد از اولین deploy:** در Supabase → Authentication → URL Configuration، آدرس production را به‌عنوان **Site URL** و `https://<domain>/callback` را به **Redirect URLs** اضافه کن. بدون این، ثبت‌نام کار می‌کند ولی لینک تأیید ایمیل به localhost برمی‌گردد.

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

۴. **خروجی مدل هرگز مستقیم ذخیره نمی‌شود.** همیشه در «کارت تأیید» با فیلدهای قابل‌ویرایش نشان داده می‌شود و فقط با تأیید صریح کاربر ثبت می‌گردد. فیلدی که مدل حدس زده با خط‌چین برنجی و واژه‌ی «حدس زدم» مشخص می‌ماند — تا بعد از ذخیره هم، در لیست و در جمع ماه.

۸. **مدل می‌خواند، تصمیم نمی‌گیرد.** هرچه جواب درست دارد — تبدیل تقویم، تبدیل ریال به تومان، و تشخیص اینکه ردیفی از صورت‌حساب قبلاً ثبت شده یا نه — در کد حساب می‌شود، نه در پرامپت. `lib/import/reconcile.ts` تابعی خالص و تست‌شده است تا خواندنِ دوباره‌ی یک فایل همان جواب اول را بدهد.

۷. **صدا در اپ ضبط نمی‌شود.** کاربر با میکروفون کیبورد خودش داخل فیلد متن دیکته می‌کند. این یعنی بدون هزینه، بدون سرویس رونویسی، و بدون درگیرشدن با تفاوت فرمت `MediaRecorder` بین iOS و اندروید.

۵. **RTL کامل.** فقط کلاس‌های منطقی (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`). `pnpm check:rtl` این را اجبار می‌کند.

۶. **زبان کد انگلیسی، زبان رابط کاربری فارسی.**

## ساختار

```
app/(auth)      ورود و ثبت‌نام
app/(app)       بخش محافظت‌شده: داشبورد، تراکنش‌ها، درآمد، اهداف، صورت‌حساب، تنظیمات
app/onboarding  هفت گام، هر گام در دیتابیس ذخیره می‌شود
app/api         سه مسیر AI: parse/text · parse/receipt · import/statement
components      money.tsx و confidence-rule.tsx دو عنصر مشترک کل اپ‌اند
lib/money.ts    تنها مسیر مجاز کار با پول
lib/date.ts     مرز ماه بر اساس timezone کاربر، نه UTC
lib/jalali.ts   تبدیل تاریخ شمسی به میلادی، برای صورت‌حساب بانک ایرانی
lib/import      تطبیق ردیف‌های صورت‌حساب با دفتر — منطق خالص و تست‌شده
lib/supabase    سه کلاینت: مرورگر، سرور، سرویس‌رول
supabase/       migrationها و seed
```

## مستندات پروژه

- [`PLAN.md`](PLAN.md) — معماری، schema، ریسک‌ها
- [`DECISIONS.md`](DECISIONS.md) — هر تصمیم فنی با دلیل و جایگزین رد شده
- [`design_handoff_financial_assistant/`](design_handoff_financial_assistant/) — سیستم طراحی، توکن‌ها و موکاپ هشت صفحه
