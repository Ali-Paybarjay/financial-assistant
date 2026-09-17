import type { Minor } from "@/lib/money";

/**
 * The arithmetic behind «دنگ و دونگ»: how one bill becomes a share per person,
 * and how a table of balances becomes the shortest list of payments that
 * clears it.
 *
 * Pure, and kept apart from every query, because these are the two places the
 * feature can be wrong in a way nobody notices: a split that loses a unit of
 * currency, and a settlement that asks for more transfers than it needs. Both
 * are pinned by tests/unit/dong.spec.ts.
 */

/* ------------------------------------------------------------- splitting -- */

export type SplitInput = {
  memberId: string;
  /** Weight. 1 for an even split, 2 for someone who brought a guest. */
  units: number;
};

export type Share = {
  memberId: string;
  units: number;
  amount: Minor;
};

/**
 * Split `amount` across the given members in proportion to their units.
 *
 * Money is integers, so a three-way split of 100 cannot be three equal
 * numbers. The largest-remainder method hands the leftover units to whoever
 * was rounded down hardest, and ties go to the earlier member — which is the
 * order the group already displays people in, so the same person does not
 * quietly absorb every rounding in the trip while looking like nobody did.
 *
 * The total is exactly `amount`. That is the point of doing this once, here,
 * rather than letting each caller round its own way.
 */
export function splitByUnits(
  amount: Minor,
  inputs: readonly SplitInput[],
): Share[] {
  if (inputs.length === 0) return [];

  const totalUnits = inputs.reduce((sum, input) => sum + input.units, 0);
  if (totalUnits <= 0) return inputs.map((input) => ({ ...input, amount: 0 }));

  const floored = inputs.map((input, index) => {
    const exact = (amount * input.units) / totalUnits;
    const base = Math.floor(exact);
    return { index, memberId: input.memberId, units: input.units, base, remainder: exact - base };
  });

  let left = amount - floored.reduce((sum, row) => sum + row.base, 0);

  // Biggest fractional part first; the display order breaks ties.
  const queue = [...floored].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );

  const extra = new Set<number>();
  for (const row of queue) {
    if (left <= 0) break;
    extra.add(row.index);
    left -= 1;
  }

  return floored.map((row) => ({
    memberId: row.memberId,
    units: row.units,
    amount: row.base + (extra.has(row.index) ? 1 : 0),
  }));
}

/** An even split: everyone on the expense carries one unit. */
export function splitEqually(amount: Minor, memberIds: readonly string[]): Share[] {
  return splitByUnits(
    amount,
    memberIds.map((memberId) => ({ memberId, units: 1 })),
  );
}

/**
 * What the database enforces, restated in the form so the user is told before
 * saving rather than after. Returns the gap, signed the way a person reads it:
 * positive means the shares are short of the bill.
 */
export function splitGap(amount: Minor, shares: readonly Share[]): Minor {
  return amount - shares.reduce((sum, share) => sum + share.amount, 0);
}

/* -------------------------------------------------------------- balances -- */

/** One member's position, as `dong_balances()` returns it. */
export type MemberBalance = {
  memberId: string;
  /** Expenses this member paid for, in full. */
  paid: Minor;
  /** Their share of every expense they were on. */
  share: Minor;
  /** Payments they made to other members. */
  sent: Minor;
  /** Payments other members made to them. */
  received: Minor;
  /** paid + sent − share − received. Positive is owed money. */
  net: Minor;
};

/** Owed money, owes money, or square. */
export function standing(net: Minor): "owed" | "owes" | "clear" {
  if (net > 0) return "owed";
  if (net < 0) return "owes";
  return "clear";
}

/**
 * Whether the group is finished in the only sense that matters: nobody is
 * carrying anything. Not the same as the user having archived it.
 */
export function isSquare(balances: readonly MemberBalance[]): boolean {
  return balances.every((balance) => balance.net === 0);
}

/** What is still outstanding, counted once rather than twice. */
export function outstandingTotal(balances: readonly MemberBalance[]): Minor {
  return balances.reduce((sum, balance) => sum + Math.max(0, balance.net), 0);
}

/* ------------------------------------------------------------ settlement -- */

export type Transfer = {
  fromMemberId: string;
  toMemberId: string;
  amount: Minor;
};

/**
 * The list of payments that clears the group.
 *
 * Greedy: the deepest debtor pays the largest creditor as much as it can, and
 * whichever of the two is emptied drops out. Each step removes at least one
 * member from the problem, so a group of n settles in at most n − 1 transfers
 * — against the n × (n − 1) / 2 that "everyone settles with everyone" would
 * cost. Six people paying five times instead of fifteen is the whole reason
 * this screen exists.
 *
 * This is not guaranteed to be the theoretical minimum — that problem is
 * NP-hard — but it is minimal in the way people care about, and it is stable:
 * the same balances always produce the same list, because ties are broken by
 * member id rather than by whatever order the rows arrived in.
 */
export function settlementPlan(balances: readonly MemberBalance[]): Transfer[] {
  const creditors = balances
    .filter((balance) => balance.net > 0)
    .map((balance) => ({ memberId: balance.memberId, left: balance.net }))
    .sort((a, b) => b.left - a.left || a.memberId.localeCompare(b.memberId));

  const debtors = balances
    .filter((balance) => balance.net < 0)
    .map((balance) => ({ memberId: balance.memberId, left: -balance.net }))
    .sort((a, b) => b.left - a.left || a.memberId.localeCompare(b.memberId));

  const transfers: Transfer[] = [];
  let c = 0;
  let d = 0;

  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c];
    const debtor = debtors[d];
    const amount = Math.min(creditor.left, debtor.left);

    if (amount > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount,
      });
      creditor.left -= amount;
      debtor.left -= amount;
    }

    if (creditor.left === 0) c += 1;
    if (debtor.left === 0) d += 1;
  }

  return transfers;
}

/* --------------------------------------------------------------- reports -- */

export type TagSlice = { tag: string | null; amount: Minor };

/** Spending by tag, biggest first — what the report's donut is drawn from. */
export function byTag(
  expenses: readonly { tag: string | null; amount: Minor }[],
): TagSlice[] {
  const totals = new Map<string | null, Minor>();

  for (const expense of expenses) {
    const key = expense.tag || null;
    totals.set(key, (totals.get(key) ?? 0) + expense.amount);
  }

  return [...totals.entries()]
    .map(([tag, amount]) => ({ tag, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Who consumed what, biggest first. Members with no share are left out. */
export function byMemberShare(
  balances: readonly MemberBalance[],
): { memberId: string; amount: Minor }[] {
  return balances
    .filter((balance) => balance.share > 0)
    .map((balance) => ({ memberId: balance.memberId, amount: balance.share }))
    .sort((a, b) => b.amount - a.amount);
}
