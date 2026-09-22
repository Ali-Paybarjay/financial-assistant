# Design Token System — برای کپی در `PLAN.md`

> این بخش خروجی فاز طراحی است. مرجع بصری کامل (موکاپ‌ها): `design_handoff_financial_assistant/README.md` و فایل HTML کنارش.

## ۱. پالت — شش رنگ نام‌گذاری‌شده + دلیل

| توکن | Hex | نقش | دلیل انتخاب |
|---|---|---|---|
| `lapis` | `#23459B` | برند، کنش اصلی، لینک، سری اصلی نمودار | رنگدانه‌ی لاجورد ایرانی؛ آبی عمیق با گرایش بنفش. عمداً از آبی‌بنفشِ رایج فین‌تک تیره‌تر و کم‌درخشان‌تر است تا روی اعداد سیاه غالب نشود |
| `positive` | `#0E6B4F` | مانده‌ی مثبت، درآمد | سبزِ اشباع‌نشده؛ نه سبز اسیدی (لوکِ ممنوع) و نه سبز «سود». کنتراست روی سفید ≈ ۵.۳:۱، پس برای عدد ۱۵px هم مجاز است. همیشه با علامت `+` |
| `negative` | `#AD2E24` | مانده‌ی منفی، کنش مخرب | قرمزِ خاکی‌شده؛ کسری بودجه یک واقعیت است نه خطای سیستم. ≈ ۵.۲:۱. همیشه با علامت `−` |
| `guess` | `#8A5A00` | مقدارهایی که مدل حدس زده | تنها رنگی که به‌خاطر معماری محصول اضافه شده: سه روش از چهار روش ثبت، داده‌ی حدسی تولید می‌کنند. زرد روشن روی سفید AA نمی‌دهد، پس به برنجِ تیره رانده شد |
| `paper` | `#F1F3F6` | زمینه‌ی صفحه | خاکستریِ سردِ کم‌رنگ؛ کاست سرد عمدی است — پادزهرِ لوکِ ممنوعِ «کرم گرم». کارت‌های سفید روی آن بدون سایه‌ی سنگین خوانده می‌شوند |
| `ink` | `#14181F` | متن | نه مشکی مطلق؛ کمی آبی دارد تا با لاجورد هم‌خانواده بماند |

رنگ‌های پشتیبان: `surface #FFFFFF` · `ink-muted #5C6573` (≈۵.۱:۱) · `ink-faint #8B93A1` (فقط placeholder) · `hairline #E2E6EC` · `hairline-strong #C4CCD8` · `lapis-pressed #16307A` · `lapis-tint #EDF1FA` · `positive-tint #E7F2EE` · `negative-tint #FBEBE9` · `guess-text #6E4700` · `guess-tint #FDF4DE` · `guess-border #EFDFB4`.

**پالت نمودار (تک‌رنگ، نه رنگین‌کمان):** `#23459B → #3E5CB2 → #6280C8 → #93A8DC → #C2CDEB` به ترتیب سهم، و «سایر» همیشه `#C9CDD4`. تفکیک با روشنایی است نه هیو، پس در سیاه‌وسفید هم ترتیب حفظ می‌شود.

**قاعده:** رنگ فقط جایی مجاز است که خودش پیام باشد (علامت مانده، وضعیت هدف، حدسی‌بودن مقدار) و هرگز تنها حاملِ معنا نیست — علامت `+`/`−`، واژه و آیکون همراهش هستند. فقط لایت‌مود در MVP.

## ۲. مقیاس تایپوگرافی

بدنه **Vazirmatn** (۴۰۰/۵۰۰/۶۰۰/۷۰۰)، display **Estedad** (۷۰۰/۸۰۰). هر دو SIL و **self-host** (فایل‌های woff2 در `fonts/webfonts/`). هیچ CDN تحریم‌خورده‌ای.

> **چرا استعداد و نه مربع:** مربع لایسنس تجاری دارد و قید self-host را با یک قید حقوقی عوض می‌کند. استعداد آزاد است، وزن ۸۰۰ دارد و ارقام لاتینش با وزیرمتن هم‌عرض می‌ماند.

