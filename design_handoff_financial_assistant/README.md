# Handoff: دستیار مالی — Visual Design System & Screen Specs

## Overview
Visual design for **«دستیار مالی»** (Dastyar-e Mali), a personal-finance web app for Persian speakers living outside Iran. This package covers the design-token system and seven screen specs: dashboard (filled + empty), the four-tab transaction-entry modal, one onboarding step, the transactions list, recurring expenses, settings, and the desktop dashboard layout.

It is the design half of the project described in `BRIEF.md` / `financial-assistant-claude-code-prompt.md`. It answers the "design token system" and "عنصر امضا" requirements of that brief, and is meant to be pasted into `PLAN.md` — see **`PLAN-design-tokens.md`** in this folder for the ready-to-paste Persian version plus a Tailwind v4 `@theme` block.

## About the Design Files
`design/Financial Assistant - Design System.dc.html` is a **design reference created in HTML** — a prototype that shows the intended look, spacing and behavior. It is **not production code to copy**. It is a single document containing all specs and mockups side by side, not a runnable app.

The task is to **recreate these designs in the target codebase** (Next.js 15 App Router + Tailwind CSS v4 + shadcn/ui, RTL-configured, per the project brief) using that stack's established patterns. Do not port the HTML, the inline styles, or the document layout.

To view it: open the `design/` folder in a static server (`npx serve design`) and open the HTML file — it needs `support.js` (included) as a sibling. It also references `_ds/nocturne-…/styles.css`, which is **not** part of this design and is not included; the 404 is harmless, or you can delete that one `<link>` line.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, iconography and copy. Recreate pixel-for-pixel using the codebase's libraries. Two caveats:
- Mockups are static compositions at 375px (mobile) and 1280px (desktop). Intermediate widths are not drawn; the responsive rule is stated under *Responsive behavior*.
- Charts are drawn with CSS (`conic-gradient`, flex bars) to specify **appearance only**. Implement them in Recharts per the project's stack.

---

## Design Tokens

### Color

| Token | Hex | Role |
|---|---|---|
| `paper` | `#F1F3F6` | page background (cool grey, never warm cream) |
| `surface` | `#FFFFFF` | cards, sheets, list containers |
| `ink` | `#14181F` | primary text (near-black with a blue cast) |
| `ink-muted` | `#5C6573` | labels, captions, metadata — 5.1:1 on white |
| `ink-faint` | `#8B93A1` | placeholders, disabled glyphs (never body text) |
| `hairline` | `#E2E6EC` | 1px dividers and card borders |
| `hairline-strong` | `#C4CCD8` | secondary-button border, radio ring |
| `lapis` (brand) | `#23459B` | primary action, links, chart series 1 |
| `lapis-pressed` | `#16307A` | pressed state of primary |
| `lapis-tint` | `#EDF1FA` | brand tints: avatar, active nav, progress track |
| `positive` | `#0E6B4F` | positive balance / income — 5.3:1 on white |
| `positive-tint` | `#E7F2EE` | positive surface |
| `negative` | `#AD2E24` | negative balance, destructive actions — 5.2:1 on white |
| `negative-tint` | `#FBEBE9` | negative surface |
| `guess` | `#8A5A00` | AI-guessed values (brass) |
| `guess-text` | `#6E4700` | body text inside guess surfaces |
| `guess-tint` | `#FDF4DE` | guess surface |
| `guess-border` | `#EFDFB4` | guess surface border |

**Chart ramp** (single hue, never rainbow): `#23459B` → `#3E5CB2` → `#6280C8` → `#93A8DC` → `#C2CDEB`, and `#C9CDD4` reserved for the "سایر / Other" bucket. Ordered by share; distinguishable in greyscale because separation is by lightness, not hue.

Rules: color only carries meaning where it *is* the message (sign of balance, goal state, guessed-vs-confirmed). Never color alone — `+`/`−` signs and words accompany it. Light mode only for the MVP.

### Typography

Body: **Vazirmatn** (400/500/600/700). Display: **Estedad** (700/800). Both SIL-licensed and **self-hosted** — woff2 files included in `fonts/webfonts/`. No Google Fonts or other CDN (users may be on sanctioned networks). Estedad was chosen over the brief's suggested Morabba because Morabba is commercially licensed, which would trade the self-host constraint for a licensing one.

