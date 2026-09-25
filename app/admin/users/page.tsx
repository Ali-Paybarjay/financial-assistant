import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/lib/admin/auth";
import { adminUsers, type UserFilters } from "@/lib/admin/queries";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import { AdminPage, AdminCard } from "@/components/admin/page-shell";
import { DataTable, Pagination, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import type { AdminUserRow } from "@/lib/supabase/database.types";

/**
 * Who is using the app.
 *
 * The filter form is a plain GET — no JavaScript, no state, and every result is
 * a URL the operator can keep or send. That is also why the pager is links.
 *
 * Nothing on this page or the one behind it is a number from anybody's ledger.
 * The closest it comes is a count of rows, which is what «is this account real»
 * actually needs.
 */

const KINDS = [
  { value: "all", label: "همه" },
  { value: "registered", label: "ثبت‌نامی" },
  { value: "guest", label: "مهمان" },
  { value: "onboarded", label: "آنبوردینگ تمام" },
  { value: "pending", label: "آنبوردینگ نیمه‌کاره" },
];

const PROVIDERS = [
  { value: "", label: "همه" },
  { value: "google", label: "گوگل" },
  { value: "email", label: "ایمیل" },
  { value: "guest", label: "مهمان" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; provider?: string; page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const filters: UserFilters = {
    q: params.q,
    kind: params.kind,
    provider: params.provider,
    page: Number(params.page) || 1,
  };

  const result = await adminUsers(filters);

  // The filters survive paging. Losing them on «بعدی» is the classic way a
  // list of failures turns back into a list of everything mid-investigation.
  const href = (page: number) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.kind && params.kind !== "all") query.set("kind", params.kind);
    if (params.provider) query.set("provider", params.provider);
    if (page > 1) query.set("page", String(page));
    const search = query.toString();
    return search ? `/admin/users?${search}` : "/admin/users";
  };

  const columns: readonly Column<AdminUserRow>[] = [
    {
      key: "who",
      header: "کاربر",
      cell: (row) => (
        <Link href={`/admin/users/${row.id}`} className="flex flex-col hover:text-action">
          <span className="font-semibold text-ink">
            {row.full_name?.trim() || <span className="text-ink-muted">بی‌نام</span>}
          </span>
          <span dir="ltr" className="text-caption text-ink-muted">
            {/* A guest has no address; the id's first octet is how the sweep
                page and the audit log refer to them, so it is what is shown. */}
            {row.email ?? `مهمان ${row.id.slice(0, 8)}`}
          </span>
        </Link>
      ),
    },
    {
      key: "provider",
      header: "ورود با",
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          <StatusPill status={row.provider} />
          {row.is_admin && <StatusPill status="review" label="مدیر" tone="accent" />}
        </span>
      ),
    },
    {
      key: "where",
      header: "کشور · ارز",
      cell: (row) =>
        row.country_code || row.base_currency ? (
          <span dir="ltr" className="text-ink-muted">
            {[row.country_code, row.base_currency].filter(Boolean).join(" · ")}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "onboarding",
      header: "آنبوردینگ",
      cell: (row) =>
        row.onboarded ? (
          <StatusPill status="applied" label="تمام" />
        ) : (
          <StatusPill status="parsing" label={`گام ${faNumber(row.onboarding_step)}`} />
        ),
    },
    {
      key: "ai",
      header: "AI ۳۰ روز",
      numeric: true,
      cell: (row) => faNumber(row.ai_calls_30d),
    },
    {
      key: "seen",
      header: "آخرین ورود",
      cell: (row) => (
        <span className="text-ink-muted">
          {row.last_sign_in_at ? formatDateFa(row.last_sign_in_at.slice(0, 10)) : "هرگز"}
        </span>
      ),
    },
  ];

  return (
    <AdminPage
      title="کاربران"
      subtitle={`${faNumber(result.total)} حساب · هیچ تراکنشی در این صفحه نیست`}
    >
      <form method="get" action="/admin/users" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1">
          <label htmlFor="q" className="ps-0.5 text-micro text-ink-muted">
            جست‌وجو
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="ایمیل یا نام"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="kind" className="ps-0.5 text-micro text-ink-muted">
            نوع
          </label>
          <NativeSelect id="kind" name="kind" defaultValue={params.kind ?? "all"}>
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="provider" className="ps-0.5 text-micro text-ink-muted">
            ورود با
          </label>
          <NativeSelect id="provider" name="provider" defaultValue={params.provider ?? ""}>
            {PROVIDERS.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <Button type="submit" size="lg">
          <MagnifyingGlass size={16} />
          اعمال
        </Button>
      </form>

      <AdminCard>
        <DataTable
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          empty="با این فیلترها حسابی نیست."
        />
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          href={href}
          unit="حساب"
        />
      </AdminCard>
    </AdminPage>
  );
}
