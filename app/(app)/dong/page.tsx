import { requireViewer } from "@/lib/auth";
import { listDongGroups } from "@/lib/queries/dong";
import { listAccounts } from "@/lib/queries/accounts";
import { preferredAccountId } from "@/lib/accounts";
import { todayInTimeZone } from "@/lib/date";
import { DongView } from "./dong-view";

export default async function DongPage() {
  const viewer = await requireViewer();
  const [groups, accounts] = await Promise.all([listDongGroups(), listAccounts()]);

  return (
    <DongView
      groups={groups}
      // Every account, not only the ones in the profile's currency: the sheet
      // narrows them to whatever currency the new group is being given.
      accounts={accounts}
      defaultAccountId={preferredAccountId(accounts)}
      // The group picks its own currency; the profile's is only the default
      // the form opens with, because most groups are in the money you live in.
      defaultCurrency={viewer.currency}
      today={todayInTimeZone(viewer.timeZone)}
    />
  );
}
