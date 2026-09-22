# PLAN.md — دستیار مالی (MVP)

> وضعیت: پیش‌نویس برای تأیید. طبق بند ۱۱ سند اصلی، هیچ کدی نوشته نشده.
> ورودی‌ها: `financial-assistant-claude-code-prompt (1).md` (سند محصول) + `design_handoff_financial_assistant/` (خروجی فاز طراحی).

---

## ۰. خلاصه‌ی اجرایی

معماری: یک اپ Next.js 15 (App Router) روی Supabase، با سه لایه‌ی مرزی که هیچ‌کدام دور زده نمی‌شوند:

1. **مرز پول** — `lib/money.ts` تنها مسیر تبدیل/جمع/فرمت، و `<Money />` تنها مسیر نمایش.
2. **مرز اعتبارسنجی** — Zod روی هر ورودی کاربر و هر خروجی مدل.
3. **مرز امنیت** — RLS روی همه‌ی جدول‌ها، و هیچ کلید AI ای بیرون از سرور.

سه شکاف در مدل داده‌ی سند اصلی پیدا شد که در بخش ۳ اصلاح شده‌اند (ستون `recurring_expense_id`، جدول baseline هزینه‌های متغیر، و ستون درصد پس‌انداز گام ۷). بدون این سه، بندهای ۷.۳، ۷.۲/گام ۴ و ۷.۲/گام ۷ قابل پیاده‌سازی نیستند.

---

## ۱. تصمیم‌های معماری

### ۱.۱ لایه‌ی داده و کش

| موضوع | تصمیم | دلیل | جایگزین رد شده |
|---|---|---|---|
| مسیر خواندن داده | Server Component داده را prefetch می‌کند و با `HydrationBoundary` به TanStack Query می‌دهد؛ کامپوننت کلاینت فقط `useQuery` می‌زند | یک منبع حقیقت برای داده‌ی سرور. اگر بخشی از صفحه RSC مستقیم بخواند و بخشی Query، بعد از هر mutation نیمی از صفحه تازه می‌شود و نیمی کهنه می‌ماند | RSC خالص (نیازمند `revalidatePath` برای هر تغییر، و undo پنج‌ثانیه‌ای و فیلترهای لیست تراکنش را سخت می‌کند) |
| نوشتن داده | CRUD با **Server Action**؛ فقط سه مسیر AI با **Route Handler** | Server Action برای فرم‌ها کوتاه‌تر و type-safe است؛ اما مسیر AI به کنترل صریح status code، تایم‌اوت و `maxDuration` نیاز دارد | همه‌چیز Route Handler (کد boilerplate بیشتر برای CRUD ساده) |
| کلاینت Supabase | سه کارخانه‌ی جدا در `lib/supabase/`: `client.ts` (مرورگر) · `server.ts` (RSC/Action/Route، با cookie) · `admin.ts` (service role، فقط سرور) | `admin.ts` با یک `import "server-only"` در بالای فایل محافظت می‌شود تا هرگز وارد باندل کلاینت نشود | یک کلاینت واحد با سوییچ (ریسک نشت service role) |
| invalidation | بعد از هر mutation تراکنش: `['dashboard', month]` و `['transactions', filters]` باطل شوند | اگر مانده‌ی کهنه بماند، کاربر فکر می‌کند ثبت نشده و دوباره ثبت می‌کند — تراکنش تکراری | اتکا به refetchOnWindowFocus |

### ۱.۲ زمان و «ماه جاری»

مرز ماه **در لایه‌ی اپ** از روی `profiles.timezone` حساب می‌شود و به‌صورت یک بازه‌ی صریح (`from`, `to` به شکل `YYYY-MM-DD`) به کوئری داده می‌شود. هیچ‌جای SQL به `now()` برای تعیین ماه تکیه نمی‌کند.

دلیل: `occurred_on` از نوع `date` است (نه timestamptz) — چون «۱۲ آگوست» برای کاربر یک روز تقویمی است نه یک لحظه. پس تبدیل timezone فقط یک‌بار و در مرز ورودی/خروجی رخ می‌دهد. تابع مرجع: `lib/date.ts → monthRange(tz, anchor)`.

### ۱.۳ لایه‌ی AI

```
app/api/parse/text/route.ts     ← متن آزاد
app/api/parse/receipt/route.ts  ← عکس فاکتور (فقط media_asset_id می‌گیرد، نه فایل)
lib/ai/openrouter.ts            ← تنها جایی که OPENROUTER_API_KEY خوانده می‌شود
lib/ai/parse.ts                 ← خط لوله‌ی مشترک: سقف، فراخوانی، Zod، retry، لاگ
lib/ai/prompts.ts               ← پرامپت‌ها، با لیست دسته‌ها و ارز و تاریخ امروزِ کاربر
lib/ai/schemas.ts               ← ParsedTransaction / ParseResult (Zod + JSON Schema)
lib/ai/usage.ts                 ← سقف ۵۰ فراخوانی در روزِ کاربر + لاگ مصرف
```

