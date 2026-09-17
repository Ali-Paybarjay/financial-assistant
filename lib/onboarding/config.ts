import { CURRENCIES } from "@/lib/money";

export const TOTAL_STEPS = 7;

export type StepMeta = {
  step: number;
  kicker: string;
  title: string;
  subtitle?: string;
  /** Steps 4–7 may be postponed; 1–3 carry the numbers the dashboard needs. */
  skippable: boolean;
};

export const STEPS: StepMeta[] = [
  {
    step: 1,
    kicker: "آشنایی",
    title: "بگو کی هستی و کجا زندگی می‌کنی",
    subtitle: "ارز و تاریخ را بر همین اساس تنظیم می‌کنم.",
    skippable: false,
  },
  {
    step: 2,
    kicker: "درآمد",
    title: "ماهی چقدر درآمد داری؟",
    subtitle: "بدون این عدد نمی‌توانم بگویم چقدر برایت می‌ماند.",
    skippable: false,
  },
  {
    step: 3,
    kicker: "هزینه‌های ثابت",
    title: "هر ماه چه چیزهایی حتماً از حسابت می‌رود؟",
    subtitle: "اینها را اول هر ماه خودکار ثبت می‌کنم تا تو درگیرشان نباشی.",
    skippable: false,
  },
  {
    step: 4,
    kicker: "هزینه‌های متغیر",
    title: "ماهی حدوداً چقدر خرج این‌ها می‌کنی؟",
    subtitle: "حدس بزن. بعداً از روی خریدهای واقعی‌ات دقیقش می‌کنم.",
    skippable: true,
  },
  {
    step: 5,
    kicker: "اهداف",
    title: "برای چه چیزی پول کنار می‌گذاری؟",
    subtitle: "یک هدف کافی است تا بگویم ماهی چقدر باید بگذاری کنار.",
    skippable: true,
  },
  {
    step: 6,
    kicker: "ریسک‌پذیری",
    title: "اگر این اتفاق بیفتد، چه می‌کنی؟",
    subtitle: "جواب درست و غلط ندارد؛ فقط می‌خواهم بدانم با نوسان چطور کنار می‌آیی.",
    skippable: true,
  },
  {
    step: 7,
    kicker: "وضعیت فعلی",
    title: "الان کجای کار هستی؟",
    subtitle: "این سه عدد تصویر مالی‌ات را کامل می‌کند.",
    skippable: true,
  },
];

export function stepMeta(step: number): StepMeta | undefined {
  return STEPS.find((entry) => entry.step === step);
}

/** Where the audience actually lives, most likely first. */
export const COUNTRIES = [
  { code: "IR", flag: "🇮🇷", name: "ایران", currency: "IRT" },
  { code: "CA", flag: "🇨🇦", name: "کانادا", currency: "CAD" },
  { code: "US", flag: "🇺🇸", name: "آمریکا", currency: "USD" },
  { code: "GB", flag: "🇬🇧", name: "بریتانیا", currency: "GBP" },
  { code: "DE", flag: "🇩🇪", name: "آلمان", currency: "EUR" },
  { code: "NL", flag: "🇳🇱", name: "هلند", currency: "EUR" },
  { code: "FR", flag: "🇫🇷", name: "فرانسه", currency: "EUR" },
  { code: "SE", flag: "🇸🇪", name: "سوئد", currency: "SEK" },
  { code: "AU", flag: "🇦🇺", name: "استرالیا", currency: "AUD" },
  { code: "AT", flag: "🇦🇹", name: "اتریش", currency: "EUR" },
  { code: "BE", flag: "🇧🇪", name: "بلژیک", currency: "EUR" },
  { code: "ES", flag: "🇪🇸", name: "اسپانیا", currency: "EUR" },
  { code: "IT", flag: "🇮🇹", name: "ایتالیا", currency: "EUR" },
] as const;

export const CURRENCY_LABELS: Record<(typeof CURRENCIES)[number], string> = {
  CAD: "دلار کانادا",
  USD: "دلار آمریکا",
  EUR: "یورو",
  GBP: "پوند",
  AUD: "دلار استرالیا",
  SEK: "کرون سوئد",
  IRT: "تومان",
  IRR: "ریال",
};

/**
 * A plausible monthly income, only as a hint at the order of magnitude. A
 * placeholder of "4500" in front of someone who earns tomans reads as a
 * misunderstanding of the question.
 */
export const INCOME_PLACEHOLDER: Record<(typeof CURRENCIES)[number], string> = {
  CAD: "4500",
  USD: "4500",
  EUR: "4000",
  GBP: "3500",
  AUD: "5500",
  SEK: "38000",
  IRT: "35000000",
  IRR: "350000000",
};

export const EMPLOYMENT_OPTIONS = [
  { value: "employed", label: "کارمند" },
  { value: "self_employed", label: "خویش‌فرما یا فریلنسر" },
  { value: "student", label: "دانشجو" },
  { value: "retired", label: "بازنشسته" },
  { value: "unemployed", label: "فعلاً بی‌کار" },
  { value: "other", label: "چیز دیگر" },
] as const;

