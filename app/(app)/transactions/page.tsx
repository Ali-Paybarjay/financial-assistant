import { requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listTransactions } from "@/lib/queries/transactions";
import { monthRange, todayInTimeZone } from "@/lib/date";
import { TransactionsView } from "./transactions-view";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    category?: string;
    type?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const viewer = await requireViewer();

  const today = todayInTimeZone(viewer.timeZone);
  const range = monthRange(viewer.timeZone, params.month ?? today);
  const type = params.type === "income" || params.type === "expense" ? params.type : undefined;

  const categories = await listCategories();
  const categoryId = params.category
    ? categories.find((entry) => entry.slug === params.category)?.id
    : undefined;

  const transactions = await listTransactions({
    from: range.from,
    to: range.to,
    type,
    query: params.q,
    categoryIds: categoryId ? [categoryId] : undefined,
  });

  return (
    <TransactionsView
      currency={viewer.currency}
      today={today}
      month={range.month}
      transactions={transactions}
      categories={categories}
      activeFilters={{
        category: params.category,
        type,
        query: params.q,
      }}
    />
  );
}
