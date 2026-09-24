import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { listGoalsWithProgress } from "@/lib/queries/goals";
import { listEnvelopes } from "@/lib/queries/envelopes";
import { preferredAccountId } from "@/lib/accounts";
import { monthRemaining } from "@/lib/envelopes";
import { monthRange, todayInTimeZone } from "@/lib/date";
import { CaptureView } from "./capture-view";

/**
 * Where opening the app lands you: a field, and the one number it moves.
 *
 * The board used to be here, and it costs — before a single pixel — a write
 * (ensureRecurringPosted) and twelve reads, one of which scans three months of
 * transactions. That is paid on every launch, while most launches exist to
 * write down one purchase. So the board keeps its address and this keeps the
 * front door.
 *
 * Nothing on this page is fetched for the field itself; the field needs no
 * data to render. Everything below is read by the layout already, for the
 * composer, and comes back from React's per-request cache.
 */
export default async function CapturePage() {
  const viewer = await requireViewer();

  // Someone who asked to start in «دنگ و دونگ» still does. This field writes
  // to the personal ledger, so handing it to them would be the exact
  // cross-contamination the two workspaces exist to prevent — rule 11, from
  // the other direction.
  if (viewer.profile.default_workspace === "dong") redirect("/dong");

  const today = todayInTimeZone(viewer.timeZone);
  const month = monthRange(viewer.timeZone, today).month;

  const [categories, accounts, goals, envelopes] = await Promise.all([
    listCategories(),
    listAccountsWithBalances(),
    listGoalsWithProgress(),
    listEnvelopes(month),
  ]);

  return (
    <CaptureView
      remaining={monthRemaining(envelopes)}
      currency={viewer.currency}
      categories={categories}
      accounts={accounts}
      goals={goals.filter((goal) => goal.status === "active")}
      envelopes={envelopes}
      defaultAccountId={preferredAccountId(accounts)}
      today={today}
    />
  );
}
