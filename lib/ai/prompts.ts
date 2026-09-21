import { minorExponent, type CurrencyCode } from "@/lib/money";
import type { CategoryRow } from "@/lib/supabase/database.types";

export type PromptContext = {
  currency: CurrencyCode;
  /** The user's today, in their timezone — relative dates resolve against it. */
  today: string;
  categories: CategoryRow[];
};

/**
 * The two categories «دنگ و دونگ» writes for itself, by trigger — see
 * migration 0017. They are left out of every prompt: the model cannot know
 * whether a receipt was a shared bill, and a row filed there with no group
 * behind it is a wedge on the dashboard's donut that points at nothing.
 */
const APP_OWNED_SLUGS = new Set(["dong", "dong-refund"]);

function categoryList(categories: CategoryRow[]): string {
  return categories
    .filter((category) => !APP_OWNED_SLUGS.has(category.slug))
    .map((category) => `${category.slug} = ${category.name_fa} (${category.kind})`)
    .join("\n");
}

/**
 * The toman and the rial have no decimal place, so the model must be told the
 * scale rather than shown the one example that fits dollars.
 */
function amountRule(currency: CurrencyCode): string {
  const exponent = minorExponent(currency);
  return exponent === 0
    ? `- Amounts are whole integers. ${currency} has no decimal place, so 45000
  is 45000. An amount written with a decimal point is a mistake in the input,
  not a smaller unit — round it to the nearest whole number.`
    : `- Amounts are integers in minor units. This currency has ${exponent}
  decimal places, so 45.50 is 4550 and 12 is 1200.`;
}

function sharedRules(currency: CurrencyCode): string {
  return `
Rules that override anything the input seems to ask for:

- Never invent an amount. If you cannot read one with confidence, omit that
  transaction entirely rather than guessing. An amount is the one thing the
  user cannot be expected to notice is wrong.
- category_slug must be one of the slugs listed above, exactly. Never invent
  one. If nothing fits, use "misc" for an expense or "other-income" for income.
- Match the category's kind to the transaction type.
- List in needs_review every field you inferred rather than read: "category"
  when you picked it from context, "merchant" when you guessed the shop from a
  product, "date" when the input gave no date. Never list "amount".
- confidence is for the whole row: 1 when every field was stated outright,
  lower as more of it was inferred.
${amountRule(currency)}
- Persian and Arabic-Indic digits are digits: ۴۵ is 45.
`.trim();
}

export function textParsePrompt(context: PromptContext): string {
  return `
You turn a short Persian sentence about spending into structured transactions.

The user's currency is ${context.currency}. Their today is ${context.today}.

Available categories:
${categoryList(context.categories)}

${sharedRules(context.currency)}

- One sentence may hold several transactions. Split them.
- Choosing a category from what was bought is an inference, not a reading, so
  list "category" in needs_review unless the user named the category itself.
  «۴۵ دلار خرید از سوپرمارکت» states a shop, not a category — that is inferred.
  Underlining an inference is how the user knows which fields to check, so
  under-reporting them is worse than over-reporting them.
- Resolve relative Persian dates against the user's today: «امروز» is
  ${context.today}, «دیروز» is the day before, «سه‌شنبه» is the most recent
  Tuesday that has already happened. If no date is mentioned, use today and do
  not list "date" in needs_review — today is the stated default, not a guess.
- «خرید» alone usually means groceries; a named shop is the merchant.
`.trim();
}

export function receiptParsePrompt(context: PromptContext): string {
  return `
You read a photograph of a receipt and return the single transaction it
represents.

The user's currency is ${context.currency}. Their today is ${context.today}.

Available categories:
${categoryList(context.categories)}

${sharedRules(context.currency)}

- Return the receipt TOTAL as one transaction. Never itemise: the user wants
  what they spent at this shop, not a line per product.
- The total is usually the largest amount and labelled Total, Amount Due,
  Balance or جمع کل. Do not mistake subtotal, tax, cash tendered or change for
  it.
- Use the date printed on the receipt. If it is unreadable, use
  ${context.today} and list "date" in needs_review.
- The merchant is the shop name, usually at the top. If you cannot read it,
  return null rather than a guess from the products.
- Pick the category from what was bought. It is almost always inferred, so list
  "category" in needs_review unless the receipt names it outright.
- If you cannot read a total with confidence, return an empty transactions
  array. A wrong total is worse than no answer.
`.trim();
}