Estedad appears in exactly three places: the month-balance number, onboarding step titles, empty-state titles.

| Token | Font / weight | Size / line-height | Use |
|---|---|---|---|
| `display-xl` | Estedad 800 | 40 / 44–48 | the month balance only |
| `display-l` | Estedad 700 | 28 / 34–36 | onboarding step + empty-state titles |
| `num-l` | Vazirmatn 600 | 24 / 28 | KPI card numbers |
| `title` | Vazirmatn 600 | 19 / 26 | screen + card titles |
| `body` | Vazirmatn 400 | 15 / 24 | body copy |
| `label` | Vazirmatn 500 | 13 / 18 | field + card labels |
| `caption` | Vazirmatn 500 | 12 / 16 | row metadata |
| `micro` | Vazirmatn 500/600 | 11 / 14 | tab-bar labels, chart axis, badges |

**Money rule (non-negotiable).** All amounts: Latin digits, thousands separators, `font-variant-numeric: tabular-nums`, and directional isolation — `dir="ltr"` + `unicode-bidi: isolate` — so the currency symbol does not jump when embedded in Persian text. Encapsulate in a `<Money />` component; nothing formats money inline. Dates are the opposite: Persian digits, `fa-IR` with `calendar: gregory` ("۱۶ سپتامبر ۲۰۲۶"), because they are not tabular data.

### Spacing, radius, elevation

- Spacing scale (4px base): `4 · 8 · 12 · 16 · 24 · 32 · 48`.
- Radius: cards `14px`, inputs/buttons `10px`, chips/FAB/pills `999px`, phone-frame `26px`. **Never 0** — a zero-radius hairline "newspaper" look is explicitly forbidden by the brief.
- Borders: `1px solid #E2E6EC`. No 0.5px hairlines.
- One shadow token, used only for floating layers (modal sheet, FAB):
  `0 1px 2px rgba(20,24,31,.04), 0 8px 24px -14px rgba(20,24,31,.16)`
  FAB uses a brand-tinted variant: `0 8px 24px -10px rgba(35,69,155,.7)`.
- Minimum touch target `44px`; list rows and option cards `56px`.

### Motion

Only two transitions exist in the product:
- **180ms ease-out** — the guess→confirmed "settle" (dashed rule becomes solid, 3px upward shift, opacity 0→1).
- **220ms** — modal sheet rise.

Both removed under `prefers-reduced-motion: reduce`.

### Icons

**Phosphor**, weight **Regular**, subset to ~40 glyphs and **self-hosted** (MIT-licensed, so subsetting is permitted). `20px` inline in rows, `22–24px` in the tab bar. The **Fill** weight is used *only* for the active tab-bar / sidebar item. Directional glyphs are mirrored for RTL: `caret-right` = back, `caret-left` = forward.

| Purpose | Glyph | Purpose | Glyph |
|---|---|---|---|
| Dashboard | `house` | Transactions | `list-dashes` |
| Goals | `target` | Settings | `gear` |
| Income | `wallet` | Recurring | `arrows-clockwise` |
| Add | `plus` | Close | `x` |
| Manual form | `keyboard` | Free text | `textbox` |
| Voice | `microphone` | Receipt | `receipt` |
| Camera | `camera` | Search | `magnifying-glass` |
| Filter | `funnel` | Date | `calendar-blank` |
| Edit | `pencil-simple` | Delete | `trash` |
| Undo | `arrow-counter-clockwise` | Confirmed | `check-circle` |
| Error / warning | `warning-circle` | More | `dots-three-vertical` |
| Back (RTL) | `caret-right` | Forward (RTL) | `caret-left` |
| Trend up | `arrow-up` | Trend down | `arrow-down` |
| Profile | `user-circle` | Currency | `coins` |
| Goal note | `flag` | Sign out | `sign-out` |

Seed-category glyphs: خوراک `shopping-cart` · رستوران `fork-knife` · مسکن `house-line` · قبوض `lightning` · حمل‌ونقل `bus` · خودرو `car` · سلامت `heartbeat` · پوشاک `t-shirt` · سرگرمی `ticket` · اشتراک‌ها `repeat` · آموزش `graduation-cap` · هدیه `gift` · بیمه `shield-check` · بازپرداخت وام `hand-coins` · متفرقه `dots-three-circle`.