تصمیم‌های کلیدی:

- **مدل از طریق OpenRouter، نه فراخوانی مستقیم Anthropic.** مدل `anthropic/claude-sonnet-5` با API سازگار با OpenAI صدا زده می‌شود. قیمت توکنش روی OpenRouter دقیقاً برابر نرخ مستقیم Anthropic است ($۲/$۱۰ به ازای هر میلیون)، هم ورودی تصویری را می‌پذیرد و هم structured outputs دارد.
- **ضبط صدا در اپ ساخته نمی‌شود.** کاربر با میکروفون کیبورد خودش داخل همان فیلد متن دیکته می‌کند. این کار ریسک `MediaRecorder` روی iOS Safari و تکه‌تکه‌بودن فرمت‌ها (`webm` روی کروم، `mp4` روی iOS) را کامل حذف می‌کند، هیچ هزینه‌ای ندارد، و یک رفت‌وبرگشت شبکه کمتر است. ضمناً اصل طراحی «متن پیش از پارس نشان داده شود» بهتر رعایت می‌شود، چون متن از اول داخل textarea و قابل ویرایش است.
- **Structured Outputs به‌جای «فقط JSON بنویس».** به‌جای اینکه در پرامپت التماس کنیم backtick نگذارد، `response_format: { type: "json_schema" }` می‌فرستیم و Zod را به‌عنوان لایه‌ی دوم نگه می‌داریم. روی OpenRouter تضمین schema به provider بستگی دارد، پس `require_parameters: true` در تنظیمات مسیردهی لازم است تا درخواست فقط به endpointهای پشتیبانی‌کننده برود — و retry تک‌باره‌ی سند اصلی همچنان لازم می‌ماند.
- **effort پایین.** این یک کار استخراج کوتاه و حساس به تأخیر است، نه استدلال سنگین. با سقف ۳۰ ثانیه‌ی سند، `effort: "low"` انتخاب پیش‌فرض است و اگر کیفیت افت کرد به `medium` می‌رود.
- **عکس هرگز از Route Handler عبور نمی‌کند.** کلاینت مستقیم به باکت خصوصی آپلود می‌کند (signed upload URL) و فقط `media_asset_id` را به سرور می‌دهد؛ سرور خودش فایل را از Storage می‌خواند. دلیل در بخش ۶ (ریسک R3).
- **سقف ۵۰ فراخوانی در روز** با شمارش روی `ai_usage_logs` در بازه‌ی روزِ کاربر (نه UTC)، پیش از فراخوانی مدل. رقابت همزمانی در MVP پذیرفته می‌شود (حداکثر چند فراخوانی اضافه، نه نشت هزینه).
- **تایم‌اوت ۳۰ ثانیه** روی کلاینت SDK + `export const maxDuration = 60` روی هر سه route.

### ۱.۴ تراکنش‌های تکرارشونده (idempotent)

به‌جای cron، یک **تابع Postgres** به نام `public.post_recurring_for_month(p_month date)` که:

- با `security invoker` اجرا می‌شود (پس RLS کاربر برقرار است و فقط ردیف‌های خودش را می‌بیند)،
- برای هر `recurring_expenses` فعال با `auto_post = true` یک تراکنش با `source = 'recurring'` می‌سازد،
- و روی `on conflict do nothing` علیه ایندکس یکتای `(recurring_expense_id, posted_month)` می‌نشیند.

از داشبورد در اولین بارگذاری هر ماه یک‌بار RPC می‌شود. اجرای دوباره — حتی همزمان — هیچ ردیف تکراری نمی‌سازد، چون تضمین در **دیتابیس** است نه در کد اپ. مهاجرت بعدی به pg_cron بدون تغییر منطق ممکن است.

جایگزین رد شده: چک «آیا قبلاً ساخته شده؟» در کد اپ — با دو تب باز همزمان می‌شکند.

### ۱.۵ حذف نرم

`deleted_at` روی `transactions`. برای اینکه فراموش‌کردن فیلتر ممکن نباشد، همه‌ی خواندن‌ها از `lib/queries/transactions.ts` عبور می‌کنند که فیلتر را خودش می‌گذارد؛ هیچ کامپوننتی مستقیم `from('transactions')` صدا نمی‌زند. (پنجره‌ی undo پنج‌ثانیه‌ای سمت کلاینت است؛ ردیف تا تأیید نهایی در دیتابیس فقط `deleted_at` می‌خورد.)