استعداد فقط سه جا: عدد مانده، تیتر گام‌های onboarding، تیتر حالت خالی.

| توکن | فونت / وزن | سایز / line-height | کاربرد |
|---|---|---|---|
| `display-xl` | Estedad 800 | 40 / 44–48 | فقط عدد مانده‌ی ماه |
| `display-l` | Estedad 700 | 28 / 34–36 | تیتر گام onboarding و حالت خالی |
| `num-l` | Vazirmatn 600 | 24 / 28 | عدد کارت‌های KPI |
| `title` | Vazirmatn 600 | 19 / 26 | تیتر صفحه و کارت |
| `body` | Vazirmatn 400 | 15 / 24 | متن بدنه |
| `label` | Vazirmatn 500 | 13 / 18 | برچسب فیلد و کارت |
| `caption` | Vazirmatn 500 | 12 / 16 | فراداده‌ی ردیف |
| `micro` | Vazirmatn 500/600 | 11 / 14 | برچسب نوار پایین، محور نمودار، بج |

**قاعده‌ی پول:** ارقام لاتین + جداکننده‌ی هزارگان + `tabular-nums` + ایزوله‌ی جهت (`dir="ltr"` و `unicode-bidi: isolate`) تا جای نماد ارز به هم نریزد. فقط از کامپوننت `<Money />`. تاریخ برعکس: ارقام فارسی، `fa-IR` با `calendar: gregory` («۱۶ سپتامبر ۲۰۲۶»).

## ۳. اسپیسینگ، گردی، ارتفاع، حرکت

- اسپیسینگ بر پایه‌ی ۴: `4 · 8 · 12 · 16 · 24 · 32 · 48`
- گردی: کارت `14px` · ورودی و دکمه `10px` · چیپ و FAB `999px`. **صفرِ گردی ممنوع** (لوکِ روزنامه‌ای)
- خط جداکننده `1px solid #E2E6EC` — نه خط مویی ۰.۵px
- تنها سایه، فقط برای لایه‌ی شناور: `0 1px 2px rgba(20,24,31,.04), 0 8px 24px -14px rgba(20,24,31,.16)`؛ FAB: `0 8px 24px -10px rgba(35,69,155,.7)`
- هدف لمسی حداقل `44px`؛ ردیف لیست و کارت گزینه `56px`
- حرکت فقط دو تا: **۱۸۰ms** تثبیت حدس · **۲۲۰ms** بالا آمدن مودال. هر دو با `prefers-reduced-motion` حذف
- focus همیشه `outline: 2px solid #23459B; outline-offset: 2px` روی `:focus-visible`

## ۴. عنصر امضا — «نوار اطمینان»

یک نوار `2px` زیر هر مقداری که مدل تولید کرده:

- **حدس:** `2px dashed #8A5A00` + واژه‌ی «حدس زدم» (بج `#FDF4DE`/`#8A5A00`، `999px`، ارتفاع ۲۴، 12px/600)
- **تأییدشده:** `2px solid #14181F` + انیمیشن ۱۸۰ms (خط‌چین به پیوسته، ۳px جابه‌جایی، opacity 0→1)

در سه لایه تکرار می‌شود: کارت تأیید (زیر هر فیلد) · لیست تراکنش‌ها (زیر نام فروشنده‌ی ردیف تأییدنشده + کپشن برنجی) · داشبورد (زیر عدد هزینه وقتی جمع شامل تأییدنشده است + بنر برنجی با کنش «بررسی»).

**چرا معنادار است:** در این محصول داده عمدتاً با حدس وارد می‌شود؛ تمایز «چیزی که گفتم» و «چیزی که برداشت شد» موضوعِ اصلی رابط است، نه یک جزئیات. دونات و کارت KPI را هر اپ مالی دیگری هم دارد.