**There is deliberately no "AI" icon** — no sparkle, no star. An entry's source is shown with the icon of the actual act the user performed (keyboard, text, microphone, receipt).

> ⚠️ The mockup HTML loads Phosphor from `unpkg.com` for preview convenience. **Production must self-host the subset** — the sanctioned-CDN constraint applies.

---

## The Signature Element — «نوار اطمینان» (the confidence rule)

The one thing the app is remembered by, and the element to get right first.

A **2px rule under any value the model produced**:
- **Guessed** — `2px dashed #8A5A00` (brass), plus the word «حدس زدم» as a pill (`#FDF4DE` bg, `#8A5A00` text, `999px`, height 24, 12px/600) or as an inline label above the value.
- **Confirmed** — `2px solid #14181F`, with the 180ms settle animation.

The value keeps `padding-bottom: 2–4px` so the rule clears the descenders. Rationale: in this product, data mostly arrives *as a guess* — three of the four entry methods are model output — so distinguishing "what I said" from "what was understood" is the interface's actual subject. It is not decoration; if it were removed, this palette would have no signature.

It recurs at three levels:
1. **Confirm card** — under each field of a parsed transaction.
2. **Transaction list** — a dashed underline on the merchant of an unconfirmed row, with a brass «تأییدنشده · از فاکتور» caption.
3. **Dashboard** — under the month's expense number when the total includes unconfirmed transactions, plus a brass banner: «۲ تراکنش تأییدنشده در این جمع هست.» with a «بررسی» action.

Accessibility requirement: the rule is never color-only. The word «حدس زدم» / «تأییدنشده» is always present, and the field gets `aria-describedby` pointing at that explanation.

---

## Screens / Views

All mobile screens are specified at **375px** width. Layout is a single column, `16px` horizontal page padding, `10–14px` gaps between cards.

### 1. Dashboard (filled) — `/dashboard`
**Purpose:** answer "how much is left this month" in under 5 seconds.

Layout, top to bottom:
1. **Header** on `surface`, `14px 16px 16px`, bottom `1px` hairline:
   - Month selector: pill `36px` high, `999px`, `paper` bg + hairline border, 13px/600, `caret-right` + label + `caret-left`. Avatar circle `36px`, `lapis-tint` bg, `lapis` initial.
   - Label «مانده‌ی این ماه» (`label`, `ink-muted`).
   - **Balance** in `display-xl`, `positive` when ≥ 0, `negative` when < 0, always signed (`+$1,131.60`).
   - Meta row (12px/500, `ink-muted`): «۱۴ روز تا پایان ماه» · 1px×12px divider · «روزی $80.82».
2. **Three KPI cards** in a `repeat(3,1fr)` grid, `8px` gap, `11px 10px` padding: label 11px/500 muted, value 16px/600 tabular, delta 11px/600 in `positive`/`negative` with `arrow-up`/`arrow-down`. The **expense** value carries the dashed confidence rule when the total includes unconfirmed rows.
3. **Unconfirmed banner** (only when applicable): `guess-tint` bg, `guess-border` border, `10px` radius, `8px 11px`; a 16×2px dashed-gradient mark, 12px/500 `guess-text` copy, trailing «بررسی» in `lapis`.
4. **Donut card**: 118px circle, 23px inset white hole. Segments from the chart ramp separated by 1.6° white gaps; the hole names the largest category and its share («بیشترین / مسکن / 40%»). Legend right of it: 9×9px `2px`-radius swatch, category name, amount (tabular, 500). Top 5 categories + «سایر» in `#C9CDD4`.
5. **Six-month bar card**: two series per month — income solid `lapis`, expense `#C2CDEB` with a `#93A8DC` border (so it survives greyscale). Bars 9px wide, 2px gap, 80px plot height, month labels 10px muted. Legend in the card header.
6. **Goals card**: per goal, name + `saved / target` (tabular 12px muted), then an 8px `999px` track in `lapis-tint` with a `lapis` (or `#6280C8` for secondary) fill.
7. **Recent transactions card**: rows of `34px` rounded-`10px` category icon tile, title 14px/500, caption 11px muted with the source icon, amount 14px/600 tabular (income in `positive`). Unconfirmed rows get the dashed rule + brass caption and a brass icon tile.
8. **FAB + tab bar** (see *Navigation*).