### ۱.۶ ساختار مسیرها

`/(auth)` عمومی · `/(app)` محافظت‌شده · `/onboarding/[step]` محافظت‌شده ولی خارج از shell اصلی (طراحی می‌گوید onboarding تمام‌صفحه است و نوار پایین ندارد).

middleware دو کار می‌کند: بی‌session → `/login`؛ session بدون `onboarding_completed_at` که به `/(app)` می‌رود → `/onboarding/[next_step]`.

---

## ۲. ساختار پوشه‌ها

```
app/
  layout.tsx                      # <html lang="fa" dir="rtl">، فونت‌ها، Providerها
  globals.css                     # @theme توکن‌ها (بخش ۴)
  (auth)/
    login/page.tsx  signup/page.tsx
    forgot-password/page.tsx  reset-password/page.tsx
    callback/route.ts             # OAuth + تأیید ایمیل
  onboarding/
    layout.tsx                    # progress bar هفت‌تکه
    [step]/page.tsx               # گام ۱..۷
    summary/page.tsx              # «این تصویر مالی توست»
  (app)/
    layout.tsx                    # نوار پایین (موبایل) / سایدبار راست (≥960px) + FAB
    dashboard/page.tsx
    transactions/page.tsx
    income/page.tsx               # دو تب: درآمد | هزینه‌ی ثابت
    goals/page.tsx
    settings/page.tsx
  api/
    parse/text/route.ts
    parse/receipt/route.ts
    transcribe/route.ts
components/
  ui/                             # shadcn (با dir صریح روی Radix)
  money.tsx                       # <Money /> — تنها مسیر نمایش پول
  confidence-rule.tsx             # عنصر امضا (بخش ۴.۴)
  entry/                          # مودال چهارتبی: form | text | voice | receipt
    entry-sheet.tsx  confirm-card.tsx  voice-recorder.tsx  receipt-uploader.tsx
  dashboard/                      # kpi-cards, donut, six-month-bars, goals, recent
  transactions/                   # list, filters, undo-row
lib/
  money.ts                        # تبدیل/جمع/فرمت — تنها مسیر مجاز
  date.ts                         # monthRange(tz), formatDateFa
  supabase/{client,server,admin,middleware}.ts
  ai/{anthropic,stt,prompts,schemas,usage}.ts
  queries/                        # کلیدهای TanStack Query + fetcherها
  validation/                     # Zod schemaهای فرم و پروفایل
supabase/
  migrations/                     # 0001_init.sql ... (بخش ۳)
  seed.sql                        # ۱۵ دسته‌ی سیستمی
tests/
  unit/money.spec.ts  unit/date.spec.ts  unit/parse-schema.spec.ts
  e2e/happy-path.spec.ts
public/fonts/                     # ۶ فایل woff2 از handoff
middleware.ts
.env.example
```

---

## ۳. Schema نهایی SQL

قواعد اعمال‌شده در کل schema:

- هر جدول: `id uuid default gen_random_uuid()`، `created_at`، `updated_at` با trigger.
- **همه‌ی مبالغ `bigint` و بر حسب سنت**، با `check (amount >= 0)`. جهت پول از `type` می‌آید نه از علامت عدد.
- enumها به‌صورت `text + check` هستند نه `pg enum` — چون افزودن یک مقدار به enum در Postgres یک migration قفل‌کننده می‌خواهد، ولی تغییر check ساده است.
- RLS: **`(select auth.uid())` نه `auth.uid()`**. بدون `select`، تابع به‌ازای هر ردیف اجرا می‌شود؛ با آن یک‌بار اجرا و کش می‌شود (روی جدول‌های بزرگ چند برابر سریع‌تر).
- policyها به تفکیک عملیات و با `to authenticated` نوشته می‌شوند، نه `for all` — تا `with check` روی insert/update واقعاً معنا داشته باشد.
- روی هر ستونی که در policy استفاده می‌شود و هر FK، ایندکس هست.

### ۳.۱ کمکی‌ها

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
```

### ۳.۲ profiles

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null default 'UTC',
  base_currency text not null default 'CAD'
    check (base_currency in ('CAD','USD','EUR','GBP','AUD')),
  birth_year int check (birth_year between 1930 and 2100),
  employment_status text check (employment_status in
    ('employed','self_employed','student','retired','unemployed','other')),
  risk_score int check (risk_score between 1 and 10),
  risk_label text check (risk_label in ('conservative','balanced','growth')),
  monthly_income_estimate bigint check (monthly_income_estimate >= 0),
  has_debt boolean,
  debt_amount bigint check (debt_amount >= 0),
  emergency_fund_months numeric(4,1) check (emergency_fund_months >= 0),
  savings_rate_estimate int check (savings_rate_estimate between 0 and 100), -- ← افزوده
  onboarding_step int not null default 0 check (onboarding_step between 0 and 7),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
```

