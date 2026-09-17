import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listAccounts } from "@/lib/queries/accounts";
import { preferredAccountId } from "@/lib/accounts";
import { listImports, listLines, openImport } from "@/lib/queries/statements";
import { convertibleFrom } from "@/lib/money";
import { todayInTimeZone } from "@/lib/date";
import { ImportView } from "./import-view";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account: requestedAccount } = await searchParams;
  const viewer = await requireViewer();

  const [categories, accounts, history] = await Promise.all([
    listCategories(),
    listAccounts(),
    listImports(),
  ]);

  // Arriving from an account's "update" button. An id that is not the
  // viewer's own is ignored rather than trusted, so the page cannot be aimed
  // at somebody else's account by hand.
  const requestedId = accounts.find((entry) => entry.id === requestedAccount)?.id ?? null;

  // Scoped to the account when there is one: a half-finished report about a
  // different account is not what this page was opened to show.
  const current = await openImport(requestedId ?? undefined);

  // Only a report that is waiting on the user needs its lines; a half-finished
  // upload has none yet.
  const lines = current?.status === "review" ? await listLines(current.id) : [];

  return (
    <ImportView
      currency={viewer.currency}
      sourceOptions={convertibleFrom(viewer.currency)}
      categories={categories}
      accounts={accounts}
      defaultAccountId={requestedId ?? preferredAccountId(accounts)}
      lockedAccountId={requestedId}
      current={current}
      lines={lines}
      history={history}
      today={todayInTimeZone(viewer.timeZone)}
    />
  );
}
