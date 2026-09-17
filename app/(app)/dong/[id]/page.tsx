import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDongGroup } from "@/lib/queries/dong";
import { todayInTimeZone } from "@/lib/date";
import { GroupView } from "./group-view";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DongGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Postgres rejects a malformed uuid with an error rather than no rows, and a
  // typed-in url is not a server fault.
  if (!UUID.test(id)) notFound();

  const viewer = await requireViewer();
  const detail = await getDongGroup(id);

  return <GroupView detail={detail} today={todayInTimeZone(viewer.timeZone)} />;
}