**نقد:**
1. پیش‌نویس اول چهار کارت KPI هم‌اندازه بود — همان داشبورد پیش‌فرض. اصلاح: «مانده» از کارت بیرون کشیده شد و تیترِ صفحه شد؛ سه عدد دیگر به ردیفی کم‌وزن‌تر زیرش رفتند. جمله‌ی محکِ «کمتر از ۵ ثانیه» یک عدد می‌خواهد، نه چهار عددِ هم‌وزن.
2. برنجی ریسکِ «هشدار» خوانده‌شدن دارد. پس رنگ هرگز تنها حامل معنا نیست: خط‌چین + واژه + `aria-describedby`.
3. لاجورد به‌تنهایی هویت نمی‌سازد؛ آبی عمیق انتخابِ محتملِ هر اپ مالی است. چیزی که این پالت را جدا می‌کند نقشِ ساختاری برنجی است. اگر نوار اطمینان حذف شود، این پالت امضایی ندارد.

## ۵. آیکون و ناوبری

- **Phosphor Regular**، subset حدود ۴۰ گلیف، **self-host** (لایسنس MIT). `20px` درون ردیف، `22–24px` در نوار پایین. وزن **Fill** فقط برای تبِ فعال.
- آیکون‌های جهت‌دار mirror: `caret-right` = بازگشت، `caret-left` = جلو.
- **هیچ آیکون «AI» نداریم** — نه جرقه نه ستاره. منبع هر تراکنش با آیکونِ کارِ واقعی: `keyboard` / `textbox` / `microphone` / `receipt`.
- ناوبری موبایل: نوار پایینِ چهارتایی (`house` · `list-dashes` · `target` · `gear`) + FAB بالای آن. درآمد و هزینه‌های ثابت زیر تنظیمات، نه در نوار پایین.
- از `960px`: نوار پایین → سایدبار `232px` سمت راست، FAB حذف و کنش اصلی به هدر، محتوا تا `1120px` و بعد وسط. **سایز فونت‌ها عوض نمی‌شود.**
- ⚠️ در فلکسِ RTL هیچ `order` ای روی سایدبار/main نگذار — کوچک‌ترین `order` به راست می‌رود و نتیجه برعکس می‌شود.

## ۶. لحن متن رابط

فعل فعال، جمله‌ی ساده، بدون تعارف. اپ با کاربر دوم‌شخص مفرد حرف می‌زند و از خودش اول‌شخص («حدس زدم»، «نشانت می‌دهم»).

- **دکمه:** ثبت هزینه · ثبت دو تراکنش · سؤال بعدی · تبدیل به تراکنش · فعلاً رد کن · برگردان — نه: ارسال · تأیید و ادامه · ذخیره‌سازی اطلاعات
- **درحال‌انجام:** «دارم متن را می‌خوانم…» · «دارم ثبت می‌کنم…» (دکمه قفل می‌شود تا کلیک دوم تراکنش تکراری نسازد)
- **خطا** (چه شد + چه کن، بدون عذرخواهی): «مبلغی در متن پیدا نکردم. عدد و ارز را بنویس، مثل "۴۵ دلار قهوه".» · «فاکتور خوانا نبود. از مبلغ کل عکس بگیر یا مبلغ را دستی بزن.» · «امروز به سقف ۵۰ پردازش هوشمند رسیدی. تا فردا با فرم ثبت کن.» · «اتصال قطع شد. تراکنش را نگه داشتم؛ دوباره بزن "ثبت".»
- **تأیید پس از ثبت:** «ثبت شد. $1,069.20 برایت مانده.» — همیشه عدد جدید مانده گفته می‌شود.
- **حالت خالی:** «اولین خریدت را ثبت کن — تا یک هزینه ثبت نکنی، نموداری برای نشان‌دادن ندارم.»

---

## ۷. پیاده‌سازی — Tailwind v4