### 2. Transaction entry modal — four tabs
**Purpose:** log a purchase in under 10 seconds.

Bottom sheet over a dimmed dashboard (`rgba(20,24,31,.45)`), `surface`, radius `20px 20px 0 0`, top shadow `0 -10px 30px -18px rgba(20,24,31,.4)`, `14px 16px 20px` padding, a 40×4px `999px` grab handle centered. Title «ثبت تراکنش» (`title`) + `x` in a 32px circle.

**Tab bar:** a 4-up segmented control in a `paper` container (`4px` padding, `12px` radius); the active segment is `surface` with `ink` text, inactive is transparent with `ink-muted`. Order from the right: **فرم · متن · صدا · عکس** (fastest/most certain → slowest).

- **فرم (manual)** — amount field: 52px tall, `lapis` border + `rgba(35,69,155,.18)` 2px ring, `$` prefix and value at 22px/600 tabular. **Use `inputmode="decimal"`, not `type="number"`.** Category as a wrap of 36px chips (`999px`), selected = `lapis`/white. Date (default «امروز») and merchant (optional) side by side, 48px. Primary «ثبت هزینه» 52px. Three required fields, the rest optional.
- **متن (free text)** — the raw sentence in a bordered box, footer «دو تراکنش شناسایی شد» + «دوباره بخوان». Then the **confirm card**: header strip on `paper` with «کارت تأیید» and «تا تأیید نکنی ذخیره نمی‌شود»; one block per parsed transaction with index + title, amount 18px/600 tabular, and a wrapped field list where each field shows its label above the value — confirmed fields get the solid rule, guessed fields get the brass label («دسته · حدس زدم») and the dashed rule. Brass banner: «دو فیلد خط‌چین‌دار را حدس زدم. روی هرکدام بزن تا عوض شود.» Actions: «ثبت دو تراکنش» (primary, counts the transactions) + «انصراف».
- **صدا (voice)** — 18-bar waveform (3px bars, `999px`, heights 10–52px, colored down the chart ramp by amplitude), timer `00:12` at 24px/600 tabular, a 52px `negative` circular stop button with a 16px white square, caption «حداکثر ۶۰ ثانیه. برای توقف بزن.». Below: the transcript box labelled «متنی که شنیدم», the note «متن را پیش از تبدیل نشانت می‌دهم؛ اگر اشتباه شنیدم، اصلاحش کن.», then «تبدیل به تراکنش». The transcript is always shown before parsing.
- **عکس (receipt)** — a 180px dashed drop zone (`C4CCD8` dashed, `paper` bg) with `receipt` glyph and the compression note («تا 1500px و کیفیت 80% فشرده می‌شود»); «دوربین» (primary) + «از گالری» (secondary); then the last-read receipt card with a dashed merchant+date and the total at 18px/600, plus «فقط مبلغ کل را برمی‌دارم، نه تک‌تک آیتم‌ها.»

**Invariant across all three AI methods:** model output is never saved directly. It always renders in the confirm card with every field editable, and is written only on explicit confirm.

### 3. Onboarding step 6 — risk tolerance
`surface` background (no `paper` — onboarding is a full-bleed flow). Header: 40px square back button (`caret-right`, RTL-mirrored) and «گام ۶ از ۷» 13px/600 muted. Progress: **seven 4px segments**, `999px`, `lapis` filled / `hairline` empty — a segmented bar, not a percentage, so the user can see the end. Kicker «ریسک‌پذیری · سؤال ۳ از ۵» 12px/600 `lapis`, tracking `.1em`. Question in `display-l` with `text-wrap: pretty`. Sub-copy «جواب درست و غلط ندارد…» 14px muted — the reason for asking is stated, because these questions look irrelevant.

