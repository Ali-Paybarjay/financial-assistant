import { requireViewer } from "@/lib/auth";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { todayInTimeZone } from "@/lib/date";
import { AccountsView } from "./accounts-view";

export default async function AccountsPage() {
  const viewer = await requireViewer();
  const accounts = await listAccountsWithBalances();

  return (
    <AccountsView
      currency={viewer.currency}
      today={todayInTimeZone(viewer.timeZone)}
      timeZone={viewer.timeZone}
      accounts={accounts}
    />
  );
}