export const INCOME_TYPE_OPTIONS = [
  { value: "salary", label: "حقوق" },
  { value: "freelance", label: "فریلنس" },
  { value: "business", label: "کسب‌وکار" },
  { value: "investment", label: "سرمایه‌گذاری" },
  { value: "rental", label: "اجاره" },
  { value: "pension", label: "مستمری" },
  { value: "other", label: "سایر" },
] as const;

export const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "ماهانه" },
  { value: "biweekly", label: "هر دو هفته" },
  { value: "weekly", label: "هفتگی" },
  { value: "yearly", label: "سالانه" },
  { value: "one_time", label: "یک‌بار" },
] as const;

/** Tap a chip and it becomes a row with an amount field. */
export const RECURRING_SUGGESTIONS = [
  { title: "اجاره", slug: "housing", dueDay: 1 },
  { title: "قبوض", slug: "utilities", dueDay: 10 },
  { title: "اینترنت", slug: "utilities", dueDay: 5 },
  { title: "موبایل", slug: "utilities", dueDay: 5 },
  { title: "بیمه", slug: "insurance", dueDay: 1 },
  { title: "وام", slug: "loan-repay", dueDay: 1 },
  { title: "اشتراک‌ها", slug: "subscriptions", dueDay: 15 },
  { title: "حمل‌ونقل", slug: "transport", dueDay: 1 },
] as const;

/** The five categories that move most month to month. */
export const VARIABLE_BASELINE_SLUGS = [
  "groceries",
  "dining",
  "transport",
  "entertainment",
  "clothing",
] as const;

export const GOAL_TYPE_OPTIONS = [
  { value: "emergency_fund", label: "صندوق اضطراری" },
  { value: "home", label: "خانه" },
  { value: "travel", label: "سفر" },
  { value: "debt_payoff", label: "تسویه‌ی بدهی" },
  { value: "education", label: "آموزش" },
  { value: "investment", label: "سرمایه‌گذاری" },
  { value: "other", label: "چیز دیگر" },
] as const;

export type RiskQuestion = {
  id: string;
  prompt: string;
  /** Options are ordered least to most risk-tolerant; index + 1 is the score. */
  options: string[];
};

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: "drawdown",
    prompt: "سرمایه‌ات در یک ماه ۲۰٪ افت می‌کند. چه می‌کنی؟",
    options: [
      "همه را می‌فروشم تا بیشتر از این ضرر نکنم",
      "بخشی را می‌فروشم و بقیه را نگه می‌دارم",
      "دست نمی‌زنم و صبر می‌کنم برگردد",
      "بیشتر می‌خرم، چون ارزان شده",
    ],
  },
  {
    id: "windfall",
    prompt: "ناگهان معادل شش ماه حقوقت به دستت می‌رسد. کجا می‌گذاری‌اش؟",
    options: [
      "حساب پس‌انداز با سود تضمینی",
      "بیشترش پس‌انداز، کمی سرمایه‌گذاری",
      "نصف‌نصف بین پس‌انداز و بازار",
      "بیشترش را سرمایه‌گذاری می‌کنم",
    ],
  },
  {
    id: "job_loss",
    prompt: "اگر همین فردا درآمدت قطع شود، چند ماه دوام می‌آوری؟",
    options: [
      "کمتر از یک ماه",
      "یک تا سه ماه",
      "سه تا شش ماه",
      "بیشتر از شش ماه",
    ],
  },
  {
    id: "horizon",
    prompt: "پولی که کنار می‌گذاری را کِی لازم داری؟",
    options: [
      "همین امسال",
      "یکی دو سال دیگر",
      "سه تا پنج سال دیگر",
      "بیشتر از پنج سال دیگر",
    ],
  },
  {
    id: "comfort",
    prompt: "کدام جمله بیشتر شبیه توست؟",
    options: [
      "ترجیح می‌دهم سود کم بگیرم ولی خوابم راحت باشد",
      "کمی نوسان را تحمل می‌کنم",
      "برای سود بیشتر، نوسان را می‌پذیرم",
      "نوسان برایم مسئله نیست، بازده مهم است",
    ],
  },
];

/** Five answers of 1–4 map onto the 1–10 scale the profile stores. */
export function scoreRisk(answers: number[]): { score: number; label: string } {
  const raw = answers.reduce((total, value) => total + value, 0); // 5..20
  const score = Math.max(1, Math.min(10, Math.round(((raw - 5) / 15) * 9 + 1)));
  const label = score <= 3 ? "conservative" : score <= 7 ? "balanced" : "growth";
  return { score, label };
}

export const RISK_LABELS: Record<string, string> = {
  conservative: "محافظه‌کار",
  balanced: "متعادل",
  growth: "رشدمحور",
};
