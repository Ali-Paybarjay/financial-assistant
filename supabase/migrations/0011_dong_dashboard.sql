-- Where the viewer stands in every group at once, for the dashboard.
--
-- dong_balances() answers "everyone, in this one group", which is what the
-- group page needs. The dashboard asks the other question — "me, across all
-- of them" — and answering it by calling the per-group function once per group
-- would be one round trip per trip the user has ever been on.
--
-- Nothing is summed across groups here, and that is deliberate: each group
-- carries its own currency and this app converts nothing, so the caller gets
-- one row per group and renders them separately.
create or replace function public.dong_my_balances()
returns table (
  group_id uuid,
  net bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.group_id,
    (coalesce(p.total, 0) + coalesce(o.total, 0)
      - coalesce(s.total, 0) - coalesce(i.total, 0))::bigint
  from public.dong_members m
  left join lateral (
    select sum(e.amount) as total from public.dong_expenses e
    where e.paid_by_member_id = m.id
  ) p on true
  left join lateral (
    select sum(sh.amount) as total from public.dong_expense_shares sh
    where sh.member_id = m.id
  ) s on true
  left join lateral (
    select sum(pay.amount) as total from public.dong_payments pay
    where pay.from_member_id = m.id
  ) o on true
  left join lateral (
    select sum(pay.amount) as total from public.dong_payments pay
    where pay.to_member_id = m.id
  ) i on true
  -- One member per group is the viewer, guaranteed by a partial unique index,
  -- so this is at most one row per group.
  where m.is_me
    and m.user_id = (select auth.uid());
$$;

revoke execute on function public.dong_my_balances() from public, anon;
grant execute on function public.dong_my_balances() to authenticated;