> **چرا `birth_year` تا ۲۱۰۰ است و نه «سال جاری منهای ۱۳»:** CHECK در Postgres باید immutable باشد و `extract(year from now())` نیست. قاعده‌ی «حداقل ۱۳ سال» در Zod اعمال می‌شود؛ CHECK فقط نگهبان بیرونی است.

یک trigger روی `auth.users` بعد از insert یک `profiles` خالی می‌سازد (`security definer`, `set search_path = ''`) تا هیچ‌وقت کاربرِ بدون پروفایل وجود نداشته باشد.

### ۳.۳ categories

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = سیستمی
  name_fa text not null,
  slug text not null,
  kind text not null check (kind in ('expense','income')),
  icon text, color text,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_user_slug_key
  on public.categories (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create index categories_user_id_idx on public.categories (user_id);

alter table public.categories enable row level security;
-- خواندن: دسته‌های سیستمی + دسته‌های خودش
create policy categories_select on public.categories for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
-- نوشتن: فقط دسته‌های خودش. ردیف سیستمی از کلاینت قابل ساخت/تغییر نیست.
create policy categories_insert on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()) and is_system = false);
create policy categories_update on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy categories_delete on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));
```

> این تنها جدولی است که policy خواندنش با بقیه فرق دارد. سند اصلی می‌گوید «RLS با شرط `auth.uid() = user_id` روی همه‌ی جدول‌ها» — اگر لفظی اجرا شود، هیچ‌کس دسته‌های سیستمی را نمی‌بیند و ثبت تراکنش از کار می‌افتد.

### ۳.۴ income_sources / recurring_expenses

```sql
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in
    ('salary','freelance','business','investment','rental','pension','other')),
  amount bigint not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  frequency text not null check (frequency in
    ('monthly','biweekly','weekly','yearly','one_time')),
  is_active boolean not null default true,
  started_on date, ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);
create index income_sources_user_active_idx
  on public.income_sources (user_id) where is_active;

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category_id uuid references public.categories(id) on delete set null,
  amount bigint not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  frequency text not null check (frequency in ('monthly','quarterly','yearly')),
  due_day int not null check (due_day between 1 and 31),
  is_active boolean not null default true,
  auto_post boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_expenses_user_idx on public.recurring_expenses (user_id);
create index recurring_expenses_category_idx on public.recurring_expenses (category_id);
create index recurring_expenses_autopost_idx
  on public.recurring_expenses (user_id) where is_active and auto_post;
```

policyها برای هر دو، الگوی چهارگانه‌ی استاندارد با `user_id = (select auth.uid())`.

### ۳.۵ transactions

```sql
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income')),
  amount bigint not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  category_id uuid references public.categories(id) on delete set null,
  merchant text, note text,
  occurred_on date not null,
  source text not null check (source in ('form','text','voice','receipt','recurring')),
  media_asset_id uuid references public.media_assets(id) on delete set null,
  recurring_expense_id uuid                                    -- ← افزوده
    references public.recurring_expenses(id) on delete set null,
  posted_month date,                                           -- ← افزوده (روز اول ماه)
  ai_confidence numeric(3,2) check (ai_confidence between 0 and 1),
  ai_raw jsonb,
  is_confirmed boolean not null default true,                  -- ← افزوده (عنصر امضا)
  needs_review text[] not null default '{}',                   -- ← افزوده
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((recurring_expense_id is null) = (posted_month is null))
);

-- ضمانت idempotency که سند اصلی می‌خواهد:
create unique index transactions_recurring_month_key
  on public.transactions (recurring_expense_id, posted_month)
  where recurring_expense_id is not null and deleted_at is null;

create index transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc) where deleted_at is null;
create index transactions_user_category_idx
  on public.transactions (user_id, category_id) where deleted_at is null;