Four option cards, `12px` radius, `14px` padding, `min-height 56px`, 20px radio ring; selected = `1.5px lapis` border + `lapis-tint` bg + filled dot + 500 weight. Footer pinned with `margin-top:auto`: «سؤال بعدی» (primary 52px), «فعلاً رد کن» (44px ghost, steps 4–7 only), and a `check-circle` reassurance line: «هر گام را همان لحظه ذخیره می‌کنم؛ می‌توانی بعداً ادامه بدهی.»

One question (or one tightly-related group) per screen. Never a 15-field form.

### 4. Dashboard — empty state
Same header, but the balance is `ink` (not `positive`) because it has no "remaining" meaning yet, with the caption «هنوز هیچ هزینه‌ای ثبت نشده — این عدد همان درآمدی است که در ثبت‌نام گفتی.» The forward arrow of the month selector is disabled (`hairline-strong`).

No empty chart and no grey skeletons. Instead: a card with `display-l` title «اولین خریدت را ثبت کن», body «تا یک هزینه ثبت نکنی، نموداری برای نشان‌دادن ندارم. یک قهوه هم کافی است تا شروع شود.», and a 52px primary «اولین هزینه‌ات را ثبت کن» with `plus`. Then «سه راه سریع‌تر از فرم» — three 56px rows (بنویس / بگو / عکس بگیر) each with a `lapis-tint` 36px icon tile and an example. Closing dashed note: «هزینه‌های ثابتی که در ثبت‌نام گفتی، اول ماه خودکار ثبت می‌شوند.»

### 5. Transactions list — `/transactions`
Header on `surface`: title «تراکنش‌ها» + 40px `magnifying-glass` and `funnel` buttons (the filter button is active-styled when filters apply: `lapis` border, `lapis-tint` bg). **Active filters are removable chips** (`lapis` bg, white text, trailing `x`), not a hidden sheet — the user must see why the sum changed. Below them: «۲ نتیجه» and «جمع −$74.40» (the filtered total; without it a filter is a toy).

Body: day groups («امروز · ۱۶ سپتامبر», «دیروز · ۱۵ سپتامبر») as 12px/600 muted headings above a `surface` card of rows. Rows: 34px category tile, title, caption with source icon, amount. Unconfirmed rows add the dashed rule, a brass caption, and a «بررسی ‹» affordance under the amount. Soft-delete shows an **inline undo row** in the same card (`paper` bg): «"اجاره‌ی سپتامبر" حذف شد.» + a «برگردان» pill with `arrow-counter-clockwise`, for 5 seconds — not a corner toast. Footer hint: inline editing by tapping the amount or category.

### 6. Income & recurring — `/income` + `/recurring`
One screen, a 2-up segmented control («درآمد» `wallet` / «هزینه‌ی ثابت» `arrows-clockwise`) — the row structure is identical, so two separate routes are not worth the split. Header has a 40px back button and the title.

Above the list: «۴ ردیف فعال» and «ماهی $1,712.00» — the number the user actually came for. Rows in one `surface` card: 34px `lapis-tint` icon tile, title, meta «ماهانه · روز ۱ · خودکار», amount, and a **40×22px toggle** (`999px`, `lapis` on / `hairline-strong` off, 16px white knob). Inactive rows stay visible at **55% opacity** with «غیرفعال از اوت» — deactivating must not erase history. Dashed note with `check-circle`: «ردیف‌های "خودکار" اول هر ماه یک‌بار ثبت می‌شوند — دو بار اجرا شدن، تراکنش تکراری نمی‌سازد.» (the idempotency guarantee is surfaced in the UI on purpose). Secondary outlined «افزودن هزینه‌ی ثابت» 52px.

### 7. Settings — `/settings`
Profile header row: 48px avatar, name 17px/600, «تورنتو، کانادا · CAD · متعادل» 12px muted, trailing `caret-left`.

Three groups, each a 12px/600 muted heading above a `surface` card of 56px rows (icon `20px` `lapis`, label, optional value in muted, `caret-left` in `ink-faint`):
- **پول** — منابع درآمد · هزینه‌های ثابت · دسته‌ها · ارز پایه. The currency row carries the warning **inline and before the tap**, in a `guess-tint` box with `warning-circle`: «مبالغ قبلی تبدیل نمی‌شوند و با ارز قدیم می‌مانند.»
- **پروفایل** — نام/کشور/سال تولد · پاسخ دوباره به سؤال‌های ریسک.
- **حساب** — خروج از حساب (`sign-out`, muted) · حذف حساب (`trash`, `negative` icon **and** label). Caption: deletion is irreversible and requires typing the account name. This is the only place `negative` appears in settings.

