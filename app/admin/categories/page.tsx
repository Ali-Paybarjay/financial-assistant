import { requireAdmin } from "@/lib/admin/auth";
import { adminSystemCategories } from "@/lib/admin/queries";
import { isProtectedSlug } from "@/lib/admin/categories";
import { faNumber } from "@/lib/format";
import { AdminPage } from "@/components/admin/page-shell";
import { CategoriesView } from "./categories-view";
import type { EditableCategory } from "./category-sheet";

/**
 * The twenty rows every user shares.
 *
 * They were editable by SQL and nothing else, which is the wrong tool for what
 * this actually is: the names appear on every composer and inside the model's
 * prompt, so renaming one is a product change with a blast radius. A page with a
 * confirmation and an audit row is a better home for it than a psql session.
 *
 * «Usage» is summed across all five tables that reference a category, because
 * «unused» has to mean all five — one with no transactions can still be what
 * somebody's rent is filed under.
 */
export default async function AdminCategoriesPage() {
  await requireAdmin();

  const categories = await adminSystemCategories();

  const rows: EditableCategory[] = categories.map((category) => ({
    id: category.id,
    name_fa: category.name_fa,
    slug: category.slug,
    kind: category.kind,
    cost_kind: category.cost_kind,
    sort_order: category.sort_order,
    usageTotal: category.usage
      ? category.usage.transactions +
        category.usage.statement_lines +
        category.usage.recurring +
        category.usage.budgets +
        category.usage.baselines
      : 0,
    protected: isProtectedSlug(category.slug),
  }));

  return (
    <AdminPage
      title="دسته‌ها"
      subtitle={`${faNumber(rows.length)} دستهٔ سیستمی · ویرایش فوراً روی همهٔ کاربران و پرامپت مدل اثر می‌گذارد`}
    >
      <CategoriesView rows={rows} />
    </AdminPage>
  );
}