create index transactions_media_idx on public.transactions (media_asset_id);
```

سه ستون افزوده و دلیلشان:

- `recurring_expense_id` + `posted_month` — سند اصلی می‌گوید «unique constraint روی `(recurring_expense_id, month)` بگذار»، ولی این ستون‌ها در schemaاش وجود ندارند. بدونشان بند ۷.۳ قابل پیاده‌سازی نیست.
- `is_confirmed` + `needs_review` — عنصر امضای طراحی («نوار اطمینان») باید بداند کدام **فیلد** حدسی است، نه فقط کل تراکنش. طراحی صریح می‌گوید «UI باید `needs_review` را per-field بخواند». `ai_confidence` یک عدد کلی است و این را نمی‌دهد.

### ۳.۶ media_assets / goals / variable_expense_baselines / ai_usage_logs

```sql
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('audio','image')),
  storage_path text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0),
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','parsed','failed')),
  transcript text, extracted jsonb, error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_assets_user_status_idx on public.media_assets (user_id, status);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in
    ('emergency_fund','home','travel','debt_payoff','education','investment','other')),
  target_amount bigint not null check (target_amount > 0),
  saved_amount bigint not null default 0 check (saved_amount >= 0),
  target_date date, priority int not null default 0,
  status text not null default 'active'
    check (status in ('active','achieved','paused','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_status_idx on public.goals (user_id, status);

-- ← جدول افزوده: گام ۴ onboarding («تخمین ماهانه در ۵ دسته») جایی برای ذخیره نداشت
create table public.variable_expense_baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  monthly_estimate bigint not null check (monthly_estimate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null, provider text not null, model text not null,
  input_tokens int, output_tokens int, cost_cents int,
  latency_ms int, status text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_logs_user_created_idx on public.ai_usage_logs (user_id, created_at desc);
alter table public.ai_usage_logs enable row level security;
create policy ai_usage_select on public.ai_usage_logs for select to authenticated
  using (user_id = (select auth.uid()));
-- عمداً هیچ policy ای برای insert نیست: فقط سرور (service role) می‌نویسد.
```

### ۳.۷ Storage

دو باکت **خصوصی**: `receipts` و `voice-notes`. قرارداد مسیر: `{user_id}/{uuid}.{ext}`. policy روی `storage.objects` برای هر چهار عملیات:

```sql
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
```

آپلود با signed upload URL از سرور؛ خواندن با signed URL کوتاه‌مدت.

### ۳.۸ Seed

۱۵ دسته‌ی سیستمی سند اصلی با `user_id = null, is_system = true`، و `icon` از جدول گلیف‌های Phosphor در handoff (خوراک `shopping-cart`، رستوران `fork-knife`، …).

---

## ۴. Design Token System

مرجع کامل: `design_handoff_financial_assistant/PLAN-design-tokens.md` (نسخه‌ی آماده‌ی کپی + بلوک `@theme` تیلویند) و `README.md` (مشخصات هر هشت صفحه). خلاصه‌ی تصمیم‌ها:

### ۴.۱ رنگ

شش رنگ نام‌گذاری‌شده: `lapis #23459B` (برند/کنش) · `positive #0E6B4F` · `negative #AD2E24` · `guess #8A5A00` (برنجی، برای مقدارهای حدسی مدل) · `paper #F1F3F6` (خاکستری سرد) · `ink #14181F`. پالت نمودار تک‌هیو و پنج‌پله از lapis، با `#C9CDD4` برای «سایر» — تفکیک با روشنایی، پس در سیاه‌وسفید هم خوانا است.

### ۴.۲ تایپوگرافی

بدنه Vazirmatn (۴۰۰/۵۰۰/۶۰۰/۷۰۰)، display Estedad (۷۰۰/۸۰۰)، هر دو SIL و self-host شده (شش فایل woff2 در handoff). Estedad فقط سه جا: عدد مانده، تیتر گام onboarding، تیتر حالت خالی. مقیاس هشت‌پله از `display-xl 40px` تا `micro 11px`.

### ۴.۳ قاعده‌ی پول و تاریخ

پول: ارقام لاتین + `tabular-nums` + `dir="ltr"` + `unicode-bidi: isolate`، فقط از `<Money />`. تاریخ برعکس: ارقام فارسی، `fa-IR` با `calendar: gregory`.

### ۴.۴ عنصر امضا — «نوار اطمینان»

نوار ۲px زیر هر مقداری که مدل تولید کرده: **خط‌چین برنجی + واژه‌ی «حدس زدم»** تا وقتی تأیید نشده، **پیوسته‌ی مشکی** بعد از تأیید (با انیمیشن ۱۸۰ms). در سه لایه تکرار می‌شود: کارت تأیید (per-field) · ردیف لیست تراکنش · عدد هزینه‌ی داشبورد + بنر «۲ تراکنش تأییدنشده در این جمع هست».

این عنصر مستقیماً به schema گره خورده: ستون‌های `is_confirmed` و `needs_review` در بخش ۳.۵ برای همین اضافه شدند.

### ۴.۵ نقد من بر خروجی طراحی

طراحی نقد خودش را دارد (چرا چهار کارت هم‌وزن به یک عدد قهرمان تبدیل شد، چرا برنجی به‌تنهایی کافی نیست، چرا لاجورد بدون نوار اطمینان امضا نمی‌سازد). سه ایراد باقی‌مانده که از منظر پیاده‌سازی می‌بینم و باید در M0/M5 حل شوند:

1. **عدد مانده در ۴۰px روی ۳۷۵px سرریز می‌کند.** موکاپ `+$1,131.60` را نشان می‌دهد (۹ نویسه). یک کاربر با مانده‌ی `+$12,345.60` یا ارز `€` با جداکننده‌ی متفاوت به ۱۱ نویسه می‌رسد و در عرض ۳۴۳px باقیمانده جا نمی‌شود. راه‌حل: `clamp()` روی `display-xl` بین ۲۸ و ۴۰px بر اساس طول رشته، یا کوچک‌شدن پله‌ای در `<Money size="hero">`. این را در M0 داخل خود کامپوننت حل می‌کنیم، نه در M5 با patch.
2. **دو خانواده فونت = شش فایل ≈ ۳۷۰KB.** با `font-display: swap` عدد مانده اول با Vazirmatn رندر می‌شود و بعد به Estedad می‌پرد — دقیقاً روی همان عنصری که سند می‌گوید باید در ۵ ثانیه خوانده شود. راه‌حل: فقط `Estedad-ExtraBold` و `Vazirmatn-{Regular,SemiBold}` با `<link rel="preload">` بارگذاری شوند و woff2ها به بازه‌ی فارسی+لاتین subset شوند (فایل کامل Vazirmatn بازه‌های عربی‌ای دارد که استفاده نمی‌کنیم).
3. **خط‌چین زیر عدد، شبیه لینک یا غلط املایی خوانده می‌شود.** طراحی این را با واژه‌ی همراه و `aria-describedby` پوشانده، که کافی است — ولی در تست پذیرش باید صریحاً پرسیده شود «فکر می‌کنی این خط‌چین یعنی چه؟». اگر پاسخ «لینک است» بود، به جای خط‌چین باید به پس‌زمینه‌ی برنجی کم‌رنگ سوییچ کنیم. این تنها ریسک طراحی است که با استدلال حل نمی‌شود و به مشاهده نیاز دارد.

انحراف عمدی از سند اصلی: سند «ردیف اول — چهار کارت» می‌خواهد؛ طراحی مانده را از کارت بیرون کشیده و تیتر صفحه کرده و سه کارت دیگر را زیرش گذاشته. این انحراف **پذیرفته می‌شود** چون مستقیماً به جمله‌ی محک سند («در کمتر از ۵ ثانیه بفهمد چقدر مانده») خدمت می‌کند. در `DECISIONS.md` ثبت می‌شود.

---

## ۵. نگاشت به Milestoneها

ترتیب M0..M9 سند اصلی دست‌نخورده می‌ماند. تنها تغییر پیشنهادی: **`<Money />` و `confidence-rule.tsx` در M0 ساخته شوند** نه M4/M6 — چون هر دو در تمام صفحات بعدی استفاده می‌شوند و ساختنشان در M0 از بازنویسی در سه milestone بعدی جلوگیری می‌کند.

`.env.example` طبق سند، بدون تغییر.

---

## ۶. ریسک‌های فنی

| # | ریسک | اثر | کاهش |
|---|---|---|---|
| ~~R1~~ | ~~`MediaRecorder` روی iOS Safari~~ | **منتفی شد** — ضبط درون‌برنامه‌ای از دامنه خارج شد و کاربر با کیبورد خودش دیکته می‌کند | — |
| ~~R2~~ | ~~کیفیت Whisper روی فارسی محاوره‌ای~~ | **منتفی شد** — رونویسی روی دستگاه کاربر انجام می‌شود و متنش پیش از پارس قابل ویرایش است | — |
| **R3** | **سقف ۴.۵ مگابایتی body در Vercel** در برابر «حداکثر ۵ مگابایت» سند برای فاکتور | عکس‌های بزرگ با خطای مبهم ۴۱۳ رد می‌شوند | عکس هرگز از route handler عبور نمی‌کند (تصمیم ۱.۳): کلاینت مستقیم به Storage آپلود می‌کند، سرور فقط `media_asset_id` می‌گیرد. این هم سقف را حذف می‌کند و هم تأخیر را کم می‌کند |
| **R4** | **تایم‌اوت اجرای تابع** — Claude vision روی فاکتور می‌تواند به ۲۰-۳۰ ثانیه برسد؛ پیش‌فرض Vercel کمتر است | خطای ۵۰۴ وسط پردازش، در حالی که هزینه‌ی AI پرداخت شده | `export const maxDuration = 60` روی هر سه route + تایم‌اوت ۳۰ ثانیه روی خود SDK تا سرور زودتر از پلتفرم تسلیم شود و پیام فارسی درست بدهد |
| **R5** | **RTL در shadcn/Radix** — بعضی کامپوننت‌ها (Sheet، DropdownMenu، Select) جهت را از prop می‌گیرند نه از `dir` والد | مودال از سمت غلط باز می‌شود؛ منو بیرون صفحه می‌افتد | `dir="rtl"` صریح روی Providerهای Radix + یک audit در پایان M0 روی هر کامپوننت نصب‌شده. lint rule برای ممنوع‌کردن `ml-*`/`mr-*` |
| **R6** | **نشت `SUPABASE_SERVICE_ROLE_KEY`** — service role تمام RLS را دور می‌زند | نشت کامل داده‌ی همه‌ی کاربران | `import "server-only"` در بالای `lib/supabase/admin.ts`؛ استفاده فقط در دو جا (نوشتن `ai_usage_logs` و خواندن فایل از Storage). تست پذیرش ۶ سند (کاربر دوم) در پایان هر milestone تکرار می‌شود، نه فقط M9 |
| **R7** | **مرز ماه و timezone** — کاربری در ونکوور ساعت ۲۳:۳۰ خرید می‌کند؛ با UTC این خرید در ماه بعد می‌افتد | جمع کارت «هزینه‌ی این ماه» با جمع لیست تراکنش‌ها نمی‌خواند (نقض تست پذیرش ۵) | `occurred_on` از نوع `date`، و بازه‌ی ماه همیشه از `lib/date.ts` با timezone پروفایل. تست واحد برای سه timezone (تورنتو، لندن، ملبورن) در M4 |
| **R8** | **رقابت روی سقف ۵۰ فراخوانی** — دو درخواست همزمان هر دو شمارش را زیر سقف می‌بینند | چند فراخوانی اضافه در روز | پذیرفته می‌شود. اگر بعداً مسئله شد، به یک شمارنده‌ی اتمی در Postgres منتقل می‌شود |
| **R9** | **`auto_post` و تغییر ماه** — اگر کاربر ماه گذشته وارد اپ نشده باشد، ماه‌های جا افتاده تولید نمی‌شوند | تراکنش‌های تکرارشونده‌ی ماه‌های قبل غایب‌اند | در MVP فقط ماه جاری تولید می‌شود و این محدودیت در UI گفته می‌شود. ساخت گذشته‌نگر خارج از دامنه است — اگر لازم شد، همان RPC با یک بازه‌ی ماه قابل فراخوانی است |

---

## ۷. پرسش‌های باز (پیش از M0 جواب می‌خواهند)

1. **مدل Claude.** سند `claude-sonnet-4-6` را نوشته. نسل جاری `claude-sonnet-5` است که هم جدیدتر و هم **ارزان‌تر** است ($2/$10 در برابر $3/$15 به ازای هر میلیون توکن). پیشنهاد من `claude-sonnet-5` است مگر دلیلی برای قفل‌شدن روی نسخه‌ی قبلی داشته باشی.
2. **سه افزوده به schema** (بخش ۳): ستون `recurring_expense_id`/`posted_month` روی transactions، جدول `variable_expense_baselines`، و ستون `savings_rate_estimate`. هر سه برای پیاده‌سازی فیچرهایی‌اند که خود سند خواسته ولی جا برایشان در مدل داده نبود. تأیید می‌کنی؟
3. **`is_confirmed` / `needs_review` روی transactions.** عنصر امضای طراحی بدون این دو ستون قابل پیاده‌سازی نیست (باید بدانیم کدام *فیلد* حدسی بوده). این یعنی وضعیت «تأییدنشده» بعد از ذخیره هم باقی می‌ماند — یعنی کاربر می‌تواند تراکنشی را ذخیره کند و بعداً فیلد حدسی‌اش را اصلاح کند. سند اصلی این را صریح نگفته؛ طراحی فرضش کرده. درست است؟

---

## ۸. قدم بعدی

با تأیید تو، M0 شروع می‌شود: اسکلت Next.js، Tailwind v4 با بلوک `@theme` از handoff، فونت‌های self-host، shadcn با RTL، migrationها و RLS بالا، seed دسته‌ها، و `<Money />` + `confidence-rule.tsx`. پایان M0 با `pnpm typecheck && pnpm lint && pnpm build` تمیز و یک گزارش کوتاه.

---

## ۹. پاکت‌ها و جریان (بعد از MVP)

داشبورد از «گزارشِ گذشته» به «وضعیتِ حالا و پیش‌بینیِ آینده» رفت. سه چیز تازه، و هیچ‌کدام مدل صدا نمی‌زنند — هر سه ریاضی و قاعده‌اند (قاعده‌ی ۵).

### ۹.۱ Schema تازه

```sql
-- migration 0019 — سقف دسته‌ای. «از این ماه به بعد»، نه یک ردیف در هر ماه.
create table public.category_budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  category_id    uuid not null references public.categories(id) on delete cascade,
  amount_minor   bigint not null check (amount_minor > 0),
  currency       text not null check (char_length(currency) = 3),
  -- همیشه اول ماه، تا «تازه‌ترین ردیف تا این ماه» یک جواب داشته باشد.
  effective_from date not null check (date_trunc('month', effective_from) = effective_from),
  created_at     timestamptz not null default now(),
  unique (user_id, category_id, effective_from)
);

-- migration 0020 — فقط «دیده شد». خودِ بینش هیچ‌وقت ذخیره نمی‌شود.
create table public.insight_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  insight_key  text not null,          -- «rule:scope»، مثل "weekly_delta:2026-W38"
  dismissed_at timestamptz not null default now(),
  primary key (user_id, insight_key)
);

-- migration 0021 — مقصد پیش‌فرضِ «/». نه workspaceِ جاری؛ آن از آدرس می‌آید.
alter table public.profiles
  add column default_workspace text check (default_workspace in ('personal','dong'));
```

و یک تابع، کنار `account_balances()` و `goal_progress()` و به همان دلیل (قاعده‌ی ۶ — هیچ جمعی در ستون ذخیره نمی‌شود):

```sql
public.envelope_status(p_month_start date, p_month_end date)
  returns table (category_id, name_fa, budget_minor, spent_minor,
                 remaining_minor, unconfirmed_minor)
  language sql stable security invoker set search_path = ''
```

`security invoker` عمدی است: سیاستِ خواندنِ `categories` تنها سیاست schema است که «ردیف‌های خودت» نیست (دسته‌های سیستمی `user_id` تهی دارند و مال همه‌اند). حقِ invoker این را مجانی می‌دهد؛ حقِ definer باید همان منطق را دوباره می‌نوشت و اولین باری که آن بازنویسی عقب می‌ماند، دسته‌های سفارشیِ بقیه لو می‌رفت.

### ۹.۲ ماژول‌های تازه

| فایل | کار |
|---|---|
| `lib/envelopes.ts` | `envelopeState` · `projectedSpend` · `dailyAllowance` · `suggestBudget` — خالص، بدون دیتابیس |
| `lib/queries/envelopes.ts` | تنها مسیر خواندنِ پاکت‌ها، پشت `server-only` |
| `lib/insights.ts` | `buildInsights` با هشت قاعده. هیچ ورودی‌ای از دیتابیس نمی‌خواند |
| `lib/queries/insights.ts` | نیمه‌ی دیتابیسیِ بالایی: dismissalها، هفته‌ی جاری و قبل، قدیمی‌ترین تأییدنشده |
| `lib/entry/quick-parse.ts` | دروازه‌ی پیش از مدل |
| `lib/chart-colors.ts` | رمپ نمودارها، یک‌بار — به `--chart-1..5` اشاره می‌کند |
| `lib/cashflow.ts` | `projectedMonthEnd()` اضافه شد؛ همان تعریفِ واحدِ «آخر ماه چقدر می‌ماند» |

### ۹.۳ صفحه‌ها

- `/dashboard` — بورد پاکت‌ها به‌جای دونات. کارت مانده روی `--color-ink` با پیش‌بینیِ پایان ماه (خط‌چین، چون حدس است) و باند فرود.
- `/stream` (تازه) — بینش‌های محاسبه‌شده، حدس‌های تأییدنشده، و ثبت‌های اخیر. **هیچ درخواستی به OpenRouter در این مسیر نیست.**
- `/transactions` — دونات این‌جا نشست، و با `?category=` سرصفحه‌ی سقف می‌گیرد. تنها جایی که سقف ویرایش می‌شود.
- `/` — اگر `default_workspace` ست باشد یک‌راست می‌رود؛ `/?choose=1` همیشه سؤال را نشان می‌دهد.

### ۹.۴ ناوبری

تب‌بار داخل نوار نوشتن نشست (یک نوار ثابت، نه دو تا): **پاکت‌ها · جریان · هدف‌ها · تنظیمات**. «تراکنش‌ها» به `desktopOnly` رفت و روی گوشی از دو در وارد می‌شود — جست‌وجوی بالای بورد، و تپ روی هر پاکت.

### ۹.۵ محافظ‌های هزینه

- **دروازه‌ی پیش از مدل**: متنِ بدون عدد، کوتاه‌تر از سه نویسه، یا الگوی ساده‌ی «عدد + نام» بدون فراخوانی مدل به فرم می‌رود.
- **سقف روزانه به تفکیک مسیر** (`FEATURE_DAILY_LIMITS`): ۶۰ متن / ۲۰ فاکتور / ۵ صورت‌حساب. سقف مهمان (۳) عمداً مشترک ماند.
