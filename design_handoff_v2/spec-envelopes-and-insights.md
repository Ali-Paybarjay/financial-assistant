# پاکت‌ها و بینش‌ها — مشخصات پیاده‌سازی (قالب 2a)

> قابل کپی در `PLAN.md`. زبان کد انگلیسی، زبان رابط فارسی. هیچ‌جای این سند مدل صدا زده نمی‌شود: هر دو قابلیت ریاضی و قاعده‌اند، نه استنباط — قاعدهٔ ۵ پروژه.

---

## بخش ۱ — پاکت‌ها (سقف دسته‌ای)

### ۱.۱ Schema

```sql
-- migration 00xx_category_budgets.sql
create table public.category_budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category_id   uuid not null references public.categories(id) on delete cascade,
  -- سنت. هیچ‌وقت float. مثل بقیهٔ پول در این پروژه.
  amount_minor  bigint not null check (amount_minor > 0),
  currency      text   not null,
  -- از کدام ماه معتبر است. تاریخچه نگه می‌داریم تا تغییر سقف، ماه‌های گذشته را عوض نکند.
  effective_from date not null,
  created_at    timestamptz not null default now(),
  unique (user_id, category_id, effective_from)
);

alter table public.category_budgets enable row level security;

create policy "own budgets" on public.category_budgets
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index on public.category_budgets (user_id, category_id, effective_from desc);
```

**چرا `effective_from` و نه یک ردیف در هر ماه:** یک ردیف در هر ماه یعنی ۱۲ ردیف در سال به هر دسته، و ماهی که کاربر سقف را دست نزده باید خودکار پر شود. با «از این ماه به بعد»، سقفِ هر ماه = آخرین ردیفی که `effective_from <= month_start` است. هیچ job شبانه‌ای لازم نیست.

### ۱.۲ خواندن وضعیت پاکت‌ها — در SQL، نه در TS

طبق قاعدهٔ ۶ («هیچ جمعی در ستون ذخیره نمی‌شود»)، مانند `account_balances()`:

```sql
create or replace function public.envelope_status(p_month_start date, p_month_end date)
returns table (
  category_id   uuid,
  name_fa       text,
  budget_minor  bigint,   -- null = سقفی تعریف نشده
  spent_minor   bigint,
  remaining_minor bigint, -- منفی = از سقف رد شده
  unconfirmed_minor bigint -- چقدر از spent هنوز تأیید نشده
)
language sql
security invoker
stable
as $$
  with b as (
    select distinct on (category_id) category_id, amount_minor
    from public.category_budgets
    where user_id = (select auth.uid()) and effective_from <= p_month_start
    order by category_id, effective_from desc
  ),
  s as (
    select category_id,
           sum(amount)                                    as spent,
           sum(case when is_confirmed then 0 else amount end) as unconfirmed
    from public.transactions
    where user_id = (select auth.uid())
      and type = 'expense'
      and occurred_on between p_month_start and p_month_end
    group by category_id
  )
  select c.id, c.name_fa,
         b.amount_minor,
         coalesce(s.spent, 0),
         b.amount_minor - coalesce(s.spent, 0),
         coalesce(s.unconfirmed, 0)
  from public.categories c
  left join b on b.category_id = c.id
  left join s on s.category_id = c.id
  where b.amount_minor is not null or coalesce(s.spent, 0) > 0
  order by (b.amount_minor is null), coalesce(s.spent,0) desc;
$$;
```

### ۱.۳ منطق خالص (`lib/envelopes.ts`) — تست‌شدنی، بدون دیتابیس

```ts
export type EnvelopeState = "under" | "tight" | "over" | "unset";

/** tight = ۸۵٪ سقف یا بیشتر، ولی هنوز رد نشده. */
export function envelopeState(budget: number | null, spent: number): EnvelopeState {
  if (budget === null) return "unset";
  if (spent > budget) return "over";
  return spent >= budget * 0.85 ? "tight" : "under";
}

/** سرعت خرج این پاکت، تعمیم‌داده‌شده تا پایان ماه. */
export function projectedSpend(spent: number, daysGone: number, daysInMonth: number): number {
  if (daysGone <= 0) return spent;
  return Math.round((spent / daysGone) * daysInMonth);
}

/** «تا آخر ماه روزی چقدر از این پاکت می‌توانی خرج کنی» — صفر اگر رد شده. */
export function dailyAllowance(budget: number | null, spent: number, daysLeft: number): number | null {
  if (budget === null || daysLeft <= 0) return null;
  return Math.max(0, Math.round((budget - spent) / daysLeft));
}
```

