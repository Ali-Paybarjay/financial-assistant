import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  DongBalanceRow,
  DongExpenseRow,
  DongExpenseShareRow,
  DongGroupRow,
  DongGroupTotalRow,
  DongMemberRow,
  DongMyBalanceRow,
  DongPaymentRow,
} from "@/lib/supabase/database.types";
import type { MemberBalance } from "@/lib/dong";
import { isCurrencyCode, type CurrencyCode, type Minor } from "@/lib/money";

/**
 * Every read of «دنگ و دونگ». Balances always come from `dong_balances()` and
 * never from arithmetic done in a page: there is one definition of who owes
 * what, and it lives in SQL beside the rows it is derived from.
 */

export type DongGroupWithTotals = DongGroupRow & {
  currency: CurrencyCode;
  /** People, not counting the kitty — it is a member but not a person. */
  memberCount: number;
  expenseCount: number;
  totalSpent: Minor;
  lastActivityOn: string | null;
};

export type DongExpenseWithShares = DongExpenseRow & {
  shares: DongExpenseShareRow[];
};

export type DongGroupDetail = {
  group: DongGroupWithTotals;
  members: DongMemberRow[];
  balances: MemberBalance[];
  expenses: DongExpenseWithShares[];
  payments: DongPaymentRow[];
};

/** The group's stored currency, or the one currency we can still format in. */
function groupCurrency(group: DongGroupRow): CurrencyCode {
  return isCurrencyCode(group.currency) ? group.currency : "CAD";
}

/** Open groups first, then the most recently started. */
function inDisplayOrder(rows: readonly DongGroupWithTotals[]): DongGroupWithTotals[] {
  return [...rows].sort(
    (a, b) =>
      Number(Boolean(a.settled_at)) - Number(Boolean(b.settled_at)) ||
      b.started_on.localeCompare(a.started_on) ||
      b.created_at.localeCompare(a.created_at),
  );
}

export async function listDongGroups(): Promise<DongGroupWithTotals[]> {
  const supabase = await createClient();

  const [{ data: groups, error }, { data: totals }] = await Promise.all([
    supabase.from("dong_groups").select("*"),
    supabase.rpc("dong_group_totals"),
  ]);

  if (error) throw error;

  const byGroup = new Map<string, DongGroupTotalRow>(
    ((totals ?? []) as DongGroupTotalRow[]).map((row) => [row.group_id, row]),
  );

  return inDisplayOrder(
    (groups ?? []).map((group) => {
      const derived = byGroup.get(group.id);
      return {
        ...group,
        currency: groupCurrency(group),
        memberCount: derived?.member_count ?? 0,
        expenseCount: derived?.expense_count ?? 0,
        totalSpent: derived?.total_spent ?? 0,
        lastActivityOn: derived?.last_activity_on ?? null,
      };
    }),
  );
}

/**
 * Everything one group's page needs, in one pass. The five reads are
 * independent, so they go together rather than in sequence.
 *
 * A group that is not there — deleted, or never the viewer's — is a 404 rather
 * than an empty page: RLS has already made the distinction, and repeating it
 * in the UI would only tell a stranger which ids exist.
 */
export async function getDongGroup(groupId: string): Promise<DongGroupDetail> {
  const supabase = await createClient();

  const [
    { data: group },
    { data: members },
    { data: balances },
    { data: expenses },
    { data: payments },
  ] = await Promise.all([
    supabase.from("dong_groups").select("*").eq("id", groupId).maybeSingle(),
    supabase
      .from("dong_members")
      .select("*")
      .eq("group_id", groupId)
      .order("sort_order")
      .order("created_at"),
    supabase.rpc("dong_balances", { p_group_id: groupId }),
    supabase
      .from("dong_expenses")
      .select("*")
      .eq("group_id", groupId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("dong_payments")
      .select("*")
      .eq("group_id", groupId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!group) notFound();

  // A second wave rather than a PostgREST embed: the hand-written Database
  // type declares no relationships, so an embedded select comes back untyped
  // and would have to be asserted through `unknown`. Attaching the shares here
  // costs one round trip and keeps the rows typed all the way through.
  const expenseRows = (expenses ?? []) as DongExpenseRow[];
  const shares = expenseRows.length
    ? ((
        await supabase
          .from("dong_expense_shares")
          .select("*")
          .in(
            "expense_id",
            expenseRows.map((expense) => expense.id),
          )
      ).data ?? [])
    : [];

  const sharesByExpense = new Map<string, DongExpenseShareRow[]>();
  for (const share of shares as DongExpenseShareRow[]) {
    const list = sharesByExpense.get(share.expense_id);
    if (list) list.push(share);
    else sharesByExpense.set(share.expense_id, [share]);
  }

  const totals: DongExpenseWithShares[] = expenseRows.map((expense) => ({
    ...expense,
    shares: sharesByExpense.get(expense.id) ?? [],
  }));

  return {
    group: {
      ...group,
      currency: groupCurrency(group),
      memberCount: (members ?? []).filter((member) => !member.is_fund).length,
      expenseCount: totals.length,
      totalSpent: totals.reduce((sum, expense) => sum + expense.amount, 0),
      lastActivityOn: totals[0]?.occurred_on ?? null,
    },
    members: (members ?? []) as DongMemberRow[],
    balances: ((balances ?? []) as DongBalanceRow[]).map((row) => ({
      memberId: row.member_id,
      paid: row.paid,
      share: row.share,
      sent: row.sent,
      received: row.received,
      net: row.net,
    })),
    expenses: totals,
    payments: (payments ?? []) as DongPaymentRow[],
  };
}

/** One open group as the dashboard shows it: its name, and where the viewer stands. */
export type DongDashboardGroup = {
  id: string;
  title: string;
  currency: CurrencyCode;
  memberCount: number;
  /** The viewer's own net. Null when no member of the group is marked as them. */
  net: Minor | null;
};

/**
 * The open groups, for the dashboard card.
 *
 * Nothing is summed across them: each group carries its own currency and this
 * app converts nothing, so they are rendered one per row rather than as a
 * total that would silently add tomans to euros.
 */
export async function listOpenDongGroups(): Promise<DongDashboardGroup[]> {
  const supabase = await createClient();

  const [{ data: groups }, { data: totals }, { data: mine }] = await Promise.all([
    supabase.from("dong_groups").select("*").is("settled_at", null),
    supabase.rpc("dong_group_totals"),
    supabase.rpc("dong_my_balances"),
  ]);

  const countByGroup = new Map<string, number>(
    ((totals ?? []) as DongGroupTotalRow[]).map((row) => [row.group_id, row.member_count]),
  );
  const netByGroup = new Map<string, number>(
    ((mine ?? []) as DongMyBalanceRow[]).map((row) => [row.group_id, row.net]),
  );

  return (groups ?? [])
    .map((group) => ({
      id: group.id,
      title: group.title,
      currency: groupCurrency(group),
      memberCount: countByGroup.get(group.id) ?? 0,
      net: netByGroup.get(group.id) ?? null,
    }))
    // Whoever the user owes, or is owed by, first; then the newest group.
    .sort(
      (a, b) => Math.abs(b.net ?? 0) - Math.abs(a.net ?? 0) || b.id.localeCompare(a.id),
    );
}
