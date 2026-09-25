import { describe, expect, it } from "vitest";
import {
  latestBalance,
  normalise,
  normaliseClosingBalance,
  resolveDate,
  spreadsheetChunks,
  type NormaliseContext,
} from "@/lib/import/normalise";
import type { StatementLine } from "@/lib/ai/schemas";
import type { CategoryRow } from "@/lib/supabase/database.types";

const TODAY = "2026-09-17";

function category(slug: string, kind: "expense" | "income"): CategoryRow {
  return {
    id: `id-${slug}`,
    user_id: null,
    name_fa: slug,
    slug,
    kind,
    cost_kind: "variable",
    icon: null,
    color: null,
    is_system: true,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  };
}

const CATEGORIES = [
  category("groceries", "expense"),
  category("misc", "expense"),
  category("salary", "income"),
  category("other-income", "income"),
];

function context(overrides: Partial<NormaliseContext> = {}): NormaliseContext {
  return {
    today: TODAY,
    statementCurrency: "CAD",
    baseCurrency: "CAD",
    categories: CATEGORIES,
    ...overrides,
  };
}

function line(overrides: Partial<StatementLine> = {}): StatementLine {
  return {
    date: "2026-09-10",
    calendar: "gregorian",
    direction: "out",
    amount_minor: 4550,
    description: "POS-472913 HYPERSTAR",
    merchant: "HYPERSTAR",
    category_slug: "groceries",
    confidence: 0.8,
    needs_review: [],
    ...overrides,
  };
}

describe("resolveDate", () => {
  it("reads a Gregorian date as written", () => {
    expect(resolveDate("2026-09-10", TODAY)).toBe("2026-09-10");
  });

  it("converts a Jalali date", () => {
    expect(resolveDate("1404-06-26", TODAY)).toBe("2025-09-17");
  });

  it("expands a two-digit Persian year", () => {
    expect(resolveDate("04-06-26", TODAY)).toBe("2025-09-17");
  });

  it("trusts the year over the label the model attached", () => {
    // Both of these arrive mislabelled in practice. The magnitude of the year
    // is unambiguous where the label is not.
    expect(resolveDate("1405-06-26", TODAY)).toBe("2026-09-17");
    expect(resolveDate("2026-09-10", TODAY)).toBe("2026-09-10");
  });

  it("rejects a date that does not exist", () => {
    expect(resolveDate("2026-02-31", TODAY)).toBeNull();
    expect(resolveDate("2026-13-01", TODAY)).toBeNull();
  });

  it("rejects a date outside living memory", () => {
    expect(resolveDate("1990-01-01", TODAY)).toBeNull();
  });

  it("rejects a date well into the future but allows a near posting", () => {
    expect(resolveDate("2027-09-10", TODAY)).toBeNull();
    expect(resolveDate("2026-09-30", TODAY)).toBe("2026-09-30");
  });
});

describe("normalise", () => {
  it("keeps a clean row", () => {
    const result = normalise(line(), context());
    expect(result).toMatchObject({
      occurredOn: "2026-09-10",
      direction: "out",
      amount: 4550,
      merchant: "HYPERSTAR",
      categorySlug: "groceries",
    });
  });

  it("converts a rial statement into a toman ledger", () => {
    const result = normalise(
      line({ amount_minor: 4_500_000 }),
      context({ statementCurrency: "IRR", baseCurrency: "IRT" }),
    );
    expect(result?.amount).toBe(450_000);
  });

  it("always marks the category as a guess", () => {
    const result = normalise(line({ needs_review: [] }), context());
    expect(result?.needsReview).toContain("category");
  });

  it("never marks the amount as a guess", () => {
    const result = normalise(line({ needs_review: ["amount"] }), context());
    expect(result?.needsReview).not.toContain("amount");
  });

  it("drops a merchant flag when there is no merchant", () => {
    const result = normalise(
      line({ merchant: null, needs_review: ["merchant"] }),
      context(),
    );
    expect(result?.needsReview).not.toContain("merchant");
  });

  it("falls back to متفرقه rather than losing an unrecognised outflow", () => {
    const result = normalise(line({ category_slug: "crypto-mining" }), context());
    expect(result?.categorySlug).toBe("misc");
    expect(result?.amount).toBe(4550);
  });

  it("falls back to سایر درآمد for an unrecognised inflow", () => {
    const result = normalise(
      line({ direction: "in", category_slug: "nonsense" }),
      context(),
    );
    expect(result?.categorySlug).toBe("other-income");
  });

  it("rejects a category from the wrong side of the ledger", () => {
    // "salary" exists, but an outflow cannot be salary.
    const result = normalise(line({ category_slug: "salary" }), context());
    expect(result?.categorySlug).toBe("misc");
  });

  it("lowers confidence when it had to fall back", () => {
    const result = normalise(
      line({ category_slug: "nonsense", confidence: 0.95 }),
      context(),
    );
    expect(result?.confidence).toBeLessThanOrEqual(0.4);
  });

  it("drops a row whose date cannot be trusted", () => {
    expect(normalise(line({ date: "1912-01-01" }), context())).toBeNull();
  });

  it("drops a row whose currency does not convert", () => {
    expect(
      normalise(line(), context({ statementCurrency: "USD", baseCurrency: "CAD" })),
    ).toBeNull();
  });

  it("keeps the bank description verbatim", () => {
    const description = "  انتقال وجه ساتنا ref:8891234  ";
    const result = normalise(line({ description }), context());
    expect(result?.description).toBe("انتقال وجه ساتنا ref:8891234");
  });

  it("never leaves a row without a description", () => {
    expect(normalise(line({ description: "   " }), context())?.description).toBe(
      "بدون شرح",
    );
  });
});

