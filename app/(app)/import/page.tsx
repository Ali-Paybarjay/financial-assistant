import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listImports, listLines, openImport } from "@/lib/queries/statements";
import { convertibleFrom } from "@/lib/money";
import { ImportView } from "./import-view";

export default async function ImportPage() {
  const viewer = await requireViewer();

  const [categories, current, history] = await Promise.all([
    listCategories(),
    openImport(),
    listImports(),
  ]);

  // Only a report that is waiting on the user needs its lines; a half-finished
  // upload has none yet.
  const lines = current?.status === "review" ? await listLines(current.id) : [];

  return (
    <ImportView
      currency={viewer.currency}
      sourceOptions={convertibleFrom(viewer.currency)}
      categories={categories}
      current={current}
      lines={lines}
      history={history}
    />
  );
}
