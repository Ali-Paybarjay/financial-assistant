import { describe, expect, it } from "vitest";
import {
  byTag,
  isSquare,
  personalMovement,
  outstandingTotal,
  settlementPlan,
  splitEqually,
  splitByUnits,
  splitGap,
  standing,
  type MemberBalance,
  type Transfer,
} from "@/lib/dong";

function balance(memberId: string, net: number): MemberBalance {
  // Only `net` drives settlement; the rest is carried for the report.
  return { memberId, paid: 0, share: 0, sent: 0, received: 0, net };
}

function total(shares: readonly { amount: number }[]): number {
  return shares.reduce((sum, share) => sum + share.amount, 0);
}

function applied(balances: MemberBalance[], transfers: Transfer[]): Map<string, number> {
  const net = new Map(balances.map((entry) => [entry.memberId, entry.net]));
  for (const transfer of transfers) {
    net.set(transfer.fromMemberId, (net.get(transfer.fromMemberId) ?? 0) + transfer.amount);
    net.set(transfer.toMemberId, (net.get(transfer.toMemberId) ?? 0) - transfer.amount);
  }
  return net;
}

describe("splitByUnits", () => {
  it("splits evenly when it divides", () => {
    const shares = splitEqually(9000, ["a", "b", "c"]);
    expect(shares.map((share) => share.amount)).toEqual([3000, 3000, 3000]);
  });

  it("gives the remainder to the earliest members, and loses nothing", () => {
    const shares = splitEqually(100, ["a", "b", "c"]);
    expect(shares.map((share) => share.amount)).toEqual([34, 33, 33]);
    expect(total(shares)).toBe(100);
  });

  it("weights by units", () => {
    const shares = splitByUnits(400, [
      { memberId: "a", units: 2 },
      { memberId: "b", units: 1 },
      { memberId: "c", units: 1 },
    ]);
    expect(shares.map((share) => share.amount)).toEqual([200, 100, 100]);
  });

  it("hands leftovers to whoever was rounded down hardest", () => {
    // 10 over units 1:1:1:1:1:1 is 1.666… each; the six floors leave 4 over.
    const shares = splitByUnits(
      10,
      ["a", "b", "c", "d", "e", "f"].map((memberId) => ({ memberId, units: 1 })),
    );
    expect(total(shares)).toBe(10);
    expect(shares.map((share) => share.amount)).toEqual([2, 2, 2, 2, 1, 1]);
  });

  it("keeps the total exact across a range of awkward splits", () => {
    for (let amount = 0; amount <= 200; amount += 1) {
      for (let people = 1; people <= 7; people += 1) {
        const ids = Array.from({ length: people }, (_, index) => `m${index}`);
        expect(total(splitEqually(amount, ids))).toBe(amount);
      }
    }
  });

  it("returns nothing when nobody is on the expense", () => {
    expect(splitEqually(1000, [])).toEqual([]);
  });

  it("puts the whole amount on a single member", () => {
    expect(splitEqually(1234, ["a"])).toEqual([{ memberId: "a", units: 1, amount: 1234 }]);
  });
});

describe("splitGap", () => {
  it("is zero when the shares cover the bill", () => {
    expect(splitGap(100, splitEqually(100, ["a", "b", "c"]))).toBe(0);
  });

  it("is positive when the shares fall short", () => {
    expect(splitGap(100, [{ memberId: "a", units: 1, amount: 60 }])).toBe(40);
  });

  it("is negative when they overshoot", () => {
    expect(splitGap(100, [{ memberId: "a", units: 1, amount: 130 }])).toBe(-30);
  });
});

describe("standing", () => {
  it("reads the sign the way the screen does", () => {
    expect(standing(500)).toBe("owed");
    expect(standing(-500)).toBe("owes");
    expect(standing(0)).toBe("clear");
  });
});

