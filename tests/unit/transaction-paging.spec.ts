import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F10: every total in the product was built by selecting the month's rows into
 * JavaScript and adding them up, and PostgREST answers with at most `db.max_rows`
 * rows — 1000 by default. A response that hit the ceiling is simply shorter,
 * with no error and no flag, so a heavy month was summed over however much of it
 * fitted. The reproduction lost exactly one row out of 1001 and said nothing.
 *
 * The fix has two halves. Totals moved into SQL, which no test here can reach.
 * The other half is this module's paging, which is reachable and is the part
 * reconciliation depends on: it reports a statement line as *new money* when it
 * fails to find the transaction that matches it, so a ledger cut off at a page
 * boundary means offering money the user already recorded as money to import.
 *
 * The fake below is deliberately strict about `range`: it serves exactly the
 * window asked for, the way PostgREST does, so a caller that forgets to advance
 * its offset loops forever rather than passing.
 */

type RangeCall = { from: number; to: number };

const ranges: RangeCall[] = [];
let table: { id: string; occurred_on: string }[] = [];

function fakeBuilder() {
  const builder = {
    select: () => builder,
    is: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    or: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      ranges.push({ from, to });
      // Inclusive on both ends, like PostgREST's Range header.
      return Promise.resolve({ data: table.slice(from, to + 1), error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => fakeBuilder() }),
}));

const { listAllTransactions, listTransactionPage, listTransactions, PAGE_SIZE } =
  await import("@/lib/queries/transactions");

function rows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `t-${index}`,
    occurred_on: "2026-09-10",
  }));
}

beforeEach(() => {
  ranges.length = 0;
  table = [];
});

describe("listAllTransactions", () => {
  it("returns every row when there are more than one page of them", async () => {
    // One row past two full pages: the shape that made the bug invisible.
    table = rows(PAGE_SIZE * 2 + 1);

    const all = await listAllTransactions({ from: "2026-09-01", to: "2026-09-30" });

    expect(all).toHaveLength(PAGE_SIZE * 2 + 1);
    expect(all.at(-1)?.id).toBe(`t-${PAGE_SIZE * 2}`);
  });

  it("advances the window rather than asking for the same rows again", async () => {
    table = rows(PAGE_SIZE * 2 + 1);
    await listAllTransactions();

    expect(ranges).toEqual([
      { from: 0, to: PAGE_SIZE - 1 },
      { from: PAGE_SIZE, to: PAGE_SIZE * 2 - 1 },
      { from: PAGE_SIZE * 2, to: PAGE_SIZE * 3 - 1 },
    ]);
  });

  it("stops on a short page instead of paying for a round trip to learn nothing", async () => {
    table = rows(PAGE_SIZE - 1);
    await listAllTransactions();
    expect(ranges).toHaveLength(1);
  });

  it("stops on an empty table", async () => {
    expect(await listAllTransactions()).toEqual([]);
    expect(ranges).toHaveLength(1);
  });
});

describe("listTransactionPage", () => {
  it("knows another page exists without counting the table", async () => {
    table = rows(PAGE_SIZE + 1);
    const first = await listTransactionPage({}, 1);

    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    // One row past the page, fetched and discarded. An exact count would be a
    // second scan of a table that is being written to.
    expect(ranges[0]).toEqual({ from: 0, to: PAGE_SIZE });
  });

  it("reports the last page as the last page", async () => {
    table = rows(PAGE_SIZE);
    const only = await listTransactionPage({}, 1);
    expect(only.hasMore).toBe(false);
  });

  it("offsets by whole pages", async () => {
    table = rows(PAGE_SIZE * 3);
    const third = await listTransactionPage({}, 3);

    expect(third.page).toBe(3);
    expect(third.rows[0].id).toBe(`t-${PAGE_SIZE * 2}`);
  });

  it("treats a nonsense page number as the first page", async () => {
    table = rows(10);
    expect((await listTransactionPage({}, 0)).page).toBe(1);
    expect((await listTransactionPage({}, -4)).page).toBe(1);
  });
});

describe("listTransactions", () => {
  it("returns one page when the caller asks for no limit", async () => {
    table = rows(PAGE_SIZE * 2);
    // Not the whole ledger. A function that sometimes returns everything is a
    // function whose callers add it up.
    expect(await listTransactions()).toHaveLength(PAGE_SIZE);
  });

  it("honours an explicit limit", async () => {
    table = rows(50);
    expect(await listTransactions({ limit: 10 })).toHaveLength(10);
    expect(ranges[0]).toEqual({ from: 0, to: 9 });
  });
});