### 8. Desktop dashboard — ≥960px
One breakpoint, not three. Below 960px it is the mobile layout with the tab bar. From 960px:
- The tab bar becomes a **232px sidebar on the right** (RTL reading origin). In the mockup it is `<aside>` before `<main>` in a `direction: rtl` flex row with **no `order` overrides** — in RTL flex, lower `order` goes to the right, so any `order` inverts the intent. Sidebar: brand mark (9px `lapis` dot + Estedad 700 17px), 44px nav rows (`10px` radius, active = `lapis-tint` + `lapis` + Fill glyph), and a bottom user row above a hairline. Income and Recurring are promoted into the sidebar here (on mobile they live under Settings).
- The **FAB disappears**; the primary action moves into the header as a 44px `lapis` button next to a secondary «فیلتر». A floating button on desktop hides something that has room.
- Content: `24px 28px` padding, `max-width: 1120px`, then centered — financial figures gain nothing from stretching.
- Grid: `1.35fr 1fr 1fr 1fr` for balance + three KPIs; then the unconfirmed banner full width; then `1fr 1.25fr` twice (donut | bars, goals | recent). Donut grows to 132px; bars to 18px wide / 124px plot. Amounts in the recent list are right-aligned in a `min-width: 92px` column — the only thing desktop adds to mobile.
- **Type sizes do not change.** More space is not bigger text.

---

## Interactions & Behavior

- **Guess → confirmed:** tapping a dashed field opens its editor; confirming swaps the dashed rule for the solid one with the 180ms settle and shows a «تأیید شد» pill (`positive-tint`/`positive`).
- **Modal:** rises 220ms, traps focus, and returns focus to the FAB (or header button) on close.
- **Submitting buttons** lock and change their label («دارم ثبت می‌کنم…») so a second click cannot create a duplicate transaction. Also «دارم متن را می‌خوانم…» / «دارم فاکتور را می‌خوانم…».
- **Soft delete** shows the inline undo row for 5 seconds.
- **Focus:** every interactive element gets `outline: 2px solid #23459B; outline-offset: 2px` on `:focus-visible`. Never the browser default.
- **Hover** (desktop): secondary buttons go to `lapis-tint` bg + `lapis` border and text; nav rows to `lapis-tint`.
- **Pressed:** primary → `#16307A`.
- **Disabled:** 45% opacity.
- **Loading:** each async operation needs loading / error / empty states. Never an empty chart — show the CTA.
- **Reduced motion:** both transitions are disabled.

### Responsive behavior
375px is the floor and must not break. Single breakpoint at **960px** (see screen 8). No layout change between 375 and 960 other than natural fluidity; nothing uses fixed widths that would overflow 375px.

### Accessibility floor
AA contrast (values above are measured), visible keyboard focus, `prefers-reduced-motion`, 44px minimum targets, and color never as the sole carrier of meaning (signs, words, icons accompany it). **Open item:** the donut needs a numeric equivalent for screen readers — a visually-hidden table or an `aria-label` listing each category's share. This is implementation work in M5, not a design decision.

---

## State Management

Design-relevant state only (the data model lives in the project brief):

- `selectedMonth` — drives the whole dashboard; defaults to the current month **in the user's timezone**, not UTC.
- `entryModal: { open, tab: 'form'|'text'|'voice'|'receipt' }` — tab resets to `form` on open unless the user last used another method.
- `parseResult: { transactions[], needs_review[] }` — `needs_review` is exactly what drives the dashed rule; the UI must read it per field, not per transaction.
- `perTransactionConfirmations` — which guessed fields the user has accepted, for the settle animation.
- `recording: { active, elapsedMs, transcript }` — 60s cap.
- `filters: { month, categoryIds[], type, unconfirmedOnly, query }` — every active filter must be renderable as a removable chip, and the filtered sum recomputed alongside.
- `pendingDelete: { id, expiresAt }` — 5s undo window.
- `onboarding: { step, answers }` — persisted server-side after **each** step.

