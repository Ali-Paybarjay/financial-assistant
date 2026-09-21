import { z } from "zod";
import { CURRENCIES } from "@/lib/money";

/** Amounts travel as the raw string the user typed; lib/money parses them. */
const amountText = z.string().trim().min(1, "مبلغ را بنویس");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را انتخاب کن");

/**
 * Which of the user's own accounts this movement touched.
 *
 * "" is a real answer everywhere it appears here, and the common one: the
 * money was somebody else's, or it was cash from a pocket nobody is tracking.
 * Only when it names an account does the row reach the personal ledger.
 */
const optionalAccountId = z.union([z.string().uuid(), z.literal("")]).optional();

/* ------------------------------------------------------------- the group -- */

export const dongGroupFormSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "اسم دوره را بنویس").max(80),
  /**
   * Picked per group rather than taken from the profile: the usual reason to
   * open one of these is a trip, and a trip is usually in another currency.
   */
  currency: z.enum(CURRENCIES),
  /**
   * The account this trip is run out of. Asked once, at the start, because
   * that is when the user knows the answer — «این سفر را با کارت ملت حساب
   * می‌کنم» — and because answering it once is what keeps every purchase
   * afterwards to a single tap.
   */
  accountId: optionalAccountId,
  startedOn: isoDate,
  note: z.string().trim().max(500).optional(),
});

export type DongGroupForm = z.infer<typeof dongGroupFormSchema>;

/* ------------------------------------------------------------ the people -- */

export const dongMemberFormSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid(),
  name: z.string().trim().min(1, "اسم را بنویس").max(40),
  /** At most one member per group is the viewer, and at most one is the kitty. */
  isMe: z.boolean(),
});

export type DongMemberForm = z.infer<typeof dongMemberFormSchema>;

/* ----------------------------------------------------------- the expense -- */

export const SPLIT_MODE_OPTIONS = [
  { value: "equal", label: "مساوی" },
  { value: "shares", label: "سهمی" },
  { value: "exact", label: "دستی" },
] as const;

export type SplitModeValue = (typeof SPLIT_MODE_OPTIONS)[number]["value"];

export const SPLIT_MODE_HINT: Record<SplitModeValue, string> = {
  equal: "مبلغ به‌طور مساوی بین کسانی که تیک خورده‌اند پخش می‌شود.",
  shares: "هرکس به‌اندازه‌ی سهمش می‌پردازد — مثلاً کسی که مهمان آورده، دو سهم.",
  exact: "مبلغ هر نفر را خودت می‌نویسی؛ جمعشان باید دقیقاً مبلغ خرید شود.",
};

/**
 * The tags the form offers. Free text underneath, so a group can invent its
 * own, but a suggested list is what stops the same idea being spelled three
 * ways and splintering the report's breakdown.
 */
export const DONG_TAG_OPTIONS = [
  "خوراک",
  "رستوران",
  "اقامت",
  "حمل‌ونقل",
  "خودرو",
  "سرگرمی",
  "خرید",
  "سلامت",
  "سایر",
] as const;

/** One person's place in a split, as the form holds it. */
export const dongShareInputSchema = z.object({
  memberId: z.string().uuid(),
  /** Whether this member is on the expense at all. */
  included: z.boolean(),
  /** Weight under 'shares'. Ignored by the other modes. */
  units: z.number().int().min(1).max(99),
  /** The typed amount under 'exact'. Ignored by the other modes. */
  amount: z.string().trim(),
});

export const dongExpenseFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    groupId: z.string().uuid(),
    title: z.string().trim().min(1, "عنوان خرید را بنویس").max(80),
    amount: amountText,
    paidBy: z.string().uuid("بگو چه کسی پرداخت کرده"),
    /** Ignored unless the payer is the viewer: only their own money moves. */
    accountId: optionalAccountId,
    occurredOn: isoDate,
    tag: z.string().trim().max(40).optional(),
    note: z.string().trim().max(500).optional(),
    splitMode: z.enum(SPLIT_MODE_OPTIONS.map((option) => option.value)),
    shares: z.array(dongShareInputSchema).min(1),
  })
  .superRefine((value, context) => {
    // An expense nobody consumed has no shares to cover it, and the database
    // would refuse it at commit with a message meant for us, not the user.
    if (!value.shares.some((share) => share.included)) {
      context.addIssue({
        code: "custom",
        path: ["shares"],
        message: "دست‌کم یک نفر باید در این خرید سهیم باشد.",
      });
    }
  });

export type DongExpenseForm = z.infer<typeof dongExpenseFormSchema>;
export type DongShareInput = z.infer<typeof dongShareInputSchema>;

/* ----------------------------------------------------------- the payment -- */

export const PAYMENT_KIND_OPTIONS = [
  { value: "settle", label: "تسویه" },
  { value: "loan", label: "قرض" },
  { value: "deposit", label: "بیعانه" },
] as const;

export type PaymentKindValue = (typeof PAYMENT_KIND_OPTIONS)[number]["value"];

export const PAYMENT_KIND_LABEL = new Map<string, string>(
  PAYMENT_KIND_OPTIONS.map((option) => [option.value, option.label]),
);

export const PAYMENT_KIND_HINT: Record<PaymentKindValue, string> = {
  settle: "صاف‌کردن حساب — کسی بدهی‌اش را می‌دهد.",
  loan: "قرض وسط راه، که در تراز طرفین حساب می‌شود.",
  deposit: "ریختن پول به صندوق دوره، پیش از خرج‌کردنش.",
};

export const dongPaymentFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    groupId: z.string().uuid(),
    fromMemberId: z.string().uuid("بگو از چه کسی"),
    toMemberId: z.string().uuid("بگو به چه کسی"),
    amount: amountText,
    kind: z.enum(PAYMENT_KIND_OPTIONS.map((option) => option.value)),
    /** Ignored unless one end of the payment is the viewer. */
    accountId: optionalAccountId,
    occurredOn: isoDate,
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.fromMemberId && value.fromMemberId === value.toMemberId) {
      context.addIssue({
        code: "custom",
        path: ["toMemberId"],
        message: "پرداخت به خود، چیزی را جابه‌جا نمی‌کند.",
      });
    }
  });

export type DongPaymentForm = z.infer<typeof dongPaymentFormSchema>;
