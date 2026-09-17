import { describe, expect, it } from "vitest";
import {
  MATCH_WINDOW_DAYS,
  reconcile,
  summarise,
  type LedgerEntry,
  type ReconcilableLine,
} from "@/lib/import/reconcile";

function line(
  rowIndex: number,
  occurredOn: string,
  amount: number,
  direction: "in" | "out" = "out",
): ReconcilableLine {
  return { rowIndex, occurredOn, amount, direction };
}

function ledger(
  id: string,
  occurredOn: string,
  amount: number,
  type: "expense" | "income" = "expense",
): LedgerEntry {
  return { id, occurredOn, amount, type };
}

describe("reconcile", () => {
  it("matches a row the user already logged on the same day", () => {
    const results = reconcile(
      [line(0, "2026-09-10", 4550)],
      [ledger("a", "2026-09-10", 4550)],
    );
    expect(results[0].match).toEqual({ transactionId: "a", dayGap: 0 });
  });

  it("matches across the posting delay", () => {
    const results = reconcile(
      [line(0, "2026-09-14", 4550)],
      [ledger("a", "2026-09-11", 4550)],
    );
    expect(results[0].match?.dayGap).toBe(MATCH_WINDOW_DAYS);
  });

  it("leaves a row alone once the date is further out than the window", () => {
    const results = reconcile(
      [line(0, "2026-09-15", 4550)],
      [ledger("a", "2026-09-11", 4550)],
    );
    expect(results[0].match).toBeNull();
  });

  it("never matches across direction", () => {
    const results = reconcile(
      [line(0, "2026-09-10", 4550, "in")],
      [ledger("a", "2026-09-10", 4550, "expense")],
    );
    expect(results[0].match).toBeNull();
  });

  it("never matches a different amount, however close the date", () => {
    const results = reconcile(
      [line(0, "2026-09-10", 4551)],
      [ledger("a", "2026-09-10", 4550)],
    );
    expect(results[0].match).toBeNull();
  });

  it("matches one-to-one: three identical rows against one entry leaves two", () => {
    const results = reconcile(
      [line(0, "2026-09-10", 4550), line(1, "2026-09-10", 4550), line(2, "2026-09-10", 4550)],
      [ledger("a", "2026-09-10", 4550)],
    );
    expect(results.filter((result) => result.match).length).toBe(1);
  });

  it("gives an exact date the entry rather than letting a distant row take it", () => {
    // Row 0 is three days off and comes first; row 1 agrees to the day. The
    // naive pass would hand the entry to row 0 and report row 1 as new.
    const results = reconcile(
      [line(0, "2026-09-07", 4550), line(1, "2026-09-10", 4550)],
      [ledger("a", "2026-09-10", 4550)],
    );
    expect(results[0].match).toBeNull();
    expect(results[1].match).toEqual({ transactionId: "a", dayGap: 0 });
  });

  it("is order-independent: the same file reconciles the same way reversed", () => {
    const lines = [
      line(0, "2026-09-07", 4550),
      line(1, "2026-09-10", 4550),
      line(2, "2026-09-12", 1200, "in"),
    ];
    const entries = [
      ledger("a", "2026-09-10", 4550),
      ledger("b", "2026-09-12", 1200, "income"),
    ];

    const forward = reconcile(lines, entries);
    const backward = reconcile([...lines].reverse(), [...entries].reverse());

    for (const result of forward) {
      const mirror = backward.find((entry) => entry.rowIndex === result.rowIndex);
      expect(mirror?.match).toEqual(result.match);
    }
  });

  it("recognises rows a previous upload already imported", () => {
    // The second upload of the same statement: everything it added is in the
    // ledger now, so nothing is new.
    const lines = [line(0, "2026-09-10", 4550), line(1, "2026-09-11", 9900, "in")];
    const entries = [
      ledger("a", "2026-09-10", 4550),
      ledger("b", "2026-09-11", 9900, "income"),
    ];
    expect(reconcile(lines, entries).every((result) => result.match)).toBe(true);
  });

  it("matches a transaction the recurring job posted", () => {
    const results = reconcile(
      [line(0, "2026-09-01", 120_000)],
      [ledger("rent", "2026-09-01", 120_000)],
    );
    expect(results[0].match?.transactionId).toBe("rent");
  });
});

describe("summarise", () => {
  it("counts and totals only what an import would actually add", () => {
    const lines = [
      line(0, "2026-09-10", 4550),
      line(1, "2026-09-11", 2000),
      line(2, "2026-09-12", 900_000, "in"),
    ];
    const results = reconcile(lines, [ledger("a", "2026-09-10", 4550)]);

    expect(summarise(lines, results)).toEqual({
      total: 3,
      matched: 1,
      fresh: 2,
      freshIncome: 900_000,
      freshExpense: 2000,
    });
  });
});