describe("spreadsheetChunks", () => {
  it("keeps a short file in one call", () => {
    const text = ["date,amount", "2026-09-10,45.50", "2026-09-11,12.00"].join("\n");
    expect(spreadsheetChunks(text)).toEqual([text]);
  });

  it("repeats the header on every chunk", () => {
    const rows = Array.from({ length: 200 }, (_, i) => `2026-09-10,${i}`);
    const chunks = spreadsheetChunks(["date,amount", ...rows].join("\n"));

    expect(chunks.length).toBe(3);
    for (const chunk of chunks) {
      expect(chunk.split("\n")[0]).toBe("date,amount");
    }
  });

  it("splits without losing or repeating a row", () => {
    const rows = Array.from({ length: 200 }, (_, i) => `2026-09-10,${i}`);
    const chunks = spreadsheetChunks(["date,amount", ...rows].join("\n"));

    const seen = chunks.flatMap((chunk) => chunk.split("\n").slice(1));
    expect(seen).toEqual(rows);
    expect(new Set(seen).size).toBe(rows.length);
  });

  it("ignores blank lines a bank export pads with", () => {
    expect(spreadsheetChunks("\n\n  \n")).toEqual([]);
  });
});

describe("the closing balance", () => {
  const context = {
    today: "2026-09-17" as const,
    statementCurrency: "IRR" as const,
    baseCurrency: "IRT" as const,
    categories: [],
  };

  it("converts the bank's unit to the user's, like every other amount", () => {
    // An Iranian bank closes the month at 12,000,000 rial. The user counts in
    // toman, and being offered a balance ten times too large as the truth
    // about their account is the worst outcome this step has.
    const balance = normaliseClosingBalance(
      { amount_minor: 12_000_000, date: "1405-06-26", calendar: "jalali" },
      context,
    );
    expect(balance?.amount).toBe(1_200_000);
  });

  it("converts the date, and does not trust the model's calendar label", () => {
    const balance = normaliseClosingBalance(
      { amount_minor: 100, date: "1405-06-26", calendar: "gregorian" },
      context,
    );
    expect(balance?.asOf).toBe("2026-09-17");
  });

  it("is null rather than a guess when the date cannot be settled", () => {
    expect(
      normaliseClosingBalance(
        { amount_minor: 100, date: "1405-13-40", calendar: "jalali" },
        context,
      ),
    ).toBeNull();
  });

  it("keeps a negative balance negative", () => {
    // A card statement closes owing, and refusing the sign would flip a debt
    // into savings.
    const balance = normaliseClosingBalance(
      { amount_minor: -5_000_000, date: "1405-06-26", calendar: "jalali" },
      context,
    );
    expect(balance?.amount).toBe(-500_000);
  });

  it("is null when the statement printed none", () => {
    expect(normaliseClosingBalance(null, context)).toBeNull();
  });
});

describe("latestBalance", () => {
  it("takes the newest, whatever order the calls came back in", () => {
    const picked = latestBalance([
      { amount: 100, asOf: "2026-07-31" },
      { amount: 300, asOf: "2026-09-30" },
      { amount: 200, asOf: "2026-08-31" },
    ]);
    expect(picked?.amount).toBe(300);
  });

  it("is null when nothing reported one", () => {
    expect(latestBalance([])).toBeNull();
  });
});