describe("settlementPlan", () => {
  it("clears the simple case in one transfer", () => {
    expect(settlementPlan([balance("ali", 50), balance("sara", -50)])).toEqual([
      { fromMemberId: "sara", toMemberId: "ali", amount: 50 },
    ]);
  });

  it("asks for nothing when everyone is square", () => {
    expect(settlementPlan([balance("ali", 0), balance("sara", 0)])).toEqual([]);
  });

  it("leaves every balance at zero", () => {
    const balances = [
      balance("a", 7000),
      balance("b", -3000),
      balance("c", -5000),
      balance("d", 1000),
    ];
    for (const net of applied(balances, settlementPlan(balances)).values()) {
      expect(net).toBe(0);
    }
  });

  it("needs at most one transfer fewer than there are people", () => {
    const balances = [
      balance("a", 12000),
      balance("b", -2000),
      balance("c", -4000),
      balance("d", -3000),
      balance("e", -3000),
    ];
    expect(settlementPlan(balances).length).toBeLessThanOrEqual(balances.length - 1);
  });

  it("does not depend on the order the balances arrive in", () => {
    const balances = [balance("a", 300), balance("b", -100), balance("c", -200)];
    const reversed = [...balances].reverse();
    expect(settlementPlan(reversed)).toEqual(settlementPlan(balances));
  });

  it("ignores the kitty once it has spent what it took in", () => {
    // Two people put 30 each into the fund; the fund spent all 60.
    const balances = [balance("ali", 0), balance("sara", 0), balance("fund", 0)];
    expect(settlementPlan(balances)).toEqual([]);
  });
});

describe("outstandingTotal", () => {
  it("counts what is owed once, not from both sides", () => {
    expect(outstandingTotal([balance("a", 500), balance("b", -300), balance("c", -200)]))
      .toBe(500);
  });
});

describe("isSquare", () => {
  it("is true only when nobody is carrying anything", () => {
    expect(isSquare([balance("a", 0), balance("b", 0)])).toBe(true);
    expect(isSquare([balance("a", 1), balance("b", -1)])).toBe(false);
  });
});

describe("byTag", () => {
  it("adds up each tag and puts the biggest first", () => {
    expect(
      byTag([
        { tag: "غذا", amount: 100 },
        { tag: "اقامت", amount: 500 },
        { tag: "غذا", amount: 250 },
      ]),
    ).toEqual([
      { tag: "اقامت", amount: 500 },
      { tag: "غذا", amount: 350 },
    ]);
  });

  it("folds untagged expenses into one bucket", () => {
    expect(
      byTag([
        { tag: null, amount: 100 },
        { tag: "", amount: 50 },
      ]),
    ).toEqual([{ tag: null, amount: 150 }]);
  });
});

/**
 * The rule that decides whether a shared purchase touches the user's own
 * ledger. It is stated twice on purpose — here, and as SQL in migration
 * 0017 — so this is the copy that can be interrogated cheaply, and the one
 * that has to keep agreeing with the trigger.
 */
describe("personalMovement", () => {
  const ME = "me";
  const THEM = "them";

  it("counts a bill the viewer paid, in full and not by their share", () => {
    expect(
      personalMovement(
        ME,
        [{ paidByMemberId: ME, accountId: "acct", amount: 6000 }],
        [],
      ),
    ).toEqual({ out: 6000, in: 0 });
  });

  it("ignores a bill somebody else paid, however much of it is owed", () => {
    expect(
      personalMovement(
        ME,
        [{ paidByMemberId: THEM, accountId: "acct", amount: 6000 }],
        [],
      ),
    ).toEqual({ out: 0, in: 0 });
  });

  it("ignores a bill with no account behind it", () => {
    expect(
      personalMovement(ME, [{ paidByMemberId: ME, accountId: null, amount: 6000 }], []),
    ).toEqual({ out: 0, in: 0 });
  });

  it("reads a payment by its direction", () => {
    const payments = [
      { fromMemberId: ME, toMemberId: THEM, accountId: "acct", amount: 500 },
      { fromMemberId: THEM, toMemberId: ME, accountId: "acct", amount: 3000 },
      // Two other people settling between themselves. Not this user's money.
      { fromMemberId: THEM, toMemberId: "third", accountId: "acct", amount: 900 },
    ];

    expect(personalMovement(ME, [], payments)).toEqual({ out: 500, in: 3000 });
  });

  it("finds nothing when no member of the group is the viewer", () => {
    expect(
      personalMovement(
        null,
        [{ paidByMemberId: ME, accountId: "acct", amount: 6000 }],
        [{ fromMemberId: THEM, toMemberId: ME, accountId: "acct", amount: 3000 }],
      ),
    ).toEqual({ out: 0, in: 0 });
  });
});