### ۱.۴ حالت‌های رابط کاربری

| حالت | کارت پاکت | متن |
|---|---|---|
| `unset` | خط‌چین دور کارت، بدون نوار | «سقف نداری — <span>تعیین کن</span>» |
| `under` | نوار نیل | «از $700 مانده» |
| `tight` | نوار نیل + کارت برنجی | «$87.60 مانده · روزی $6.25» |
| `over` | نوار قرمز + زمینهٔ برنجی | «از سقف $250 رد شد» |
| `unconfirmed > 0` | زیرِ عدد، خط‌چین برنجی | «شامل $62.40 تأییدنشده» |

سقفِ ماه‌های گذشته **فقط خواندنی** است؛ ویرایش سقف همیشه ردیف جدید با `effective_from` ماه جاری می‌سازد.

### ۱.۵ اونبوردینگ: پیشنهاد سقف بدون مدل

میانهٔ سه ماه گذشتهٔ هر دسته، رُند به بالا تا نزدیک‌ترین ۵۰ واحد. میانه نه میانگین — یک ماهِ اسباب‌کشی میانگین را دو برابر می‌کند.

```ts
export function suggestBudget(monthlySpends: number[]): number | null {
  const months = monthlySpends.filter((n) => n > 0).sort((a, b) => a - b);
  if (months.length < 2) return null;          // دادهٔ کافی نیست: سقف پیشنهاد نده
  const mid = Math.floor(months.length / 2);
  const median = months.length % 2 ? months[mid] : (months[mid - 1] + months[mid]) / 2;
  return Math.ceil(median / 5_000) * 5_000;    // سنت ⇒ رُند به ۵۰ دلار
}
```

اگر کاربر تازه‌وارد است و تاریخچه ندارد، هیچ سقفی پیشنهاد نمی‌شود و بورد با حالت `unset` می‌آید — یک عدد ساختگی بدتر از نبودنِ عدد است.

---

## بخش ۲ — بینش‌ها (تب «جریان»)

### ۲.۱ شکل داده

بینش **ذخیره نمی‌شود**؛ در زمان درخواست حساب می‌شود و فقط «دیده‌شدن»ش ذخیره می‌گردد. دلیل: یک بینش ذخیره‌شده با تراکنشی که فردا ویرایش می‌شود از هم می‌پاشد و به کاربر جملهٔ غلط نشان می‌دهد.

```sql
create table public.insight_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  insight_key  text not null,   -- «rule_id:scope» مثلاً "weekly_delta:2026-W38"
  dismissed_at timestamptz not null default now(),
  primary key (user_id, insight_key)
);
```

```ts
export type Insight = {
  key: string;                 // یکتا در دامنه‌اش، برای dismiss
  rule: InsightRule;
  tone: "neutral" | "warn" | "good";
  text: string;                // فارسی، ساخته‌شده در کد
  action?: { label: string; href: string };
  weight: number;              // برای مرتب‌سازی؛ فقط ۳ تای اول نشان داده می‌شود
};
```

### ۲.۲ قاعده‌ها — همه‌شان تابع خالص روی دفتر

| `rule` | شرط فعال‌شدن | ورودی | متن (نمونه) | اقدام | دامنه/تکرار |
|---|---|---|---|---|---|
| `pace_over` | خرجِ روزانه > سهم مجاز روز × ۱.۱۵ و ≥۵ روز از ماه گذشته | `income, expense, daysGone, daysLeft` | «با این سرعت، ماه را با −$503 تمام می‌کنی.» | «پاکت‌ها» | یک‌بار در ماه، تا وقتی شرط برقرار است |
| `envelope_over` | `envelopeState === "over"` | `envelope_status()` | «پاکت «رستوران و کافه» $34.90 از سقف رد شد.» | «سقف را ببر بالا» | به هر دسته، یک‌بار در ماه |
| `envelope_tight` | `tight` و ≥۷ روز از ماه مانده | همان | «از «خوراک» $87.60 مانده — روزی $6.25 تا آخر ماه.» | «پاکت» | به هر دسته، هفتگی |
| `weekly_delta` | \|تغییر\| ≥ ۱۵٪ نسبت به هفتهٔ قبل | جمع هفتهٔ جاری و قبل | «این هفته $412.30 خرج کرده‌ای؛ ۱۸٪ بیشتر از هفتهٔ قبل. بیشترش «رستوران و کافه» بود.» | «جزئیات» | هفتگی |
| `unconfirmed_backlog` | ≥۱ تراکنش تأییدنشده با سن >۴۸ ساعت | `count, oldest` | «۲ حدس تأییدنشده مانده؛ جمع ماه تا تأییدشان قطعی نیست.» | «بررسی» | روزانه |
| `statement_due` | حساب فعالی که این ماه با بانک تطبیق نشده | `accountsDue` | «پرینت شهریور «چکینگ TD» را آپلود کن تا موجودی با بانک یکی شود.» | «صورت‌حساب» | ماهانه، به هر حساب |
| `goal_at_risk` | `requiredMonthly(goal) > surplus` | `goals, cashflow` | «با این نرخ، «سفر تابستان» ۳ ماه دیرتر از تاریخش کامل می‌شود.» | «برنامه» | ماهانه، به هر هدف |
| `recurring_missed` | هزینهٔ ثابتِ تولیدنشده از ماه‌های گذشته | `missed` | «۱ هزینهٔ ثابت شهریور ثبت نشده.» | «بررسی» | تا وقتی حل نشود |

