import { requireViewer } from "@/lib/auth";
import { listDongGroups } from "@/lib/queries/dong";
import { todayInTimeZone } from "@/lib/date";
import { DongView } from "./dong-view";

export default async function DongPage() {
  const viewer = await requireViewer();
  const groups = await listDongGroups();

  return (
    <DongView
      groups={groups}
      // The group picks its own currency; the profile's is only the default
      // the form opens with, because most groups are in the money you live in.
      defaultCurrency={viewer.currency}
      today={todayInTimeZone(viewer.timeZone)}
    />
  );
}
