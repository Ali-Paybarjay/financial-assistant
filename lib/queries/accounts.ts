import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { AccountBalanceRow, AccountRow } from "@/lib/supabase/database.types";
import { inDisplayOrder, type AccountWithBalance } from "@/lib/accounts";

/**
 * Every read of accounts goes through this module, and every balance in the
 * product comes from `account_balances()` — never from a column, and never
 * from arithmetic done in a page. There is one definition of what an account
 * holds, and it lives in SQL beside the ledger it is derived from.
 */

export type { AccountWithBalance };

export async function listAccounts(): Promise<AccountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").select("*");

  if (error) throw error;
  return inDisplayOrder(data ?? []);
}

/**
 * Memoized: the layout reads this for the composer and the page under it
 * reads it again. Same request, same rows, one query — and this one is a
 * select plus an RPC.
 */
export const listAccountsWithBalances = cache(async function listAccountsWithBalances(): Promise<
  AccountWithBalance[]
> {
  const supabase = await createClient();

  const [
    { data: accounts, error: accountsError },
    { data: balances, error: balancesError },
  ] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.rpc("account_balances"),
  ]);

  if (accountsError) throw accountsError;
  /**
   * The balance function's error used to be discarded.
   *
   * The fallbacks below are there for an account with no rows against it yet,
   * which genuinely holds exactly what was typed into it — but they read the
   * same when the function itself failed, so a broken RPC showed every account
   * at its opening balance, with a movement of zero and a plausible total on the
   * dashboard. A wrong number nobody can tell is wrong is worse than an error
   * page: the user acts on it. Nothing here can distinguish «no rows» from «no
   * answer», so the answer has to arrive or the read has to fail. F08.
   */
  if (balancesError) throw balancesError;

  const byAccount = new Map<string, AccountBalanceRow>(
    ((balances ?? []) as AccountBalanceRow[]).map((row) => [row.account_id, row]),
  );

  return inDisplayOrder(accounts ?? []).map((account) => {
    const derived = byAccount.get(account.id);
    return {
      ...account,
      // An account the function did not return has no rows yet, so it holds
      // exactly what was typed into it.
      balance: derived?.balance ?? account.opening_balance,
      movement: derived?.movement ?? 0,
      transactionCount: derived?.transaction_count ?? 0,
      lastActivityOn: derived?.last_activity_on ?? null,
    };
  });
});