```css
/* app/globals.css */
@import "tailwindcss";

@font-face { font-family: Vazirmatn; src: url("/fonts/Vazirmatn-Regular.woff2") format("woff2");  font-weight: 400; font-display: swap; }
@font-face { font-family: Vazirmatn; src: url("/fonts/Vazirmatn-Medium.woff2") format("woff2");   font-weight: 500; font-display: swap; }
@font-face { font-family: Vazirmatn; src: url("/fonts/Vazirmatn-SemiBold.woff2") format("woff2"); font-weight: 600; font-display: swap; }
@font-face { font-family: Vazirmatn; src: url("/fonts/Vazirmatn-Bold.woff2") format("woff2");     font-weight: 700; font-display: swap; }
@font-face { font-family: Estedad;   src: url("/fonts/Estedad-Bold.woff2") format("woff2");       font-weight: 700; font-display: swap; }
@font-face { font-family: Estedad;   src: url("/fonts/Estedad-ExtraBold.woff2") format("woff2");  font-weight: 800; font-display: swap; }

@theme {
  --font-sans: Vazirmatn, system-ui, sans-serif;
  --font-display: Estedad, Vazirmatn, sans-serif;

  --color-paper: #F1F3F6;
  --color-surface: #FFFFFF;
  --color-ink: #14181F;
  --color-ink-muted: #5C6573;
  --color-ink-faint: #8B93A1;
  --color-hairline: #E2E6EC;
  --color-hairline-strong: #C4CCD8;

  --color-lapis: #23459B;
  --color-lapis-pressed: #16307A;
  --color-lapis-tint: #EDF1FA;

  --color-positive: #0E6B4F;
  --color-positive-tint: #E7F2EE;
  --color-negative: #AD2E24;
  --color-negative-tint: #FBEBE9;

  --color-guess: #8A5A00;
  --color-guess-text: #6E4700;
  --color-guess-tint: #FDF4DE;
  --color-guess-border: #EFDFB4;

  --color-chart-1: #23459B;
  --color-chart-2: #3E5CB2;
  --color-chart-3: #6280C8;
  --color-chart-4: #93A8DC;
  --color-chart-5: #C2CDEB;
  --color-chart-other: #C9CDD4;

  --radius-card: 14px;
  --radius-control: 10px;

  --shadow-float: 0 1px 2px rgb(20 24 31 / .04), 0 8px 24px -14px rgb(20 24 31 / .16);
  --shadow-fab: 0 8px 24px -10px rgb(35 69 155 / .7);

  --text-display-xl: 40px;
  --text-display-xl--line-height: 44px;
  --text-display-l: 28px;
  --text-display-l--line-height: 34px;
  --text-num-l: 24px;
  --text-num-l--line-height: 28px;
  --text-title: 19px;
  --text-title--line-height: 26px;
  --text-body: 15px;
  --text-body--line-height: 24px;
  --text-label: 13px;
  --text-label--line-height: 18px;
  --text-caption: 12px;
  --text-caption--line-height: 16px;
  --text-micro: 11px;
  --text-micro--line-height: 14px;
}

:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 2px; }
::selection { background: #D6E0F5; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

```tsx
// components/money.tsx — تنها مسیر مجاز نمایش پول
export function Money({ minor, currency, signed = false }: { minor: number; currency: string; signed?: boolean }) {
  const text = formatMoney(minor, currency, { signed }); // از lib/money.ts
  return (
    <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="tabular-nums">
      {text}
    </span>
  );
}
```

```tsx
// الگوی نوار اطمینان
<span
  className={cn(
    "w-fit pb-[2px] border-b-2",
    isGuess ? "border-dashed border-guess text-guess-text" : "border-solid border-ink"
  )}
  aria-describedby={isGuess ? `${field}-guess-note` : undefined}
>
  {value}
</span>
{isGuess && (
  <span id={`${field}-guess-note`} className="rounded-full bg-guess-tint px-[9px] text-caption font-semibold text-guess">
    حدس زدم
  </span>
)}
```

**RTL:** `dir="rtl"` روی `<html>`، فقط منطقی‌ها (`ms-*`/`me-*`/`ps-*`/`pe-*`/`border-s`/`border-e`)، هیچ `ml-*`/`mr-*`. روی Radix (Dropdown/Popover/Select/Sheet) صریحاً `dir` بده.
