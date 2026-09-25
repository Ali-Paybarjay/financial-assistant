# آیکون اپ — دستیار مالی

## ایده

همان دستور بصری محصول، در کوچک‌ترین اندازهٔ ممکن: **دو خط ممتد و یک خط در مداد**. دو سطر سفیدِ ثبت‌شده، و سطر سومی که هنوز خط‌چین و برنجی است — همان «حدس زدم» که در کل اپ معنا دارد. زمینه نیلِ فارسی (`#302c73`) با یک گرادیان ملایم و درخششی از بالا-راست، چون خواندن از راست شروع می‌شود.

بدون حرف، بدون علامت ارز، بدون نمودار: هیچ‌کدام در ۲۸px خوانده نمی‌شوند و هر اپ مالی دیگری هم همان‌ها را دارد. این سه سطر، در ۲۸px هم هنوز «یک دفتر با یک سطر ناتمام» است.

## فایل‌ها

| فایل | اندازه | مقصد در ریپو |
|---|---|---|
| `icon-512.png` | ۵۱۲×۵۱۲ | `public/icon-512.png` |
| `icon-192.png` | ۱۹۲×۱۹۲ | `public/icon-192.png` |
| `icon-maskable.png` | ۵۱۲×۵۱۲ با حاشیهٔ امن ۳۰٪ | `public/icon-maskable.png` |
| `apple-icon.png` | ۱۸۰×۱۸۰ | `public/apple-icon.png` |
| `icon.svg` | برداری | منبع — برای تولید دوباره یا favicon |
| `preview.png` | — | فقط پیش‌نمایش؛ کپی نکن |

`app/favicon.ico` را از `icon.svg` بساز (۳۲ و ۱۶).

## بازتولید

`scripts/make-icons.mjs` ریپو را طوری به‌روز کن که ورودی‌اش `icon.svg` باشد؛ مقادیر حاشیه: ۲۱.۵٪ برای آیکون‌های معمولی، ۳۰٪ برای maskable (تا در ماسک دایره‌ای اندروید بریده نشود)، ۲۰٪ برای اپل.

## manifest

در `app/manifest.ts` هر چهار فایل معرفی شوند و `purpose` درست باشد:

```ts
icons: [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
],
background_color: "#302c73",
theme_color: "#edecf2",
```

`background_color` نیل است (صفحهٔ splash هنگام باز شدن)، ولی `theme_color` رنگ نوار مرورگر است و باید با تم فعال بخواند — در `app/layout.tsx`:

```html
<meta name="theme-color" content="#edecf2" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#101120" media="(prefers-color-scheme: dark)" />
```
