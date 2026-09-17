import "server-only";

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

export async function listAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const supabase = await createClient();

  const [{ data: accounts, error }, { data: balances }] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.rpc("account_balances"),
  ]);

  if (error) throw error;

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
}
