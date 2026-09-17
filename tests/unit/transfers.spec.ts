import { describe, expect, it } from "vitest";
import { ledgerForAccount, reconcile, type LedgerEntry } from "@/lib/import/reconcile";
import { reconcileState, accountsDue } from "@/lib/accounts";
import type { AccountRow } from "@/lib/supabase/database.types";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

function transfer(id: string, from: string, to: string): LedgerEntry {
  return {
    id,
    type: "transfer",
    amount: 25000,
    occurredOn: "2026-09-08",
    accountId: from,
    toAccountId: to,
  };
}

describe("a transfer on a statement", () => {
  it("is an outflow on the account it left", () => {
    const [leg] = ledgerForAccount([transfer("t", A, B)], A);
    expect(leg.type).toBe("expense");
  });

  it("is an inflow on the account it arrived in", () => {
    const [leg] = ledgerForAccount([transfer("t", A, B)], B);
    expect(leg.type).toBe("income");
  });

  it("is invisible on an account it never touched", () => {
    expect(ledgerForAccount([transfer("t", A, B)], "cccccccc-0000-0000-0000-000000000003"))
      .toEqual([]);
  });

  it("matches the statement row of whichever side is being read", () => {
    // B's statement shows 250 arriving on the 8th. The same stored row is what
    // that line is, so it must not be reported as money B has never seen.
    const results = reconcile(
      [{ rowIndex: 0, occurredOn: "2026-09-08", direction: "in", amount: 25000 }],
      ledgerForAccount([transfer("t", A, B)], B),
    );
    expect(results[0].match).toEqual({ transactionId: "t", dayGap: 0 });
  });

  it("does not match the wrong direction", () => {
    // A's statement cannot show this as an inflow; if it did, it is a
    // different transaction and must be offered as new.
    const results = reconcile(
      [{ rowIndex: 0, occurredOn: "2026-09-08", direction: "in", amount: 25000 }],
      ledgerForAccount([transfer("t", A, B)], A),
    );
    expect(results[0].match).toBeNull();
  });

  it("reads as an outflow when the import names no account", () => {
    // Every import made before accounts existed. It left somewhere, and an
    // outflow is the only reading available.
    const [leg] = ledgerForAccount([transfer("t", A, B)], null);
    expect(leg.type).toBe("expense");
  });
});

/* ------------------------------------------------ the monthly reminder -- */

function account(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: A,
    user_id: "user-1",
    title: "حساب جاری",
    kind: "checking",
    currency: "CAD",
    opening_balance: 0,
    opening_balance_on: "2026-01-01",
    institution: null,
    reference: null,
    is_default: false,
    is_active: true,
    sort_order: 0,
    last_reconciled_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("reconcileState", () => {
  const TZ = "UTC";

  it("is due when the last check was last month", () => {
    const state = reconcileState(
      account({ last_reconciled_at: "2026-08-20T10:00:00Z" }),
      "2026-09-17",
      TZ,
    );
    expect(state.due).toBe(true);
    expect(state.monthsBehind).toBe(1);
  });

  it("is not due once it has been checked this month", () => {
    const state = reconcileState(
      account({ last_reconciled_at: "2026-09-02T10:00:00Z" }),
      "2026-09-17",
      TZ,
    );
    expect(state.due).toBe(false);
    expect(state.monthsBehind).toBe(0);
  });

  it("counts calendar months, not thirty-day blocks", () => {
    const state = reconcileState(
      account({ last_reconciled_at: "2026-06-30T10:00:00Z" }),
      "2026-09-01",
      TZ,
    );
    expect(state.monthsBehind).toBe(3);
  });

  it("does not nag about an account opened this month and never checked", () => {
    // Nothing has happened on it yet and no statement exists to check against.
    const state = reconcileState(
      account({ opening_balance_on: "2026-09-04" }),
      "2026-09-17",
      TZ,
    );
    expect(state.due).toBe(false);
    expect(state.monthsBehind).toBeNull();
  });

  it("does ask about an older account that has never been checked", () => {
    const state = reconcileState(
      account({ opening_balance_on: "2026-07-04" }),
      "2026-09-17",
      TZ,
    );
    expect(state.due).toBe(true);
  });

  it("counts the check in the user's own zone, not UTC", () => {
    // 1 September, 01:00 in Tehran is 31 August, 21:30 UTC. Reading the
    // instant in UTC would call an account checked an hour ago overdue, and
    // the reminder would reappear the moment it was answered.
    const justChecked = account({ last_reconciled_at: "2026-08-31T21:30:00Z" });
    expect(reconcileState(justChecked, "2026-09-01", "Asia/Tehran").due).toBe(false);
    expect(reconcileState(justChecked, "2026-09-01", "UTC").due).toBe(true);
  });
});

describe("accountsDue", () => {
  it("leaves closed accounts alone", () => {
    const rows = [
      account({ id: A, is_active: false, last_reconciled_at: "2026-01-02T00:00:00Z" }),
      account({ id: B, last_reconciled_at: "2026-08-02T00:00:00Z" }),
    ];
    expect(accountsDue(rows, "2026-09-17", "UTC").map((row) => row.id)).toEqual([B]);
  });
});