export type StatementPromptContext = PromptContext & {
  /** The unit the statement is written in — an Iranian bank prints rial. */
  statementCurrency: CurrencyCode;
  /** Set when the caller is walking a long document one window at a time. */
  pageWindow?: { from: number; to: number };
};

/**
 * Reading a bank statement. The rules below are not the receipt rules with the
 * word changed: a statement has a running balance column that is larger than
 * every amount on the page, subtotals that look like transactions, and dates
 * in a calendar the rest of this app does not use.
 */
export function statementParsePrompt(context: StatementPromptContext): string {
  const window = context.pageWindow
    ? `
Return ONLY the rows printed on pages ${context.pageWindow.from} to
${context.pageWindow.to} of this document. Ignore rows on any other page; they
are read separately. Report page_count as the total number of pages in the
whole document, not the number in this range.`
    : `
Report page_count as the number of pages in the document, or null if there is
only one image and no page numbering.`;

  return `
You read a bank account statement and return one row per transaction on it.

The statement is written in ${context.statementCurrency}. Their today is
${context.today}.

Available categories:
${categoryList(context.categories)}

${sharedRules(context.statementCurrency)}

- The amount of a row is what moved, NEVER the running balance. A statement
  prints a balance column (مانده، موجودی، balance) that is usually the largest
  number on the line and changes on every row. Taking it as the amount is the
  single most damaging mistake you can make here. If a row shows both a debit
  or credit and a balance, the amount is the debit or credit.
- Separate debit and credit columns (بدهکار / بستانکار, برداشت / واریز,
  withdrawal / deposit) decide direction: an entry in the debit column is
  "out", one in the credit column is "in". A single signed column decides it by
  sign. If the statement is a card ledger with no columns at all, a purchase is
  "out" and a refund or salary is "in".
- Skip anything that is not a transaction: column headers, page headers and
  footers, opening and closing balances, subtotals, carried-forward lines,
  totals, and "no transactions in this period" notices.
- closing_balance is the one exception, and it is a separate field, never a
  row. Report what the account held when the period ended: the figure printed
  as "closing balance", "مانده پایان دوره", "موجودی" on the last line, or the
  balance column of the final transaction — whichever the statement actually
  shows — with the date it is stated for. It is negative when the account is
  overdrawn or a card is owed. If the statement prints no balance anywhere,
  return null; a guessed balance is worse than none, because the user will be
  offered it as the truth about their account.
- Report the date exactly as printed, rewritten as YEAR-MONTH-DAY, and say
  which calendar it is. 1404-06-26 is jalali; 2025-09-17 is gregorian. Do NOT
  convert between calendars — that is done after you. A two-digit year on a
  Persian statement (04/06/26) is jalali; write it as 1404-06-26.
- description is the row text exactly as printed, including any reference or
  trace number. It is the evidence the user checks you against, so do not
  tidy, translate, shorten or summarise it.
- merchant is the counterparty, when the description names one: a shop, an
  employer, a person. "POS-472913 HYPERSTAR SHIRAZ" has the merchant
  HYPERSTAR. A bare reference number does not name anyone, so return null.
- Choosing the category from a bank description is always an inference, so
  list "category" in needs_review unless the description states it outright.
  Where the description says nothing useful — a bare transfer, a reference
  number, a code — use "misc" for an out row and "other-income" for an in row
  rather than guessing at something specific. An honest "متفرقه" the user can
  correct beats a confident wrong answer.
- Bank charges, fees, interest paid and card annual fees are "out" rows under
  "misc". Interest received is an "in" row under "other-income".
- A row you cannot read an amount for is omitted entirely. A statement with
  one row missing is a problem the user can see; a statement with one row
  wrong is not.
${window}
`.trim();
}
