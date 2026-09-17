import { describe, expect, it } from "vitest";
import { ledgerForAccount, type LedgerEntry } from "@/lib/import/reconcile";
import {
  preferredAccountId,
  totalBalance,
  type AccountWithBalance,
} from "@/lib/accounts";
import type { AccountRow } from "@/lib/supabase/database.types";
import { toMinor, formatMoney } from "@/lib/money";

function entry(id: string, accountId: string | null = null): LedgerEntry {
  return { id, type: "expense", amount: 4550, occurredOn: "2026-09-10", accountId };
}

function account(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: "acc-1",
    user_id: "user-1",
    title: "حساب جاری",
    kind: "checking",
    currency: "CAD",
    opening_balance: 0,
    opening_balance_on: "2026-09-01",
    institution: null,
    reference: null,
    is_default: false,
    is_active: true,
    sort_order: 0,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function withBalance(over: Partial<AccountWithBalance> = {}): AccountWithBalance {
  return {
    ...account(over),
    balance: 0,
    movement: 0,
    transactionCount: 0,
    lastActivityOn: null,
    ...over,
  };
}

describe("ledgerForAccount", () => {
  it("keeps rows of the same account", () => {
    const kept = ledgerForAccount([entry("a", "acc-1")], "acc-1");
    expect(kept.map((row) => row.id)).toEqual(["a"]);
  });

  it("drops rows belonging to another account", () => {
    // Two cards paying the same subscription on the same day is ordinary. If
    // the other card's row matched, this statement's row would be called
    // already-recorded and quietly lost.
    const kept = ledgerForAccount([entry("a", "acc-2")], "acc-1");
    expect(kept).toEqual([]);
  });

  it("keeps rows with no account at all", () => {
    // Logged before accounts existed, or logged without saying where from —
    // the likeliest other half of a statement row.
    const kept = ledgerForAccount([entry("a", null)], "acc-1");
    expect(kept.map((row) => row.id)).toEqual(["a"]);
  });

  it("keeps everything when the import names no account", () => {
    const ledger = [entry("a", "acc-1"), entry("b", "acc-2"), entry("c", null)];
    expect(ledgerForAccount(ledger, null)).toHaveLength(3);
  });
});

describe("preferredAccountId", () => {
  it("picks the one marked default", () => {
    const accounts = [
      account({ id: "a" }),
      account({ id: "b", is_default: true }),
      account({ id: "c" }),
    ];
    expect(preferredAccountId(accounts)).toBe("b");
  });

  it("picks the only active account when none is marked", () => {
    expect(preferredAccountId([account({ id: "a" })])).toBe("a");
  });

  it("picks nothing rather than guessing between several", () => {
    const accounts = [account({ id: "a" }), account({ id: "b" })];
    expect(preferredAccountId(accounts)).toBeNull();
  });

  it("never preselects a closed account", () => {
    expect(
      preferredAccountId([account({ id: "a", is_active: false, is_default: true })]),
    ).toBeNull();
  });
});

describe("totalBalance", () => {
  it("sums the open accounts and subtracts what is owed", () => {
    const total = totalBalance([
      withBalance({ id: "a", balance: 500_00 }),
      withBalance({ id: "b", kind: "card", balance: -120_00 }),
    ]);
    expect(total).toBe(380_00);
  });

  it("leaves closed accounts out of the total", () => {
    const total = totalBalance([
      withBalance({ id: "a", balance: 500_00 }),
      withBalance({ id: "b", balance: 999_00, is_active: false }),
    ]);
    expect(total).toBe(500_00);
  });
});

describe("a negative balance survives the round trip through the form", () => {
  it("reads back an amount this module itself rendered", () => {
    // formatMoney writes U+2212, not a hyphen. A credit card's balance goes
    // out to the edit field and comes back through toMinor, so the minus it
    // prints has to be one it accepts.
    const rendered = formatMoney(-120_00, "CAD", { omitSymbol: true });
    expect(rendered).toContain("−");
    expect(toMinor(rendered.replace(/,/g, ""), "CAD")).toBe(-120_00);
  });
});