Server data via TanStack Query; invalidate the dashboard's month query after any transaction mutation, otherwise the user sees a stale total and logs the purchase twice.

---

## UI Copy (exact, Persian)

Voice: second-person singular to the user, first-person for the app («حدس زدم»، «نشانت می‌دهم») — because three of four entry paths are a guessing agent, and an agent without a voice leaves its errors unowned.

**Buttons — use:** ثبت هزینه · ثبت دو تراکنش · سؤال بعدی · تبدیل به تراکنش · فعلاً رد کن · اولین هزینه‌ات را ثبت کن · افزودن هزینه‌ی ثابت · برگردان · بررسی
**Buttons — avoid:** ارسال · تأیید و ادامه · ذخیره‌سازی اطلاعات · مرحله‌ی بعد · بستن پنجره

**Errors** (what happened + what to do; no apology, no «خطایی رخ داد»):
- «مبلغی در متن پیدا نکردم. عدد و ارز را بنویس، مثل "۴۵ دلار قهوه".» — amounts are never guessed.
- «فاکتور خوانا نبود. از مبلغ کل عکس بگیر یا مبلغ را دستی بزن.»
- «امروز به سقف ۵۰ پردازش هوشمند رسیدی. تا فردا با فرم ثبت کن.»
- «اتصال قطع شد. تراکنش را نگه داشتم؛ دوباره بزن "ثبت".»

**Empty states:**
- Dashboard: «اولین خریدت را ثبت کن — تا یک هزینه ثبت نکنی، نموداری برای نشان‌دادن ندارم.»
- Filtered list: «در این بازه چیزی ثبت نشده. بازه را عوض کن یا فیلتر را بردار.»
- Goals: «هنوز هدفی نداری. یک هدف بساز تا بگویم ماهی چقدر باید بگذاری کنار.»
- Future month: «این ماه هنوز نرسیده.»

**Confirmations:**
- After saving: «ثبت شد. $1,069.20 برایت مانده.» — the confirmation always states the new balance, because that is what the user came to learn.
- Delete: «حذف شد.» + «برگردان» for 5s.
- Currency change: «مبالغ قبلی تبدیل نمی‌شوند و با ارز قدیم می‌مانند. مطمئنی؟»
- End of onboarding: «این تصویر مالی توست.»

---

## Assets

- `fonts/webfonts/Vazirmatn-{Regular,Medium,SemiBold,Bold}.woff2` — from `rastikerdar/vazirmatn@v33.003`, SIL OFL 1.1.
- `fonts/webfonts/Estedad-{Bold,ExtraBold}.woff2` — from `aminabedi68/Estedad@master`, SIL OFL 1.1.
- Icons: **Phosphor** (MIT) — not bundled here; install `@phosphor-icons/react` or self-host a subsetted font. Do not load it from a CDN in production.
- No photography or illustration is used anywhere in this design.

## Files

- `design/Financial Assistant - Design System.dc.html` — the full design document: tokens, type scale, signature element with its self-critique, all seven mockups, icon set, UI copy.
- `design/support.js` — runtime required to open that HTML locally.
- `screenshots/` — 2× PNG renders of every mockup, for reference without opening the HTML:
  `01-dashboard` · `02-entry-modal` · `03-onboarding-risk` · `04-dashboard-empty` · `05-transactions` · `06-recurring` · `07-settings` · `08-desktop-dashboard`.
  The mobile shots are full-screen content at 375px logical width (taller than a device viewport — the screens scroll).
- `PLAN-design-tokens.md` — the Persian, paste-ready version of the token system for the project's `PLAN.md`, plus a Tailwind v4 `@theme` block and the `@font-face` rules.
- `fonts/webfonts/*.woff2` — the self-hosted typefaces.

## Out of scope
Dark mode (light only in the MVP — but the palette is ramp-derived, so inverting later is a day's work, not a redesign). No mockups for `/goals`, auth forms, or onboarding steps 1–5 and 7: they are all assembled from the patterns above (card, list row, segmented control, single-question step).