قاعده‌ها بر اساس `weight` مرتب می‌شوند: `recurring_missed` و `unconfirmed_backlog` بالاتر از بینش‌های آماری‌اند، چون کاربر می‌تواند کاری درباره‌شان بکند و تا آن کار انجام نشود بقیهٔ اعداد قطعی نیستند.

### ۲.۳ امضای تابع

```ts
// lib/insights.ts — تابع خالص. هر ورودی از قبل خوانده شده؛ این ماژول به دیتابیس دست نمی‌زند.
export function buildInsights(input: {
  today: string;                  // YYYY-MM-DD در timezone کاربر
  month: { start: string; end: string; daysGone: number; daysLeft: number };
  totals: { income: number; expense: number; unconfirmedCount: number; oldestUnconfirmedAt: string | null };
  previousWeek: number;
  currentWeek: number;
  envelopes: EnvelopeRow[];
  goals: GoalWithProgress[];
  accountsDue: AccountWithBalance[];
  missedRecurring: number;
  dismissedKeys: Set<string>;
  currency: CurrencyCode;
}): Insight[];
```

قواعد تست (`tests/unit/insights.test.ts`): هر قاعده دو تست دارد — مرزِ فعال‌شدن، و اینکه با `dismissedKeys` حذف می‌شود. `buildInsights` با ورودی خالی باید `[]` بدهد، نه جملهٔ تشویقی؛ «همه‌چیز خوب است» یک بینش نیست.

### ۲.۴ متن‌ها

فعل فعال، بدون تعارف، بدون عذرخواهی. عدد همیشه از `<Money>` می‌آید و در جملهٔ فارسی ایزوله می‌شود. هیچ بینشی با «شاید»، «به نظر می‌رسد» یا «هوش مصنوعی» شروع نمی‌شود: این جمله‌ها محاسبه‌اند و لحنشان باید قطعی باشد.

---

## بخش ۳ — هزینه و محافظ‌ها

هیچ‌کدام از دو بخش بالا API صدا نمی‌زند. تنها مسیرهای پرهزینه همان سه مسیر موجودند. دو محافظ که با نوار نوشتنِ همیشه‌باز لازم می‌شوند:

1. **دروازهٔ پیش از مدل** (`lib/entry/quick-parse.ts`): اگر متن هیچ عددی ندارد، یا کمتر از ۳ نویسه است، یا فقط یک عدد بی‌واحد است — بدون صدا زدن مدل، فرم دستی با همان مقدار پیش‌پر می‌شود. الگوی سادهٔ «عدد + نام» را هم می‌شود با regex گرفت و مدل را کنار گذاشت.
2. **سقف درخواست به هر کاربر در روز** روی هر سه مسیر (مثلاً ۶۰ متن، ۲۰ فاکتور، ۵ صورت‌حساب). پیام رد: «امروز به سقف ثبت خودکار رسیدی. دستی ثبت کن یا فردا ادامه بده.»

---

## ترتیب پیاده‌سازی

۱. migration + `envelope_status()` + `lib/envelopes.ts` با تست.
۲. بورد پاکت‌ها به‌جای دونات در داشبورد (دونات به صفحهٔ تراکنش‌ها منتقل می‌شود).
۳. نوار نوشتن به‌جای دکمهٔ شناور، با همان سه مسیر موجود + دروازهٔ پیش از مدل.
۴. `lib/insights.ts` + تب «جریان» + `insight_dismissals`.
۵. گام اونبوردینگ سقف‌ها (`suggestBudget`)، آخر از همه — چون به تاریخچه نیاز دارد.
